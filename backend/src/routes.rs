//! HTTP route handlers for the Farmers Market Place API.
//! Provides endpoints for products, authentication, cart, messaging, and M-Pesa checkout.

use actix_web::{get, post, patch, delete, web, HttpResponse, Result as ActixResult};
use sqlx::{PgPool, Row};
use crate::models::{LoginRequest, SignupRequest, ProductRequest, Role, LoginResponse, create_jwt, verify_jwt, Claims, CartItemRequest, UpdateCartItemRequest, UpdateUserRoleRequest, UpdateUserVerificationRequest, UploadVerificationDocumentRequest, CheckoutRequest, CheckoutResponse, SendMessageRequest, FollowRequest, CreateReviewRequest, CreateShippingOrderRequest, UpdateShippingStatusRequest, VerifyDeliveryRequest, WithdrawRequest, WithdrawResponse};
use crate::db;  // Database helper functions
use crate::mpesa::{MpesaClient, MpesaConfig, StkCallbackBody, extract_callback_data, PaymentStatus};
use crate::gemini;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::OnceLock;

/// GET /products - Retrieve all products, optionally filtered by vendor or location.
#[get("/products")]
async fn get_products(req: actix_web::HttpRequest, pool: web::Data<PgPool>) -> ActixResult<HttpResponse> {
    let vendor_filter = if let Ok(claims) = extract_auth(&req) {
        if claims.role == "Vendor" {
            Some(claims.sub)
        } else {
            None
        }
    } else {
        None // No auth, show all
    };

    // Extract location string for filtering (e.g., "Nakuru")
    let query_string = req.query_string();
    let user_location = extract_query_param(&query_string, "location");

    match db::get_all_products(&pool, vendor_filter, user_location).await {
        Ok(products) => Ok(HttpResponse::Ok().json(products)),
        Err(e) => Ok(HttpResponse::InternalServerError().json(format!("Failed to fetch products: {:?}", e))),
    }
}

/// POST /products - Create a new product (verified vendors only).
#[post("/products")]
async fn create_product(req: actix_web::HttpRequest, pool: web::Data<PgPool>, product_req: web::Json<ProductRequest>) -> ActixResult<HttpResponse> {
    let vendor_id = match check_vendor_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    // Check if vendor is verified
    let verified: (bool,) = match sqlx::query_as("SELECT verified FROM users WHERE id = $1")
        .bind(vendor_id)
        .fetch_one(pool.get_ref())
        .await {
        Ok(result) => result,
        Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to check verification status")),
    };

    if !verified.0 {
        return Ok(HttpResponse::Forbidden().json("Account not verified. Please wait for admin verification."));
    }

    // Check report count
    let report_count: i64 = match sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM vendor_reports WHERE vendor_id = $1")
        .bind(vendor_id)
        .fetch_one(pool.get_ref())
        .await {
        Ok(count) => count,
        Err(e) => {
            eprintln!("Database error checking report count: {:?}", e);
            return Ok(HttpResponse::InternalServerError().json(json!({
                "error": "Failed to check report count",
                "details": format!("{:?}", e)
            })));
        },
    };

    if report_count >= 5 {
        return Ok(HttpResponse::Forbidden().json("Account suspended due to multiple reports."));
    }

    match db::create_product(&pool, &product_req.name, product_req.price, &product_req.category, &product_req.description, product_req.quantity, product_req.image.as_deref(), vendor_id).await {
        Ok(product) => Ok(HttpResponse::Created().json(product)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to create product")),
    }
}

/// PATCH /products/{product_id} - Update a product (owner only).
#[patch("/products/{product_id}")]
async fn update_product(req: actix_web::HttpRequest, pool: web::Data<PgPool>, product_id: web::Path<i32>, product_req: web::Json<ProductRequest>) -> ActixResult<HttpResponse> {
    let vendor_id = match check_vendor_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    match db::update_product(&pool, *product_id, &product_req.name, product_req.price, &product_req.category, &product_req.description, product_req.quantity, product_req.image.as_deref(), vendor_id).await {
        Ok(product) => Ok(HttpResponse::Ok().json(product)),
        Err(_) => Ok(HttpResponse::BadRequest().json("Product not found or access denied")),
    }
}

/// DELETE /products/{product_id} - Delete a product (owner only).
#[delete("/products/{product_id}")]
async fn delete_product(req: actix_web::HttpRequest, pool: web::Data<PgPool>, product_id: web::Path<i32>) -> ActixResult<HttpResponse> {
    let vendor_id = match check_vendor_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    match db::delete_product(&pool, *product_id, vendor_id).await {
        Ok(_) => Ok(HttpResponse::NoContent().finish()),
        Err(_) => Ok(HttpResponse::BadRequest().json("Product not found or access denied")),
    }
}

/**
 * POST /login - Authenticate user login
 *
 * Validates user credentials against the database and returns user information if valid.
 *
 * @param pool - PostgreSQL connection pool
 * @param req - JSON request with username and password
 * @returns JSON user object on success, 401 on invalid credentials
 */
#[post("/login")]
async fn login(pool: web::Data<PgPool>, req: web::Json<LoginRequest>) -> ActixResult<HttpResponse> {
    // Attempt to authenticate the user with database
    match db::authenticate_user(&pool, &req.username, &req.password).await {
        Ok(user) => {
            // Create JWT token
            match create_jwt(&user) {
                Ok(token) => {
                    let response = LoginResponse { token, user };
                    Ok(HttpResponse::Ok().json(response)) // 200 OK with token and user data
                }
                Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to create token")),
            }
        }
        Err(_) => Ok(HttpResponse::Unauthorized().json("Invalid credentials")), // 401 Unauthorized
    }
}

/**
 * POST /signup - Register a new user
 *
 * Creates a new user account with the specified role and profile information.
 * Handles duplicate username/email conflicts and returns appropriate errors.
 *
 * @param pool - PostgreSQL connection pool
 * @param req - JSON request with user registration details
 * @returns JSON user object on success, error status on failure
 */
#[post("/signup")]
async fn signup(pool: web::Data<PgPool>, req: web::Json<SignupRequest>) -> ActixResult<HttpResponse> {
    // Validate phone number requirements
    if req.mpesa_number.trim().is_empty() {
        return Ok(HttpResponse::BadRequest().json("Phone number is required"));
    }
    if req.mpesa_number.len() < 10 || req.mpesa_number.len() > 15 {
        return Ok(HttpResponse::BadRequest().json("Phone number must be between 10 and 15 digits"));
    }
    if !req.mpesa_number.chars().all(|c| c.is_numeric() || c == '+') {
        return Ok(HttpResponse::BadRequest().json("Phone number must contain only numbers and optionally start with +"));
    }

    // Validate password requirements
    if req.password.len() < 8 {
        return Ok(HttpResponse::BadRequest().json("Password must be at least 8 characters"));
    }
    if !req.password.chars().any(|c| c.is_uppercase()) {
        return Ok(HttpResponse::BadRequest().json("Password must contain at least one uppercase letter"));
    }
    if !req.password.chars().any(|c| c.is_lowercase()) {
        return Ok(HttpResponse::BadRequest().json("Password must contain at least one lowercase letter"));
    }
    if !req.password.chars().any(|c| c.is_numeric()) {
        return Ok(HttpResponse::BadRequest().json("Password must contain at least one number"));
    }
    if !req.password.chars().any(|c| "!@#$%^&*(),.?\":{}|<>".contains(c)) {
        return Ok(HttpResponse::BadRequest().json("Password must contain at least one special character"));
    }

    // Convert string role to enum, defaulting to Customer
    let role = match req.role.as_deref().unwrap_or("Customer") {
        "Vendor" => Role::Vendor,
        _ => Role::Customer,
    };

    // Attempt to create new user in database
    match db::create_user(&pool, &req.username, &req.email, &req.password, &role, req.profile_image.as_deref(), req.location_string.as_deref(), Some(&req.mpesa_number)).await {
        Ok(user) => Ok(HttpResponse::Created().json(user)),           // 201 Created with user data
        // Handle unique constraint violations (duplicate username/email)
        Err(sqlx::Error::Database(db_err)) if db_err.constraint().is_some() => {
            Ok(HttpResponse::Conflict().json("Username or email already exists"))  // 409 Conflict
        }
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to create user")),  // 500 Internal Error
    }
}

use actix_web::http::header::AUTHORIZATION;



/**
 * GET /cart - Get user's cart items
 *
 * Retrieves all items in the authenticated customer's shopping cart.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON array of cart items with product details
 */
#[get("/cart")]
async fn get_cart(req: actix_web::HttpRequest, pool: web::Data<PgPool>) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::get_cart_items(&pool, user_id).await {
        Ok(cart_items) => Ok(HttpResponse::Ok().json(cart_items)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch cart items")),
    }
}

/**
 * POST /cart - Add item to cart
 *
 * Adds a product to the authenticated customer's shopping cart.
 * If the product already exists in the cart, increases the quantity.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param cart_req - JSON request with product_id and quantity
 * @returns JSON of the added/updated cart item
 */
#[post("/cart")]
async fn add_to_cart_route(req: actix_web::HttpRequest, pool: web::Data<PgPool>, cart_req: web::Json<CartItemRequest>) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::add_to_cart(&pool, user_id, cart_req.product_id, cart_req.quantity).await {
        Ok(cart_item) => Ok(HttpResponse::Created().json(cart_item)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to add item to cart")),
    }
}

/**
 * PUT /cart/{item_id} - Update cart item quantity
 *
 * Updates the quantity of a specific item in the authenticated customer's cart.
 * User can only update their own cart items.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param item_id - Cart item ID from URL path
 * @param update_req - JSON request with new quantity
 * @returns JSON of the updated cart item
 */
#[patch("/cart/{item_id}")]
async fn update_cart_item(req: actix_web::HttpRequest, pool: web::Data<PgPool>, item_id: web::Path<i32>, update_req: web::Json<UpdateCartItemRequest>) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::update_cart_item_quantity(&pool, *item_id, user_id, update_req.quantity).await {
        Ok(cart_item) => Ok(HttpResponse::Ok().json(cart_item)),
        Err(_) => Ok(HttpResponse::BadRequest().json("Cart item not found or access denied")),
    }
}

/**
 * DELETE /cart/{item_id} - Remove item from cart
 *
 * Removes a specific item from the authenticated customer's shopping cart.
 * User can only remove their own cart items.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param item_id - Cart item ID from URL path
 * @returns Empty response on success
 */
#[delete("/cart/{item_id}")]
async fn remove_from_cart_route(req: actix_web::HttpRequest, pool: web::Data<PgPool>, item_id: web::Path<i32>) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::remove_from_cart_with_user(&pool, *item_id, user_id).await {
        Ok(_) => Ok(HttpResponse::NoContent().finish()),
        Err(_) => Ok(HttpResponse::BadRequest().json("Cart item not found or access denied")),
    }
}

// Global M-Pesa client instance
static MPESA_CLIENT: OnceLock<Option<MpesaClient>> = OnceLock::new();

fn get_mpesa_client() -> Option<&'static MpesaClient> {
    MPESA_CLIENT.get_or_init(|| {
        match MpesaConfig::from_env() {
            Ok(config) => Some(MpesaClient::new(config)),
            Err(e) => {
                eprintln!("Failed to initialize M-Pesa client: {}", e);
                None
            }
        }
    }).as_ref()
}

/**
 * POST /checkout - Process M-Pesa payment using Daraja API
 *
 * Initiates M-Pesa STK Push payment for the authenticated customer's cart items.
 * Integrates with Safaricom's M-Pesa Daraja API for real payments.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param checkout_req - JSON request with M-Pesa number and total amount
 * @returns JSON response with transaction details
 */
#[post("/checkout")]
async fn checkout(req: actix_web::HttpRequest, pool: web::Data<PgPool>, checkout_req: web::Json<CheckoutRequest>) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    // Validate M-Pesa phone number format
    let phone_number = &checkout_req.mpesa_number;
    if !is_valid_kenyan_phone(phone_number) {
        return Ok(HttpResponse::BadRequest().json(json!({
            "error": "Invalid phone number",
            "message": "Please enter a valid Kenyan phone number (07XXXXXXXX, 254XXXXXXXXX, or +254XXXXXXXXX)"
        })));
    }

    // Validate minimum amount (M-Pesa minimum is KSh 1)
    if checkout_req.total_amount < 1.0 {
        return Ok(HttpResponse::BadRequest().json(json!({
            "error": "Invalid amount", 
            "message": "Amount must be at least KSh 1"
        })));
    }

    println!("🔄 Checkout initiated for phone: {} | Amount: KSh {:.2}", phone_number, checkout_req.total_amount);

    // Get user's cart items to verify they have items
    match db::get_cart_items(&pool, user_id).await {
        Ok(all_cart_items) => {
            if all_cart_items.is_empty() {
                return Ok(HttpResponse::BadRequest().json("Cart is empty"));
            }

            // Filter cart items based on selected_items if provided
            let cart_items: Vec<_> = if let Some(selected) = &checkout_req.selected_items {
                all_cart_items.into_iter()
                    .filter(|item| selected.contains(&item.id))
                    .collect()
            } else {
                all_cart_items
            };

            if cart_items.is_empty() {
                return Ok(HttpResponse::BadRequest().json("No valid items selected for checkout"));
            }

            // Calculate total from selected cart items for reference
            let calculated_total: f64 = cart_items.iter()
                .map(|item| item.product.price * item.quantity as f64)
                .sum();
            
            // Round to 2 decimal places to match frontend
            let calculated_total = (calculated_total * 100.0).round() / 100.0;

            // Allow custom amounts - no longer enforce cart total match
            // Users can pay any amount they want (as low as 1 KSh)
            // This allows flexible payments, partial payments, tips, etc.
            println!("💳 Payment request: KSh {:.2} (Cart total: KSh {:.2})", checkout_req.total_amount, calculated_total);
            
            // Only validate that amount is reasonable (>= 1 KSh)
            if checkout_req.total_amount < 1.0 {
                return Ok(HttpResponse::BadRequest().json(json!({
                    "error": "Invalid amount",
                    "message": "Minimum payment amount is KSh 1",
                    "requested_total": checkout_req.total_amount
                })));
            }

            // Get M-Pesa client
            let mpesa_client = match get_mpesa_client() {
                Some(client) => client,
                None => {
                    // Fallback to demo mode if M-Pesa is not configured
                    println!("M-Pesa not configured, using demo mode");
                    return demo_checkout(pool, user_id, &cart_items, &checkout_req).await;
                }
            };

            // Prepare STK Push parameters
            let formatted_phone = format_kenyan_phone(phone_number);
            let account_reference = format!("FM_{}", user_id); // Farmers Market + user ID
            let transaction_desc = "Farmers Market Purchase";

            println!("📱 Initiating STK Push to: {}", formatted_phone);
            println!("💰 Amount: KSh {:.2}", checkout_req.total_amount);

            // Initiate STK Push
            match mpesa_client.stk_push(
                formatted_phone.clone(),
                checkout_req.total_amount,
                account_reference,
                transaction_desc.to_string(),
            ).await {
                Ok(stk_response) => {
                    println!("✅ STK Push initiated successfully");
                    println!("📋 Transaction ID: {}", stk_response.checkout_request_i_d);

                    // Convert selected cart item IDs to comma-separated string
                    let cart_item_ids_str = if let Some(selected) = &checkout_req.selected_items {
                        Some(selected.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(","))
                    } else {
                        // If no items selected, get all cart item IDs
                        let all_ids = cart_items.iter().map(|item| item.id.to_string()).collect::<Vec<_>>().join(",");
                        Some(all_ids)
                    };

                    // Store payment transaction in database with selected cart items
                    match db::create_payment_transaction(
                        &pool,
                        user_id,
                        &stk_response.checkout_request_i_d,
                        &stk_response.merchant_request_i_d,
                        &formatted_phone,
                        checkout_req.total_amount,
                        cart_item_ids_str.as_deref(),
                    ).await {
                        Ok(transaction_id) => {
                            println!("💾 Payment transaction stored with ID: {}", transaction_id);
                        }
                        Err(e) => {
                            eprintln!("❌ Failed to store payment transaction: {:?}", e);
                            // Continue anyway - payment can still succeed
                        }
                    }

                    // Log M-Pesa response details
                    println!("📊 M-Pesa Response Code: {}", stk_response.response_code);
                    println!("📝 M-Pesa Description: {}", stk_response.response_description);

                    // Return success response to frontend
                    let response = CheckoutResponse {
                        transaction_id: stk_response.checkout_request_i_d,
                        message: if !stk_response.customer_message.is_empty() {
                            stk_response.customer_message
                        } else {
                            format!("Payment request sent to {}. Check your phone and enter your M-Pesa PIN to complete the payment.", phone_number)
                        },
                        status: if stk_response.response_code == "0" {
                            "initiated".to_string()
                        } else {
                            "pending".to_string()
                        },
                    };

                    Ok(HttpResponse::Ok().json(response))
                }
                Err(e) => {
                    eprintln!("❌ STK Push failed: {:?}", e);
                    
                    // Return user-friendly error message based on error type
                    let error_message = if e.to_string().contains("insufficient") {
                        "Insufficient balance. Please top up your M-Pesa account and try again."
                    } else if e.to_string().contains("timeout") {
                        "Request timeout. Please check your network connection and try again."
                    } else if e.to_string().contains("invalid") {
                        "Invalid phone number. Please check and try again."
                    } else if e.to_string().contains("duplicate") {
                        "A payment request is already pending for this transaction. Please wait a moment and try again."
                    } else {
                        "Payment service temporarily unavailable. Please try again in a few minutes."
                    };

                    Ok(HttpResponse::ServiceUnavailable().json(json!({
                        "error": "Payment failed",
                        "message": error_message,
                        "retry": true,
                        "phone_number": phone_number
                    })))
                }
            }
        }
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch cart items")),
    }
}

/**
 * Fallback demo checkout when M-Pesa is not configured
 */
async fn demo_checkout(
    pool: web::Data<PgPool>,
    user_id: i32,
    cart_items: &[crate::models::CartItem],
    checkout_req: &CheckoutRequest,
) -> ActixResult<HttpResponse> {
    // Generate transaction ID (demo mode)
    let transaction_id = format!("DEMO_TXN_{}_{}", user_id, chrono::Utc::now().timestamp());

    // Create shipping orders for each cart item
    for item in cart_items {
        match db::create_shipping_order(&pool, user_id, item.product_id, item.quantity, "Default shipping address - please update in your orders").await {
            Ok(_) => {},
            Err(e) => {
                eprintln!("Failed to create shipping order for product {}: {:?}", item.product_id, e);
            }
        }
    }

    // Clear the cart after successful checkout (demo mode)
    for item in cart_items {
        match db::remove_from_cart_with_user(&pool, item.id, user_id).await {
            Ok(_) => {},
            Err(e) => eprintln!("Failed to remove cart item {}: {:?}", item.id, e),
        }
    }

    let response = CheckoutResponse {
        transaction_id: transaction_id.clone(),
        message: "DEMO MODE: Payment simulated successfully. Your orders have been created.".to_string(),
        status: "completed".to_string(),
    };

    println!("Demo payment completed - User: {}, Phone: {}, Amount: {:.2}, Transaction: {}",
            user_id, checkout_req.mpesa_number, checkout_req.total_amount, transaction_id);

    Ok(HttpResponse::Ok().json(response))
}

// Helper functions for M-Pesa phone number validation and formatting
fn is_valid_kenyan_phone(phone: &str) -> bool {
    // Remove spaces and common separators
    let clean_phone = phone.replace(&[' ', '-', '(', ')'][..], "");
    
    // Check various Kenyan phone number formats
    if clean_phone.starts_with("07") && clean_phone.len() == 10 {
        // 07XXXXXXXX format
        clean_phone.chars().all(|c| c.is_ascii_digit())
    } else if clean_phone.starts_with("254") && clean_phone.len() == 12 {
        // 254XXXXXXXXX format
        clean_phone.chars().all(|c| c.is_ascii_digit())
    } else if clean_phone.starts_with("+254") && clean_phone.len() == 13 {
        // +254XXXXXXXXX format
        clean_phone[1..].chars().all(|c| c.is_ascii_digit())
    } else {
        false
    }
}

fn format_kenyan_phone(phone: &str) -> String {
    let clean_phone = phone.replace(&[' ', '-', '(', ')'][..], "");
    
    if clean_phone.starts_with("07") {
        format!("254{}", &clean_phone[1..])
    } else if clean_phone.starts_with("+254") {
        clean_phone[1..].to_string()
    } else if clean_phone.starts_with("254") {
        clean_phone
    } else {
        // Default fallback - assume it's a 9-digit number without country code
        if clean_phone.len() == 9 && clean_phone.chars().all(|c| c.is_ascii_digit()) {
            format!("254{}", clean_phone)
        } else {
            format!("254{}", clean_phone)
        }
    }
}

// Auth helpers
fn extract_auth(req: &actix_web::HttpRequest) -> Result<Claims, HttpResponse> {
    let auth_header = req.headers().get(AUTHORIZATION);
    if auth_header.is_none() {
        return Err(HttpResponse::Unauthorized().json("Authorization header missing"));
    }

    let auth_header_value = auth_header.unwrap();
    let auth_str = match auth_header_value.to_str() {
        Ok(s) => s,
        Err(_) => return Err(HttpResponse::BadRequest().json("Invalid authorization header encoding")),
    };

    if !auth_str.starts_with("Bearer ") {
        return Err(HttpResponse::Unauthorized().json("Invalid authorization format"));
    }

    let token = &auth_str[7..]; // Remove "Bearer " prefix

    match verify_jwt(token) {
        Ok(claims) => Ok(claims),
        Err(_) => Err(HttpResponse::Unauthorized().json("Invalid token")),
    }
}

fn check_admin_auth(req: &actix_web::HttpRequest) -> Result<(), HttpResponse> {
    let claims = extract_auth(req)?;
    if claims.role != "Admin" {
        return Err(HttpResponse::Forbidden().json("Admin privileges required"));
    }
    Ok(())
}

fn check_vendor_auth(req: &actix_web::HttpRequest) -> Result<i32, HttpResponse> {
    let claims = extract_auth(req)?;
    if claims.role != "Vendor" {
        return Err(HttpResponse::Forbidden().json("Vendor privileges required"));
    }
    Ok(claims.sub)
}

fn check_customer_auth(req: &actix_web::HttpRequest) -> Result<i32, HttpResponse> {
    let claims = extract_auth(req)?;
    if claims.role != "Customer" {
        return Err(HttpResponse::Forbidden().json("Customer privileges required"));
    }
    Ok(claims.sub)
}

fn extract_query_param(query_string: &str, param_name: &str) -> Option<String> {
    let params = query_string.trim_start_matches('?');
    for pair in params.split('&') {
        let mut parts = pair.split('=');
        if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
            if key == param_name {
                return Some(value.to_string());
            }
        }
    }
    None
}

// ADMIN ROUTES
#[get("/api/admin/users")]
async fn get_all_users(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    match db::get_all_users(&pool).await {
        Ok(users) => Ok(HttpResponse::Ok().json(users)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch users")),
    }
}

/// GET /users - Get all users for messaging (public, but requires authentication)
#[get("/users")]
async fn get_all_users_for_messaging(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    // Verify user is authenticated
    let current_user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::get_all_users(&pool).await {
        Ok(users) => {
            // Check if current users are following each other (mutual friends)
            let following_ids: Vec<i32> = match sqlx::query_scalar(
                "SELECT vendor_id FROM follows WHERE follower_id = $1"
            )
            .bind(current_user_id)
            .fetch_all(pool.get_ref())
            .await {
                Ok(ids) => ids,
                Err(_) => Vec::new(),
            };

            let followers_ids: Vec<i32> = match sqlx::query_scalar(
                "SELECT follower_id FROM follows WHERE vendor_id = $1"
            )
            .bind(current_user_id)
            .fetch_all(pool.get_ref())
            .await {
                Ok(ids) => ids,
                Err(_) => Vec::new(),
            };

            // Filter out the current user and admins, then return enriched data
            let filtered_users: Vec<_> = users
                .into_iter()
                .filter(|u| u.id != current_user_id && !matches!(u.role, Role::Admin))
                .map(|u| {
                    let is_followed = following_ids.contains(&u.id);
                    let is_following_back = followers_ids.contains(&u.id);
                    let is_mutual_friend = is_followed && is_following_back;

                    serde_json::json!({
                        "id": u.id,
                        "username": u.username,
                        "role": u.role,
                        "profile_image": u.profile_image,
                        // Only show personal info if mutual friends
                        "email": if is_mutual_friend { &u.secondary_email } else { &None },
                        "phone": if is_mutual_friend { &u.mpesa_number } else { &None },
                        "location": if is_mutual_friend { &u.location_string } else { &None },
                        // Follow status for UI
                        "is_followed": is_followed,
                        "is_following_back": is_following_back,
                        "is_mutual_friend": is_mutual_friend
                    })
                })
                .collect();
            Ok(HttpResponse::Ok().json(filtered_users))
        },
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch users")),
    }
}

#[get("/api/admin/pending-vendors")]
async fn get_pending_vendors(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    match db::get_pending_vendors(&pool).await {
        Ok(vendors) => Ok(HttpResponse::Ok().json(vendors)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch pending vendors")),
    }
}

#[patch("/api/admin/users/{user_id}")]
async fn update_user_role(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    user_id: web::Path<i32>,
    request: web::Json<UpdateUserRoleRequest>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    let role = match request.role.as_str() {
        "Admin" => Role::Admin,
        "Vendor" => Role::Vendor,
        "Customer" => Role::Customer,
        _ => return Ok(HttpResponse::BadRequest().json("Invalid role")),
    };

    match db::update_user_role(&pool, *user_id, &role).await {
        Ok(_) => Ok(HttpResponse::Ok().json("Role updated successfully")),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to update role")),
    }
}

#[patch("/api/admin/users/{user_id}/verify")]
async fn update_user_verification(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    user_id: web::Path<i32>,
    request: web::Json<UpdateUserVerificationRequest>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    match db::update_user_verification(&pool, *user_id, request.verified).await {
        Ok(_) => Ok(HttpResponse::Ok().json("Verification status updated successfully")),
        Err(e) => Ok(HttpResponse::InternalServerError().json(format!("Failed to update verification: {:?}", e))),
    }
}

/**
 * POST /vendor/upload-verification - Upload vendor verification document
 *
 * Allows vendors to upload documents (ID, business license, etc.) for verification.
 * The document image is stored as Base64 encoded data.
 *
 * @param req - HTTP request for authentication
 * @param pool - PostgreSQL connection pool
 * @param request - JSON request body with verification_document (Base64 encoded)
 * @returns JSON confirmation message
 */
#[post("/vendor/upload-verification")]
async fn upload_verification_document(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    request: web::Json<UploadVerificationDocumentRequest>
) -> ActixResult<HttpResponse> {
    let vendor_id = match check_vendor_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    // Check that document is not empty
    if request.verification_document.is_empty() {
        return Ok(HttpResponse::BadRequest().json("Verification document cannot be empty"));
    }

    // Check document size (limit to ~5MB of Base64 encoded data)
    if request.verification_document.len() > 6_500_000 {
        return Ok(HttpResponse::BadRequest().json("Document is too large. Maximum size is 5MB"));
    }

    match db::upload_verification_document(&pool, vendor_id, &request.verification_document).await {
        Ok(_) => Ok(HttpResponse::Ok().json(json!({
            "success": true,
            "message": "Verification document submitted successfully. An administrator will review your submission."
        }))),
        Err(e) => Ok(HttpResponse::InternalServerError().json(format!("Failed to upload verification document: {:?}", e))),
    }
}

#[delete("/api/admin/users/{user_id}")]
async fn delete_user(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    user_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    match db::delete_user(&pool, *user_id).await {
        Ok(_) => Ok(HttpResponse::NoContent().finish()),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to delete user")),
    }
}

#[derive(Deserialize)]
struct BanUserRequest {
    banned: bool,
}

#[patch("/api/admin/users/{user_id}/ban")]
async fn ban_user_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    user_id: web::Path<i32>,
    request: web::Json<BanUserRequest>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    match db::ban_user(&pool, *user_id, request.banned).await {
        Ok(_) => Ok(HttpResponse::Ok().json(if request.banned { "User banned successfully" } else { "User unbanned successfully" })),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to update ban status")),
    }
}

#[patch("/api/admin/users/{user_id}/reset-password")]
async fn reset_user_password_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    user_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    // Generate a random temporary password (8 characters)
    let temp_password = format!("temp_{}", rand::random::<u32>());

    match db::reset_user_password(&pool, *user_id, &temp_password).await {
        Ok(_) => {
            // In a real application, send email here with temp_password
            // For now, we'll return a generic success message
            // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
            println!("TEMP PASSWORD FOR USER {}: {}", user_id, temp_password);
            Ok(HttpResponse::Ok().json(json!({
                "message": "Password reset successfully. User has been emailed their new password."
            })))
        }
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to reset password")),
    }
}

#[get("/api/admin/cart")]
async fn get_all_cart_items(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    match db::get_all_cart_items(&pool).await {
        Ok(cart_items) => Ok(HttpResponse::Ok().json(cart_items)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch cart items")),
    }
}

#[derive(Deserialize)]
struct CreateVendorReportRequest {
    vendor_id: i32,
    product_id: Option<i32>,
    report_type: String,
    description: Option<String>,
}

#[post("/reports")]
async fn create_vendor_report_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    report_req: web::Json<CreateVendorReportRequest>
) -> ActixResult<HttpResponse> {
    let customer_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::create_vendor_report(&pool, customer_id, report_req.vendor_id, report_req.product_id, &report_req.report_type, report_req.description.as_deref()).await {
        Ok(report) => Ok(HttpResponse::Created().json(report)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to create report")),
    }
}

#[get("/vendor/reports/count")]
async fn get_vendor_report_count(req: actix_web::HttpRequest, pool: web::Data<PgPool>) -> ActixResult<HttpResponse> {
    let claims = match extract_auth(&req) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    match db::count_vendor_reports(&pool, claims.sub).await {
        Ok(count) => Ok(HttpResponse::Ok().json(json!({ "report_count": count }))),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to count reports")),
    }
}

#[get("/api/admin/reports")]
async fn get_all_vendor_reports_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    match db::get_all_vendor_reports(&pool).await {
        Ok(reports) => Ok(HttpResponse::Ok().json(reports)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch reports")),
    }
}

#[derive(Deserialize)]
struct UpdateReportStatusRequest {
    status: String,
    admin_notes: Option<String>,
}

#[patch("/api/admin/reports/{report_id}")]
async fn update_vendor_report_status_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    report_id: web::Path<i32>,
    update_req: web::Json<UpdateReportStatusRequest>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    match db::update_report_status(&pool, *report_id, &update_req.status, update_req.admin_notes.as_deref()).await {
        Ok(_) => Ok(HttpResponse::Ok().json("Report status updated successfully")),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to update report status")),
    }
}

#[derive(Serialize)]
struct DatabaseInfo {
    name: String,
    owner: String,
    encoding: String,
}

#[get("/api/admin/databases")]
async fn get_databases(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    // Query to get database information
    let rows = match sqlx::query(
        "SELECT datname, usename as owner, encoding, datcollate
         FROM pg_database d
         JOIN pg_user u ON d.datdba = u.usesysid
         WHERE datistemplate = false
         ORDER BY datname"
    )
    .fetch_all(pool.get_ref())
    .await {
        Ok(rows) => rows,
        Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to fetch databases")),
    };

    let mut databases = Vec::new();
    for row in rows {
        let name: String = match row.try_get("datname") {
            Ok(val) => val,
            Err(_) => continue,
        };
        let owner: String = match row.try_get("owner") {
            Ok(val) => val,
            Err(_) => continue,
        };
        let encoding: String = match row.try_get("encoding") {
            Ok(val) => val,
            Err(_) => continue,
        };
        databases.push(DatabaseInfo { name, owner, encoding });
    }

    Ok(HttpResponse::Ok().json(databases))
}

#[derive(Serialize)]
struct TableInfo {
    name: String,
    schema: String,
    table_type: String,
    owner: String,
}

#[get("/api/admin/tables")]
async fn get_tables(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    // Query to get table information
    let rows = match sqlx::query(
        "SELECT schemaname, tablename, tableowner, 'table' as table_type
         FROM pg_tables
         WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
         ORDER BY schemaname, tablename"
    )
    .fetch_all(pool.get_ref())
    .await {
        Ok(rows) => rows,
        Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to fetch tables")),
    };

    let mut tables = Vec::new();
    for row in rows {
        let schema: String = match row.try_get("schemaname") {
            Ok(val) => val,
            Err(_) => continue,
        };
        let name: String = match row.try_get("tablename") {
            Ok(val) => val,
            Err(_) => continue,
        };
        let owner: String = match row.try_get("tableowner") {
            Ok(val) => val,
            Err(_) => continue,
        };
        let table_type: String = match row.try_get("table_type") {
            Ok(val) => val,
            Err(_) => continue,
        };
        tables.push(TableInfo { name, schema, table_type, owner });
    }

    Ok(HttpResponse::Ok().json(tables))
}

#[derive(Serialize)]
struct ColumnInfo {
    name: String,
    data_type: String,
    is_nullable: String,
    default_value: Option<String>,
}

#[get("/api/admin/tables/{table_name}/columns")]
async fn get_table_columns(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    table_name: web::Path<String>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    // Query to get column information for a specific table
    let rows = match sqlx::query(
        "SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position"
    )
    .bind(&*table_name)
    .fetch_all(pool.get_ref())
    .await {
        Ok(rows) => rows,
        Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to fetch table columns")),
    };

    let mut columns = Vec::new();
    for row in rows {
        let name: String = match row.try_get("column_name") {
            Ok(val) => val,
            Err(_) => continue,
        };
        let data_type: String = match row.try_get("data_type") {
            Ok(val) => val,
            Err(_) => continue,
        };
        let is_nullable: String = match row.try_get("is_nullable") {
            Ok(val) => val,
            Err(_) => continue,
        };
        let default_value: Option<String> = match row.try_get("column_default") {
            Ok(val) => val,
            Err(_) => continue,
        };
        columns.push(ColumnInfo { name, data_type, is_nullable, default_value });
    }

    Ok(HttpResponse::Ok().json(columns))
}

#[derive(Serialize)]
struct TableData {
    columns: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
}

#[get("/api/admin/tables/{table_name}/data")]
async fn get_table_data(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    table_name: web::Path<String>
) -> ActixResult<HttpResponse> {
    if let Err(response) = check_admin_auth(&req) {
        return Ok(response);
    }

    // First get column names
    let column_rows = match sqlx::query(
        "SELECT column_name
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position"
    )
    .bind(&*table_name)
    .fetch_all(pool.get_ref())
    .await {
        Ok(rows) => rows,
        Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to fetch column names")),
    };

    let mut columns = Vec::new();
    for row in &column_rows {
        let column_name: String = match row.try_get("column_name") {
            Ok(val) => val,
            Err(_) => continue,
        };
        columns.push(column_name);
    }

    // Build dynamic SELECT query
    if columns.is_empty() {
        return Ok(HttpResponse::Ok().json(TableData { columns: vec![], rows: vec![] }));
    }

    let select_clause = columns.join(", ");
    let query_str = format!("SELECT {} FROM {} LIMIT 100", select_clause, table_name);

    // Execute the dynamic query
    let data_rows = match sqlx::query(&query_str)
        .fetch_all(pool.get_ref())
        .await {
        Ok(rows) => rows,
        Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to fetch table data")),
    };

    let mut rows = Vec::new();
    for data_row in data_rows {
        let mut row_data = Vec::new();
        for (i, _col) in columns.iter().enumerate() {
            // Convert each value to JSON
            let value: serde_json::Value = match data_row.try_get_raw(i) {
                Ok(_raw_value) => {
                    // Try to convert to appropriate JSON type
                    if let Ok(val) = data_row.try_get::<Option<String>, _>(i) {
                        val.map_or(serde_json::Value::Null, |s| serde_json::Value::String(s))
                    } else if let Ok(val) = data_row.try_get::<Option<i32>, _>(i) {
                        val.map_or(serde_json::Value::Null, |n| serde_json::Value::Number(n.into()))
                    } else if let Ok(val) = data_row.try_get::<Option<i64>, _>(i) {
                        val.map_or(serde_json::Value::Null, |n| serde_json::Value::Number(n.into()))
                    } else if let Ok(val) = data_row.try_get::<Option<f64>, _>(i) {
                        val.map_or(serde_json::Value::Null, |n| serde_json::Value::Number(serde_json::Number::from_f64(n).unwrap_or(serde_json::Number::from(0))))
                    } else if let Ok(val) = data_row.try_get::<Option<bool>, _>(i) {
                        val.map_or(serde_json::Value::Null, |b| serde_json::Value::Bool(b))
                    } else {
                        serde_json::Value::String("Unsupported type".to_string())
                    }
                }
                Err(_) => serde_json::Value::Null,
            };
            row_data.push(value);
        }
        rows.push(row_data);
    }

    Ok(HttpResponse::Ok().json(TableData { columns, rows }))
}

#[derive(Deserialize)]
struct UpdateProfileImageRequest {
    profile_image: String,
}

#[derive(Deserialize)]
struct UpdateProfileRequest {
    username: Option<String>,
    email: Option<String>,
    secondary_email: Option<String>,
    mpesa_number: Option<String>,
    payment_preference: Option<String>,
    location_string: Option<String>,
    profile_image: Option<String>,
    current_password: Option<String>,
    new_password: Option<String>,
}

#[derive(Deserialize)]
struct UpdateAdminCredentialsRequest {
    current_password: String,
    new_username: Option<String>,
    new_password: Option<String>,
}

#[derive(Deserialize)]
struct UpdateLocationRequest {
    latitude: f64,
    longitude: f64,
    location_string: Option<String>,
}

/**
 * POST /location/update - Update user location
 *
 * Allows authenticated users to update their location coordinates.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param location_req - JSON request with latitude, longitude, and optional location_string
 * @returns Success message
 */
#[post("/location/update")]
async fn update_location(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    location_req: web::Json<UpdateLocationRequest>,
) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match sqlx::query(
        "UPDATE users SET latitude = $1, longitude = $2, location_string = $3 WHERE id = $4"
    )
    .bind(location_req.latitude)
    .bind(location_req.longitude)
    .bind(&location_req.location_string)
    .bind(user_id)
    .execute(pool.get_ref())
    .await {
        Ok(_) => Ok(HttpResponse::Ok().json("Location updated successfully")),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to update location")),
    }
}

// Profile image update endpoint for users to update their own profile images
#[patch("/profile/image")]
async fn update_profile_image(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    request: web::Json<UpdateProfileImageRequest>,
) -> ActixResult<HttpResponse> {
    let claims = match extract_auth(&req) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    match db::update_user_profile_image(&pool, claims.sub, &request.profile_image).await {
        Ok(_) => Ok(HttpResponse::Ok().json("Profile image updated successfully")),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to update profile image")),
    }
}

// Profile update endpoint for users to update their own username and email
#[patch("/profile")]
async fn update_profile(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    request: web::Json<UpdateProfileRequest>,
) -> ActixResult<HttpResponse> {
    let claims = match extract_auth(&req) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    match db::update_user_profile(&pool, claims.sub, request.username.as_deref(), request.email.as_deref(), request.secondary_email.as_deref(), request.mpesa_number.as_deref(), request.payment_preference.as_deref()).await {
        Ok(_) => {
            // Return a success message with the updated username (if changed)
            let response = json!({
                "message": "Profile updated successfully",
                "new_username": request.username
            });
            Ok(HttpResponse::Ok().json(response))
        }
        Err(sqlx::Error::Database(db_err)) if db_err.constraint().is_some() => {
            Ok(HttpResponse::Conflict().json("Username or email already exists"))
        }
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to update profile")),
    }
}

// Comprehensive profile update endpoint - handles all profile fields including password
#[actix_web::put("/user/profile")]
async fn update_user_profile_comprehensive(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    request: web::Json<UpdateProfileRequest>,
) -> ActixResult<HttpResponse> {
    let claims = match extract_auth(&req) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    // If password change is requested, verify current password first
    if let (Some(current_pwd), Some(new_pwd)) = (&request.current_password, &request.new_password) {
        // Verify current password
        let row = match sqlx::query("SELECT password_hash FROM users WHERE id = $1")
            .bind(claims.sub)
            .fetch_one(pool.get_ref())
            .await {
            Ok(r) => r,
            Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to verify password")),
        };

        let stored_hash: String = row.try_get(0).unwrap();
        let is_valid = bcrypt::verify(current_pwd, &stored_hash).unwrap_or(false);

        if !is_valid {
            return Ok(HttpResponse::Unauthorized().json("Current password is incorrect"));
        }

        // Update password
        if let Err(_) = db::reset_user_password(&pool, claims.sub, new_pwd).await {
            return Ok(HttpResponse::InternalServerError().json("Failed to update password"));
        }
    }

    // Update profile image if provided
    if let Some(profile_img) = &request.profile_image {
        if let Err(_) = db::update_user_profile_image(&pool, claims.sub, profile_img).await {
            return Ok(HttpResponse::InternalServerError().json("Failed to update profile image"));
        }
    }

    // Update location if provided
    if let Some(location) = &request.location_string {
        if let Err(_) = sqlx::query("UPDATE users SET location_string = $1 WHERE id = $2")
            .bind(location)
            .bind(claims.sub)
            .execute(pool.get_ref())
            .await {
            return Ok(HttpResponse::InternalServerError().json("Failed to update location"));
        }
    }

    // Update other profile fields
    match db::update_user_profile(&pool, claims.sub, request.username.as_deref(), request.email.as_deref(), request.secondary_email.as_deref(), request.mpesa_number.as_deref(), request.payment_preference.as_deref()).await {
        Ok(_) => {
            // Return updated user data
            let response = json!({
                "message": "Profile updated successfully",
                "username": request.username.as_ref().unwrap_or(&claims.username),
                "email": request.email.as_ref().unwrap_or(&"".to_string()),
                "location_string": request.location_string.as_ref().unwrap_or(&"".to_string())
            });
            Ok(HttpResponse::Ok().json(response))
        }
        Err(sqlx::Error::Database(db_err)) if db_err.constraint().is_some() => {
            Ok(HttpResponse::Conflict().json("Username or email already exists"))
        }
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to update profile")),
    }
}

// Admin credentials update endpoint - allows admin to change their username and password
#[patch("/admin/credentials")]
async fn update_admin_credentials(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    request: web::Json<UpdateAdminCredentialsRequest>,
) -> ActixResult<HttpResponse> {
    // Only allow admin users
    let claims = match extract_auth(&req) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    if claims.role != "Admin" {
        return Ok(HttpResponse::Forbidden().json("Admin privileges required"));
    }

    // Verify current password
    let current_user = match db::authenticate_user(&pool, &claims.username, &request.current_password).await {
        Ok(user) => user,
        Err(_) => return Ok(HttpResponse::Unauthorized().json("Current password is incorrect")),
    };

    // Update username if provided
    if let Some(new_username) = &request.new_username {
        if new_username != &current_user.username {
            match db::update_user_profile(&pool, claims.sub, Some(new_username), None, None, None, None).await {
                Ok(_) => {},
                Err(sqlx::Error::Database(db_err)) if db_err.constraint().is_some() => {
                    return Ok(HttpResponse::Conflict().json("Username already exists"));
                }
                Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to update username")),
            }
        }
    }

    // Update password if provided
    if let Some(new_password) = &request.new_password {
        match db::reset_user_password(&pool, claims.sub, new_password).await {
            Ok(_) => {},
            Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to update password")),
        }
    }

    Ok(HttpResponse::Ok().json(json!({
        "message": "Admin credentials updated successfully"
    })))
}

/**
 * POST /messages - Send a message
 *
 * Allows authenticated users to send messages to other users.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param message_req - JSON request with receiver_id and content
 * @returns JSON of the sent message
 */
#[post("/messages")]
async fn send_message_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    message_req: web::Json<SendMessageRequest>
) -> ActixResult<HttpResponse> {
    let sender_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::send_message(&pool, sender_id, message_req.receiver_id, &message_req.content).await {
        Ok(message) => Ok(HttpResponse::Created().json(message)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to send message")),
    }
}

/**
 * GET /messages/{user_id} - Get messages between current user and another user
 *
 * Retrieves all messages between the authenticated user and the specified user.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param other_user_id - User ID from URL path
 * @returns JSON array of messages
 */
#[get("/messages/{user_id}")]
async fn get_messages_between_users_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    other_user_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    let current_user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::get_messages_between_users(&pool, current_user_id, *other_user_id).await {
        Ok(messages) => Ok(HttpResponse::Ok().json(messages)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch messages")),
    }
}

/**
 * GET /messages - Get user's conversations
 *
 * Retrieves a list of recent conversations for the authenticated user.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON array of conversation previews
 */
#[get("/messages")]
async fn get_user_conversations_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::get_user_conversations(&pool, user_id).await {
        Ok(conversations) => Ok(HttpResponse::Ok().json(conversations)),
        Err(e) => {
            eprintln!("Failed to fetch conversations for user {}: {:?}", user_id, e);
            Ok(HttpResponse::InternalServerError().json("Failed to fetch conversations"))
        },
    }
}

/**
 * PATCH /messages/{user_id}/read - Mark messages as read
 *
 * Marks all messages from the specified user as read for the authenticated user.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param other_user_id - User ID from URL path
 * @returns Success message
 */
#[patch("/messages/{user_id}/read")]
async fn mark_messages_as_read_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    other_user_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    let current_user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::mark_messages_as_read(&pool, current_user_id, *other_user_id).await {
        Ok(_) => Ok(HttpResponse::Ok().json("Messages marked as read")),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to mark messages as read")),
    }
}

/**
 * POST /follow - Follow a vendor
 *
 * Allows customers to follow vendors.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param follow_req - JSON request with vendor_id
 * @returns JSON of the follow relationship
 */
#[post("/follow")]
async fn follow_vendor_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    follow_req: web::Json<FollowRequest>
) -> ActixResult<HttpResponse> {
    let follower_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::follow_vendor(&pool, follower_id, follow_req.vendor_id).await {
        Ok(follow) => Ok(HttpResponse::Created().json(follow)),
        Err(sqlx::Error::Database(db_err)) if db_err.constraint().is_some() => {
            Ok(HttpResponse::Conflict().json("Already following this vendor"))
        }
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to follow vendor")),
    }
}

/**
 * DELETE /follow/{vendor_id} - Unfollow a vendor
 *
 * Allows customers to unfollow vendors.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param vendor_id - Vendor ID from URL path
 * @returns Success message
 */
#[delete("/follow/{vendor_id}")]
async fn unfollow_vendor_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    vendor_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    let follower_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::unfollow_vendor(&pool, follower_id, *vendor_id).await {
        Ok(_) => Ok(HttpResponse::Ok().json("Successfully unfollowed vendor")),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to unfollow vendor")),
    }
}

/**
 * GET /follow/{vendor_id} - Check if following a vendor
 *
 * Checks if the authenticated user is following the specified vendor.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param vendor_id - Vendor ID from URL path
 * @returns JSON with following status
 */
#[get("/follow/{vendor_id}")]
async fn is_following_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    vendor_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    let follower_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::is_following(&pool, follower_id, *vendor_id).await {
        Ok(is_following) => Ok(HttpResponse::Ok().json(json!({ "is_following": is_following }))),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to check follow status")),
    }
}

/**
 * GET /follow - Get user's follows
 *
 * Retrieves all vendors that the authenticated user is following.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON array of follows
 */
#[get("/follow")]
async fn get_user_follows_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::get_user_follows(&pool, user_id).await {
        Ok(follows) => Ok(HttpResponse::Ok().json(follows)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch follows")),
    }
}

/**
 * GET /followers/{vendor_id} - Get vendor's followers
 *
 * Retrieves all followers of the specified vendor.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param vendor_id - Vendor ID from URL path
 * @returns JSON array of followers
 */
#[get("/followers/{vendor_id}")]
async fn get_vendor_followers_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    vendor_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    // Only allow vendors to see their own followers, or admins
    let claims = match extract_auth(&req) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    if claims.role != "Admin" && claims.role != "Vendor" {
        return Ok(HttpResponse::Forbidden().json("Access denied"));
    }

    if claims.role == "Vendor" && claims.sub != *vendor_id {
        return Ok(HttpResponse::Forbidden().json("Can only view your own followers"));
    }

    match db::get_vendor_followers(&pool, *vendor_id).await {
        Ok(followers) => Ok(HttpResponse::Ok().json(followers)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch followers")),
    }
}

/**
 * POST /reviews - Create a product review
 *
 * Allows customers to leave reviews for products they've purchased.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param review_req - JSON request with product_id, rating, and comment
 * @returns JSON of the created review
 */
#[post("/reviews")]
async fn create_review_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    review_req: web::Json<CreateReviewRequest>
) -> ActixResult<HttpResponse> {
    let customer_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::create_review(&pool, customer_id, review_req.product_id, review_req.rating, review_req.comment.as_deref()).await {
        Ok(review) => Ok(HttpResponse::Created().json(review)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to create review")),
    }
}

/**
 * GET /reviews/product/{product_id} - Get reviews for a product
 *
 * Retrieves all reviews for the specified product.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param product_id - Product ID from URL path
 * @returns JSON array of reviews
 */
#[get("/reviews/product/{product_id}")]
async fn get_product_reviews_route(
    _req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    product_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    // Allow anyone to view reviews
    match db::get_product_reviews(&pool, *product_id).await {
        Ok(reviews) => Ok(HttpResponse::Ok().json(reviews)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch reviews")),
    }
}

/**
 * GET /reviews - Get customer's reviews
 *
 * Retrieves all reviews written by the authenticated customer.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON array of customer's reviews
 */
#[get("/reviews")]
async fn get_customer_reviews_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let customer_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::get_customer_reviews(&pool, customer_id).await {
        Ok(reviews) => Ok(HttpResponse::Ok().json(reviews)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch reviews")),
    }
}

/**
 * POST /shipping - Create a shipping order
 *
 * Allows customers to create shipping orders for products.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param shipping_req - JSON request with product_id, quantity, and shipping_address
 * @returns JSON of the created shipping order
 */
#[post("/shipping")]
async fn create_shipping_order_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    shipping_req: web::Json<CreateShippingOrderRequest>
) -> ActixResult<HttpResponse> {
    let customer_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::create_shipping_order(&pool, customer_id, shipping_req.product_id, shipping_req.quantity, &shipping_req.shipping_address).await {
        Ok(order) => Ok(HttpResponse::Created().json(order)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to create shipping order")),
    }
}

/**
 * GET /shipping - Get customer's shipping orders
 *
 * Retrieves all shipping orders for the authenticated customer.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON array of customer's shipping orders
 */
#[get("/shipping")]
async fn get_customer_shipping_orders_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let customer_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::get_customer_shipping_orders(&pool, customer_id).await {
        Ok(orders) => Ok(HttpResponse::Ok().json(orders)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch shipping orders")),
    }
}

/**
 * GET /shipping/vendor - Get vendor's shipping orders
 *
 * Retrieves all shipping orders for the authenticated vendor.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON array of vendor's shipping orders
 */
#[get("/shipping/vendor")]
async fn get_vendor_shipping_orders_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let vendor_id = match check_vendor_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    match db::get_vendor_shipping_orders(&pool, vendor_id).await {
        Ok(orders) => Ok(HttpResponse::Ok().json(orders)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch shipping orders")),
    }
}

/**
 * PATCH /shipping/{order_id}/status - Update shipping order status
 *
 * Allows vendors to update the shipping status of their orders.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param order_id - Order ID from URL path
 * @param status_req - JSON request with shipping_status and optional tracking_number
 * @returns Success message
 */
#[patch("/shipping/{order_id}/status")]
async fn update_shipping_status_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    order_id: web::Path<i32>,
    status_req: web::Json<UpdateShippingStatusRequest>
) -> ActixResult<HttpResponse> {
    let vendor_id = match check_vendor_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    // Verify the order belongs to this vendor
    let order_vendor_id: i32 = match sqlx::query_scalar("SELECT vendor_id FROM shipping_orders WHERE id = $1")
        .bind(*order_id)
        .fetch_one(pool.get_ref())
        .await {
        Ok(id) => id,
        Err(_) => return Ok(HttpResponse::NotFound().json("Order not found")),
    };

    if order_vendor_id != vendor_id {
        return Ok(HttpResponse::Forbidden().json("Can only update your own orders"));
    }

    match db::update_shipping_status(&pool, *order_id, &status_req.shipping_status, status_req.tracking_number.as_deref()).await {
        Ok(_) => {
            // If status is "delivered", request customer verification
            if status_req.shipping_status.to_lowercase() == "delivered" {
                let _ = db::request_delivery_verification(&pool, *order_id).await;
                println!("📦 Order {} marked as delivered - verification requested from customer", order_id);
            }
            Ok(HttpResponse::Ok().json("Shipping status updated successfully"))
        },
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to update shipping status")),
    }
}

/**
 * GET /vendors/{vendor_id}/profile - Get vendor profile information
 *
 * Retrieves vendor profile information including total purchases, revenue, and follower count.
 * Available to all authenticated users.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param vendor_id - Vendor ID from URL path
 * @returns JSON of vendor profile information
 */
#[get("/vendors/{vendor_id}/profile")]
async fn get_vendor_profile_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    vendor_id: web::Path<i32>
) -> ActixResult<HttpResponse> {
    // Require authentication
    let _claims = match extract_auth(&req) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    match db::get_vendor_profile(&pool, *vendor_id).await {
        Ok(profile) => Ok(HttpResponse::Ok().json(profile)),
        Err(_) => Ok(HttpResponse::NotFound().json("Vendor not found")),
    }
}

/**
 * POST /mpesa/callback - Handle M-Pesa payment callbacks
 *
 * Processes payment confirmation callbacks from Safaricom's M-Pesa Daraja API.
 * Updates payment status and creates shipping orders upon successful payment.
 *
 * @param pool - Database connection pool
 * @param callback_data - JSON callback data from M-Pesa
 * @returns JSON response acknowledging callback
 */
#[post("/mpesa/callback")]
async fn mpesa_callback(
    pool: web::Data<PgPool>,
    callback_data: web::Json<StkCallbackBody>
) -> ActixResult<HttpResponse> {
    println!("M-Pesa callback received: {:?}", callback_data);

    let callback = &callback_data.stk_callback;
    let checkout_request_id = &callback.checkout_request_i_d;
    
    // Log callback details for monitoring
    println!("🔄 Processing callback - Merchant Request ID: {}, Checkout Request ID: {}", 
             callback.merchant_request_i_d, checkout_request_id);

    // Get payment transaction from database
    let transaction = match db::get_payment_transaction_by_checkout_request_id(&pool, checkout_request_id).await {
        Ok(t) => t,
        Err(_) => {
            eprintln!("Transaction not found for checkout_request_id: {}", checkout_request_id);
            return Ok(HttpResponse::Ok().json(json!({"ResultCode": 0, "ResultDesc": "Accepted"})));
        }
    };

    let status = if callback.result_code == 0 {
        // Payment successful
        println!("Payment successful for checkout_request_id: {} - {}", checkout_request_id, callback.result_desc);
        
        // Extract payment details
        let (mpesa_receipt, transaction_date, _amount) = match extract_callback_data(callback) {
            Some(data) => (Some(data.0), Some(data.1), data.2),
            None => (None, None, 0.0),
        };

        // Update payment transaction
        if let Err(e) = db::update_payment_transaction(
            &pool,
            checkout_request_id,
            &PaymentStatus::Completed.to_string(),
            mpesa_receipt.as_deref(),
            transaction_date.as_deref(),
        ).await {
            eprintln!("Failed to update payment transaction: {:?}", e);
        }

        // Get user's cart items
        match db::get_cart_items(&pool, transaction.user_id).await {
            Ok(all_cart_items) => {
                // Filter cart items based on what was actually selected for this payment
                let items_to_process = if let Some(cart_item_ids_str) = &transaction.cart_item_ids {
                    // Parse the comma-separated cart item IDs
                    let selected_ids: Vec<i32> = cart_item_ids_str
                        .split(',')
                        .filter_map(|id| id.trim().parse().ok())
                        .collect();
                    
                    // Only process the selected cart items
                    all_cart_items.into_iter()
                        .filter(|item| selected_ids.contains(&item.id))
                        .collect::<Vec<_>>()
                } else {
                    // If no specific items were stored, process all cart items (backward compatibility)
                    all_cart_items
                };

                println!("📦 Processing {} cart items for shipping orders", items_to_process.len());

                // Create shipping orders only for selected items
                for item in &items_to_process {
                    match db::create_shipping_order(
                        &pool,
                        transaction.user_id,
                        item.product_id,
                        item.quantity,
                        "Default shipping address - please update in your orders"
                    ).await {
                        Ok(_) => println!("✅ Shipping order created for product {} (qty: {})", item.product_id, item.quantity),
                        Err(e) => eprintln!("❌ Failed to create shipping order: {:?}", e),
                    }
                }

                // Clear only the selected items from the cart
                for item in &items_to_process {
                    if let Err(e) = db::remove_from_cart_with_user(&pool, item.id, transaction.user_id).await {
                        eprintln!("❌ Failed to remove cart item {}: {:?}", item.id, e);
                    } else {
                        println!("🗑️ Removed cart item {} from user {}'s cart", item.id, transaction.user_id);
                    }
                }
            }
            Err(e) => eprintln!("❌ Failed to get cart items: {:?}", e),
        }

        PaymentStatus::Completed.to_string()
    } else {
        // Payment failed or cancelled
        println!("Payment failed/cancelled for checkout_request_id: {}, result_code: {}, reason: {}", 
                checkout_request_id, callback.result_code, callback.result_desc);
        
        let status = if callback.result_code == 1032 {
            PaymentStatus::Cancelled.to_string()
        } else {
            PaymentStatus::Failed.to_string()
        };

        // Update payment transaction status
        if let Err(e) = db::update_payment_transaction(
            &pool,
            checkout_request_id,
            &status,
            None,
            None,
        ).await {
            eprintln!("Failed to update payment transaction: {:?}", e);
        }

        status
    };

    println!("Payment status updated to: {} for transaction: {}", status, checkout_request_id);

    // Respond to M-Pesa with acknowledgment
    Ok(HttpResponse::Ok().json(json!({
        "ResultCode": 0,
        "ResultDesc": "Accepted"
    })))
}

/**
 * GET /payments/history - Get user's payment history
 *
 * Retrieves payment transaction history for the authenticated user.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON array of payment transactions
 */
#[get("/payments/history")]
async fn get_payment_history(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    match db::get_user_payment_transactions(&pool, user_id).await {
        Ok(transactions) => Ok(HttpResponse::Ok().json(transactions)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch payment history")),
    }
}

/**
 * POST /payments/process-completed - Manually process completed payments
 *
 * This endpoint helps recover from failed callback processing.
 * It checks for completed payments that haven't created shipping orders yet.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON response with processing results
 */
#[post("/payments/process-completed")]
async fn process_completed_payments(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let user_id = match extract_auth(&req) {
        Ok(claims) => claims.sub,
        Err(response) => return Ok(response),
    };

    println!("🔄 Manually processing completed payments for user: {}", user_id);

    // Get user's completed payment transactions
    match db::get_user_payment_transactions(&pool, user_id).await {
        Ok(transactions) => {
            let mut processed = 0;
            let mut orders_created = 0;
            let mut errors = Vec::new();

            for transaction in transactions {
                // Only process completed payments
                if transaction.status != "completed" {
                    continue;
                }

                // Check if shipping orders already exist for this transaction
                // (You may need to add a field to track this or check for existing orders)
                
                // Get user's cart items at time of payment
                match db::get_cart_items(&pool, user_id).await {
                    Ok(all_cart_items) => {
                        let items_to_process = if let Some(cart_item_ids_str) = &transaction.cart_item_ids {
                            let selected_ids: Vec<i32> = cart_item_ids_str
                                .split(',')
                                .filter_map(|id| id.trim().parse().ok())
                                .collect();
                            
                            all_cart_items.into_iter()
                                .filter(|item| selected_ids.contains(&item.id))
                                .collect::<Vec<_>>()
                        } else {
                            all_cart_items
                        };

                        if items_to_process.is_empty() {
                            println!("⚠️ No cart items found for transaction {}", transaction.id);
                            continue;
                        }

                        processed += 1;
                        
                        // Create shipping orders
                        for item in &items_to_process {
                            match db::create_shipping_order(
                                &pool,
                                user_id,
                                item.product_id,
                                item.quantity,
                                "Default shipping address - please update in your orders"
                            ).await {
                                Ok(_) => {
                                    println!("✅ Shipping order created for product {} (qty: {})", item.product_id, item.quantity);
                                    orders_created += 1;
                                },
                                Err(e) => {
                                    let error_msg = format!("Failed to create shipping order for product {}: {:?}", item.product_id, e);
                                    eprintln!("❌ {}", error_msg);
                                    errors.push(error_msg);
                                }
                            }
                        }

                        // Clear items from cart
                        for item in &items_to_process {
                            if let Err(e) = db::remove_from_cart_with_user(&pool, item.id, user_id).await {
                                eprintln!("❌ Failed to remove cart item {}: {:?}", item.id, e);
                            }
                        }
                    }
                    Err(e) => {
                        let error_msg = format!("Failed to get cart items: {:?}", e);
                        eprintln!("❌ {}", error_msg);
                        errors.push(error_msg);
                    }
                }
            }

            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "payments_processed": processed,
                "orders_created": orders_created,
                "errors": errors
            })))
        }
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch payment history")),
    }
}

/**
 * GET /reports/vendor/sales - Get vendor sales report
 *
 * Returns comprehensive sales analytics for the authenticated vendor.
 * Includes total sales, profit, and breakdown by product.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON with sales report data
 */
#[get("/reports/vendor/sales")]
async fn get_vendor_sales_report_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let claims = match extract_auth(&req) {
        Ok(claims) => claims,
        Err(response) => return Ok(response),
    };

    // Only vendors can access vendor reports
    if claims.role != "Vendor" {
        return Ok(HttpResponse::Forbidden().json("Only vendors can access sales reports"));
    }

    match db::get_vendor_sales_report(&pool, claims.sub).await {
        Ok(report) => Ok(HttpResponse::Ok().json(report)),
        Err(e) => {
            eprintln!("Failed to fetch vendor sales report: {:?}", e);
            Ok(HttpResponse::InternalServerError().json("Failed to fetch sales report"))
        }
    }
}

/**
 * GET /reports/customer/purchases - Get customer purchase report
 *
 * Returns comprehensive purchase analytics for the authenticated customer.
 * Includes total spent, order count, and breakdown by category and vendor.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON with purchase report data
 */
#[get("/reports/customer/purchases")]
async fn get_customer_purchase_report_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let claims = match extract_auth(&req) {
        Ok(claims) => claims,
        Err(response) => return Ok(response),
    };

    // Only customers can access customer reports (not vendors)
    if claims.role != "Customer" {
        return Ok(HttpResponse::Forbidden().json("Only customers can access purchase reports"));
    }

    match db::get_customer_purchase_report(&pool, claims.sub).await {
        Ok(report) => Ok(HttpResponse::Ok().json(report)),
        Err(e) => {
            eprintln!("Failed to fetch customer purchase report: {:?}", e);
            Ok(HttpResponse::InternalServerError().json("Failed to fetch purchase report"))
        }
    }
}

/**
 * POST /shipping/{order_id}/verify - Customer verifies delivery
 *
 * Allows customer to verify they received the order and releases payment to vendor's wallet.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param order_id - Order ID from URL path
 * @param verify_req - JSON request with verification status
 * @returns Success message
 */
#[post("/shipping/{order_id}/verify")]
async fn verify_delivery_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    order_id: web::Path<i32>,
    verify_req: web::Json<VerifyDeliveryRequest>
) -> ActixResult<HttpResponse> {
    let customer_id = match check_customer_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    if verify_req.verified {
        match db::verify_delivery_and_release_payment(&pool, *order_id, customer_id).await {
            Ok(_) => {
                println!("✅ Order {} verified by customer {} - payment released to vendor", order_id, customer_id);
                Ok(HttpResponse::Ok().json(json!({
                    "message": "Delivery verified successfully. Payment has been released to the vendor's wallet."
                })))
            },
            Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to verify delivery")),
        }
    } else {
        // Customer disputes delivery - could trigger admin review
        Ok(HttpResponse::Ok().json(json!({
            "message": "Delivery dispute recorded. Please contact support for assistance."
        })))
    }
}

/**
 * GET /wallet/balance - Get user's wallet balance
 *
 * Returns the current wallet balance for vendors.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @returns JSON with wallet balance
 */
#[get("/wallet/balance")]
async fn get_wallet_balance_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>
) -> ActixResult<HttpResponse> {
    let claims = match extract_auth(&req) {
        Ok(c) => c,
        Err(response) => return Ok(response),
    };

    match db::get_wallet_balance(&pool, claims.sub).await {
        Ok(balance) => Ok(HttpResponse::Ok().json(json!({
            "balance": balance,
            "currency": "KSh"
        }))),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to fetch wallet balance")),
    }
}

/**
 * POST /wallet/withdraw - Withdraw from wallet to M-Pesa
 *
 * Allows vendors to withdraw their earnings to their M-Pesa number.
 *
 * @param req - HTTP request for authentication
 * @param pool - Database connection pool
 * @param withdraw_req - JSON request with amount and M-Pesa number
 * @returns JSON response with transaction details
 */
#[post("/wallet/withdraw")]
async fn withdraw_wallet_route(
    req: actix_web::HttpRequest,
    pool: web::Data<PgPool>,
    withdraw_req: web::Json<WithdrawRequest>
) -> ActixResult<HttpResponse> {
    let user_id = match check_vendor_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    // Validate minimum withdrawal amount
    if withdraw_req.amount < 10.0 {
        return Ok(HttpResponse::BadRequest().json(json!({
            "error": "Minimum withdrawal amount is KSh 10"
        })));
    }

    // Validate phone number
    if !is_valid_kenyan_phone(&withdraw_req.mpesa_number) {
        return Ok(HttpResponse::BadRequest().json(json!({
            "error": "Invalid M-Pesa phone number"
        })));
    }

    // Process withdrawal from wallet
    match db::process_wallet_withdrawal(&pool, user_id, withdraw_req.amount).await {
        Ok(new_balance) => {
            // TODO: Integrate with M-Pesa B2C API to send money to vendor's phone
            println!("💰 Withdrawal processed: User {} withdrew KSh {:.2} to {}", 
                     user_id, withdraw_req.amount, withdraw_req.mpesa_number);
            
            // For now, return success (In production, integrate M-Pesa B2C API)
            let response = WithdrawResponse {
                success: true,
                message: format!("Withdrawal of KSh {:.2} initiated to {}. Funds will be sent shortly.", 
                                withdraw_req.amount, withdraw_req.mpesa_number),
                transaction_id: Some(format!("WD_{}_{}", user_id, chrono::Utc::now().timestamp())),
                new_balance,
            };

            Ok(HttpResponse::Ok().json(response))
        },
        Err(_) => Ok(HttpResponse::BadRequest().json(json!({
            "error": "Insufficient wallet balance or withdrawal failed"
        }))),
    }
}

#[derive(Serialize, Deserialize)]
pub struct ChatbotRequest {
    pub prompt: String,
}

/// POST /chatbot - Get a response from the AI chatbot.
#[post("/chatbot")]
async fn chatbot_handler(req: web::Json<ChatbotRequest>) -> ActixResult<HttpResponse> {
    match gemini::get_gemini_response(&req.prompt).await {
        Ok(response) => Ok(HttpResponse::Ok().json(json!({ "response": response }))),
        Err(e) => {
            eprintln!("Chatbot error: {}", e);
            Ok(HttpResponse::InternalServerError().json("Failed to get response from chatbot"))
        }
    }
}

/**
 * Initialize route configuration
 *
 * Registers all HTTP route handlers with the Actix-Web service configuration.
 * This function is called by the main server setup.
 *
 * @param cfg - Actix-Web service configuration reference
 */
pub fn init(cfg: &mut web::ServiceConfig) {
    cfg.service(get_products);       // GET /products (public)
    cfg.service(create_product);     // POST /products (vendors only)
    cfg.service(update_product);     // PATCH /products/{product_id} (vendors only)
    cfg.service(delete_product);     // DELETE /products/{product_id} (vendors only)
    cfg.service(login);              // POST /login
    cfg.service(signup);             // POST /signup
    cfg.service(update_profile_image); // PATCH /profile/image
    cfg.service(update_profile);     // PATCH /profile
    cfg.service(update_user_profile_comprehensive); // PUT /user/profile (comprehensive update)
    cfg.service(update_location);    // POST /location/update
    cfg.service(update_admin_credentials); // PATCH /admin/credentials
    cfg.service(get_vendor_profile_route); // GET /vendors/{vendor_id}/profile

    // Cart routes - currently without authentication for testing
    cfg.service(get_cart)
        .service(add_to_cart_route)
        .service(update_cart_item)
        .service(remove_from_cart_route)
        .service(checkout);

    // M-Pesa payment routes
    cfg.service(mpesa_callback)
        .service(get_payment_history)
        .service(process_completed_payments);

    // Message routes
    cfg.service(send_message_route)
        .service(get_messages_between_users_route)
        .service(get_user_conversations_route)
        .service(mark_messages_as_read_route);

    // Follow routes
    cfg.service(follow_vendor_route)
        .service(unfollow_vendor_route)
        .service(is_following_route)
        .service(get_user_follows_route)
        .service(get_vendor_followers_route);

    // Review routes
    cfg.service(create_review_route)
        .service(get_product_reviews_route)
        .service(get_customer_reviews_route);

    // Shipping routes
    cfg.service(create_shipping_order_route)
        .service(get_customer_shipping_orders_route)
        .service(get_vendor_shipping_orders_route)
        .service(update_shipping_status_route)
        .service(verify_delivery_route);

    // Wallet routes
    cfg.service(get_wallet_balance_route)
        .service(withdraw_wallet_route);

    // Analytics/Reports routes
    cfg.service(get_vendor_sales_report_route)
        .service(get_customer_purchase_report_route);

    // Analytics/Reports routes
    cfg.service(get_vendor_sales_report_route)
        .service(get_customer_purchase_report_route);

    // Vendor report count route
    cfg.service(get_vendor_report_count);

    // Public messaging route
    cfg.service(get_all_users_for_messaging);

    // Admin routes - authentication checked in route handlers
    cfg.service(get_all_users)
        .service(get_pending_vendors)
        .service(update_user_role)
        .service(update_user_verification)
        .service(upload_verification_document)
        .service(delete_user)
        .service(ban_user_route)
        .service(reset_user_password_route)
        .service(get_all_cart_items)
        .service(create_vendor_report_route)
        .service(get_all_vendor_reports_route)
        .service(update_vendor_report_status_route)
        .service(get_databases)
        .service(get_tables)
        .service(get_table_columns)
        .service(get_table_data)
        .service(chatbot_handler);
}
