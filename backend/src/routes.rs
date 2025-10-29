/**
 * HTTP Route handlers for the Farmers Market Place API
 *
 * This module defines the REST API endpoints that the frontend React application calls.
 * All routes handle CRUD operations for products, user authentication, and registration.
 */

use actix_web::{get, post, patch, delete, web, HttpResponse, Result as ActixResult};
use sqlx::PgPool;
use crate::models::{LoginRequest, SignupRequest, ProductRequest, Role, LoginResponse, create_jwt, verify_jwt, Claims, CartItemRequest, UpdateCartItemRequest, UpdateUserRoleRequest, UpdateUserVerificationRequest};
use crate::db;  // Database helper functions
use serde::Deserialize;
use serde_json::json;

/**
 * GET /products - Retrieve all available products
 *
 * Returns a JSON array of all products currently available in the marketplace.
 * Currently uses mock data - in production this would fetch from database.
 *
 * @param _pool - PostgreSQL connection pool (not used for mock data)
 * @returns JSON array of Product objects
 */
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

    match db::get_all_products(&pool, vendor_filter).await {
        Ok(products) => Ok(HttpResponse::Ok().json(products)),
        Err(e) => Ok(HttpResponse::InternalServerError().json(format!("Failed to fetch products: {:?}", e))),
    }
}

/**
 * POST /products - Create a new product
 *
 * Allows vendors to add new products to the marketplace.
 * Currently returns mock data - in production would save to database.
 *
 * @param _pool - PostgreSQL connection pool
 * @param req - JSON request body with product details
 * @returns JSON of created product or error
 */
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
    let report_count: (i32,) = match sqlx::query_as("SELECT COUNT(*) FROM vendor_reports WHERE vendor_id = $1")
        .bind(vendor_id)
        .fetch_one(pool.get_ref())
        .await {
        Ok(result) => result,
        Err(_) => return Ok(HttpResponse::InternalServerError().json("Failed to check report count")),
    };

    if report_count.0 >= 5 {
        return Ok(HttpResponse::Forbidden().json("Account suspended due to multiple reports."));
    }

    match db::create_product(&pool, &product_req.name, product_req.price, &product_req.category, &product_req.description, product_req.image.as_deref(), vendor_id).await {
        Ok(product) => Ok(HttpResponse::Created().json(product)),
        Err(_) => Ok(HttpResponse::InternalServerError().json("Failed to create product")),
    }
}

/**
 * PUT /products/{product_id} - Update an existing product
 *
 * Allows vendors to update their own products.
 * Vendor can only update products they own.
 *
 * @param req - HTTP request for authentication
 * @param pool - PostgreSQL connection pool
 * @param product_id - Product ID from URL path
 * @param product_req - JSON request body with updated product details
 * @returns JSON of updated product or error
 */
#[patch("/products/{product_id}")]
async fn update_product(req: actix_web::HttpRequest, pool: web::Data<PgPool>, product_id: web::Path<i32>, product_req: web::Json<ProductRequest>) -> ActixResult<HttpResponse> {
    let vendor_id = match check_vendor_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    match db::update_product(&pool, *product_id, &product_req.name, product_req.price, &product_req.category, &product_req.description, product_req.image.as_deref(), vendor_id).await {
        Ok(product) => Ok(HttpResponse::Ok().json(product)),
        Err(_) => Ok(HttpResponse::BadRequest().json("Product not found or access denied")),
    }
}

/**
 * DELETE /products/{product_id} - Delete a product
 *
 * Allows vendors to delete their own products.
 * Vendor can only delete products they own.
 *
 * @param req - HTTP request for authentication
 * @param pool - PostgreSQL connection pool
 * @param product_id - Product ID from URL path
 * @returns Empty response on success
 */
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
    // Convert string role to enum, defaulting to Customer
    let role = match req.role.as_deref().unwrap_or("Customer") {
        "Vendor" => Role::Vendor,
        _ => Role::Customer,
    };

    // Attempt to create new user in database
    match db::create_user(&pool, &req.username, &req.email, &req.password, &role, req.profile_image.as_deref()).await {
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
    let user_id = match check_customer_auth(&req) {
        Ok(id) => id,
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
    let user_id = match check_customer_auth(&req) {
        Ok(id) => id,
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
    let user_id = match check_customer_auth(&req) {
        Ok(id) => id,
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
    let user_id = match check_customer_auth(&req) {
        Ok(id) => id,
        Err(response) => return Ok(response),
    };

    match db::remove_from_cart_with_user(&pool, *item_id, user_id).await {
        Ok(_) => Ok(HttpResponse::NoContent().finish()),
        Err(_) => Ok(HttpResponse::BadRequest().json("Cart item not found or access denied")),
    }
}

// Auth helpers
fn extract_auth(req: &actix_web::HttpRequest) -> Result<Claims, HttpResponse> {
    let auth_header = req.headers().get(AUTHORIZATION);
    if auth_header.is_none() {
        return Err(HttpResponse::Unauthorized().json("Authorization header missing"));
    }

    let auth_str = auth_header.unwrap().to_str().unwrap_or("");
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

#[derive(Deserialize)]
struct ResetPasswordRequest {
    new_password: String,
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

#[derive(Deserialize)]
struct UpdateProfileImageRequest {
    profile_image: String,
}

#[derive(Deserialize)]
struct UpdateProfileRequest {
    username: Option<String>,
    email: Option<String>,
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

    match db::update_user_profile(&pool, claims.sub, request.username.as_deref(), request.email.as_deref()).await {
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

    // Cart routes - currently without authentication for testing
    cfg.service(get_cart)
        .service(add_to_cart_route)
        .service(update_cart_item)
        .service(remove_from_cart_route);

    // Vendor report count route
    cfg.service(get_vendor_report_count);

    // Admin routes - authentication checked in route handlers
    cfg.service(get_all_users)
        .service(update_user_role)
        .service(update_user_verification)
        .service(delete_user)
        .service(ban_user_route)
        .service(reset_user_password_route)
        .service(get_all_cart_items)
        .service(create_vendor_report_route)
        .service(get_all_vendor_reports_route)
        .service(update_vendor_report_status_route);
}
