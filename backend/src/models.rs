//! Data models and JWT utilities for the marketplace.
//! Defines structures for products, users, carts, messages, and authentication.

use serde::{Deserialize, Serialize};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey, errors::Error};
use chrono::{Utc, Duration};

#[derive(Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: u32,
    pub name: String,
    pub price: f64,
    pub category: String,
    pub description: Option<String>,
    pub image: Option<String>, // Base64 encoded image
    pub quantity: i32,
    pub vendor_id: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub role: Role,
    pub profile_image: Option<String>, // Base64 encoded image
    pub verified: bool,
    pub banned: bool,
    pub verification_document: Option<String>, // Base64 encoded verification document
    pub verification_rejected_reason: Option<String>, // Reason for verification rejection
    pub secondary_email: Option<String>,
    pub mpesa_number: Option<String>,
    pub payment_preference: Option<String>,
    pub location_string: Option<String>, // Human-readable location (city, country)
    pub wallet_balance: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub enum Role {
    Admin,
    Customer,
    Vendor,
}

#[derive(Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Deserialize)]
pub struct SignupRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub mpesa_number: String, // Phone number is now required
    pub role: Option<String>, // "Customer" or "Vendor", defaults to "Customer"
    pub profile_image: Option<String>, // Base64 encoded image
    pub location_string: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ProductRequest {
    pub name: String,
    pub price: f64,
    pub category: String,
    pub description: String,
    pub quantity: i32,
    pub image: Option<String>, // Base64 encoded image
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: i32, // user id
    pub username: String,
    pub role: String,
    pub exp: usize, // expiration time
}

#[derive(Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CartItem {
    pub id: i32,
    pub user_id: i32,
    pub product_id: i32,
    pub quantity: i32,
    pub product: Product,
}

#[derive(Serialize, Deserialize)]
pub struct CartItemRequest {
    pub product_id: i32,
    pub quantity: i32,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateCartItemRequest {
    pub quantity: i32,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateUserRoleRequest {
    pub role: String,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateUserVerificationRequest {
    pub verified: bool,
}

#[derive(Serialize, Deserialize)]
pub struct UploadVerificationDocumentRequest {
    pub verification_document: String, // Base64 encoded image
}

#[derive(Serialize, Deserialize)]
pub struct CheckoutRequest {
    pub mpesa_number: String,
    pub total_amount: f64,
    pub selected_items: Option<Vec<i32>>, // Optional list of cart item IDs to checkout
}

#[derive(Serialize, Deserialize)]
pub struct CheckoutResponse {
    pub transaction_id: String,
    pub message: String,
    pub status: String,
}

#[derive(Serialize, Deserialize)]
pub struct Message {
    pub id: i32,
    pub sender_id: i32,
    pub receiver_id: i32,
    pub content: String,
    pub is_read: bool,
    pub created_at: String,
    pub sender_username: String,
    pub receiver_username: String,
}

#[derive(Serialize, Deserialize)]
pub struct Conversation {
    pub id: i32,
    pub username: String,
    pub profile_image: Option<String>,
    pub last_message: Option<String>,
    pub last_message_time: Option<String>,
    pub unread_count: i32,
}

#[derive(Serialize, Deserialize)]
pub struct Follow {
    pub id: i32,
    pub follower_id: i32,
    pub vendor_id: i32,
    pub created_at: String,
    pub follower_username: String,
    pub vendor_username: String,
}

#[derive(Serialize, Deserialize)]
pub struct SendMessageRequest {
    pub receiver_id: i32,
    pub content: String,
}

#[derive(Serialize, Deserialize)]
pub struct FollowRequest {
    pub vendor_id: i32,
}

#[derive(Serialize, Deserialize)]
pub struct Review {
    pub id: i32,
    pub customer_id: i32,
    pub product_id: i32,
    pub vendor_id: i32,
    pub rating: i32,
    pub comment: Option<String>,
    pub created_at: String,
    pub customer_username: String,
    pub product_name: String,
}

#[derive(Serialize, Deserialize)]
pub struct ShippingOrder {
    pub id: i32,
    pub customer_id: i32,
    pub product_id: i32,
    pub vendor_id: i32,
    pub quantity: i32,
    pub total_amount: f64,
    pub shipping_status: String,
    pub tracking_number: Option<String>,
    pub shipping_address: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub customer_username: String,
    pub vendor_username: String,
    pub product_name: String,
    pub customer_verified: bool,
    pub payment_released: bool,
    pub verification_requested_at: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateReviewRequest {
    pub product_id: i32,
    pub rating: i32,
    pub comment: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateShippingOrderRequest {
    pub product_id: i32,
    pub quantity: i32,
    pub shipping_address: String,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateShippingStatusRequest {
    pub shipping_status: String,
    pub tracking_number: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct VerifyDeliveryRequest {
    pub order_id: i32,
    pub verified: bool,
}

#[derive(Serialize, Deserialize)]
pub struct WithdrawRequest {
    pub amount: f64,
    pub mpesa_number: String,
}

#[derive(Serialize, Deserialize)]
pub struct WithdrawResponse {
    pub success: bool,
    pub message: String,
    pub transaction_id: Option<String>,
    pub new_balance: f64,
}

// JWT utilities
const JWT_SECRET: &str = "your-secret-key"; // In production, use env var

impl Claims {
    pub fn new(user: &User) -> Self {
        let expiration = Utc::now()
            .checked_add_signed(Duration::hours(24))
            .expect("valid timestamp")
            .timestamp() as usize;

        Claims {
            sub: user.id,
            username: user.username.clone(),
            role: match user.role {
                Role::Admin => "Admin".to_string(),
                Role::Customer => "Customer".to_string(),
                Role::Vendor => "Vendor".to_string(),
            },
            exp: expiration,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VendorReport {
    pub id: i32,
    pub customer_id: i32,
    pub vendor_id: i32,
    pub product_id: Option<i32>,
    pub report_type: String,
    pub description: Option<String>,
    pub status: String,
    pub admin_notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub customer_username: String,
    pub vendor_username: String,
    pub product_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VendorVerification {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub profile_image: Option<String>,
    pub mpesa_number: Option<String>,
    pub payment_preference: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PaymentTransaction {
    pub id: i32,
    pub user_id: i32,
    pub checkout_request_id: String,
    pub merchant_request_id: String,
    pub mpesa_receipt_number: Option<String>,
    pub phone_number: String,
    pub amount: f64,
    pub status: String, // initiated, completed, failed, cancelled
    pub transaction_date: Option<String>,
    pub cart_item_ids: Option<String>, // Comma-separated cart item IDs
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VendorSalesReport {
    pub total_sales: f64,
    pub total_orders: i32,
    pub total_profit: f64, // Assuming profit = total_sales for now
    pub sales_by_product: Vec<ProductSales>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProductSales {
    pub product_id: i32,
    pub product_name: String,
    pub quantity_sold: i32,
    pub total_revenue: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CustomerPurchaseReport {
    pub total_spent: f64,
    pub total_orders: i32,
    pub purchases_by_category: Vec<CategoryPurchase>,
    pub purchases_by_vendor: Vec<VendorPurchase>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CategoryPurchase {
    pub category: String,
    pub total_spent: f64,
    pub quantity: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VendorPurchase {
    pub vendor_id: i32,
    pub vendor_name: String,
    pub total_spent: f64,
    pub order_count: i32,
}

pub fn create_jwt(user: &User) -> Result<String, Error> {
    let claims = Claims::new(user);
    encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET.as_ref()))
}

pub fn verify_jwt(token: &str) -> Result<Claims, Error> {
    decode::<Claims>(token, &DecodingKey::from_secret(JWT_SECRET.as_ref()), &Validation::default())
        .map(|data| data.claims)
}

// Password Reset Models
#[derive(Serialize, Deserialize)]
pub struct PasswordResetRequest {
    pub username: String,
}

#[derive(Serialize, Deserialize)]
pub struct PasswordResetVerifyRequest {
    pub username: String,
    pub verification_code: String,
    pub new_password: String,
}

#[derive(Serialize, Deserialize)]
pub struct PasswordResetResponse {
    pub message: String,
    pub expires_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PasswordResetCode {
    pub id: i32,
    pub username: String,
    pub verification_code: String,
    pub expires_at: String,
    pub used: bool,
    pub created_at: String,
}
