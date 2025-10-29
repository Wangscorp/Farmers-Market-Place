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
    pub role: Option<String>, // "Customer" or "Vendor", defaults to "Customer"
    pub profile_image: Option<String>, // Base64 encoded image
}

#[derive(Serialize, Deserialize)]
pub struct ProductRequest {
    pub name: String,
    pub price: f64,
    pub category: String,
    pub description: String,
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

pub fn create_jwt(user: &User) -> Result<String, Error> {
    let claims = Claims::new(user);
    encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET.as_ref()))
}

pub fn verify_jwt(token: &str) -> Result<Claims, Error> {
    decode::<Claims>(token, &DecodingKey::from_secret(JWT_SECRET.as_ref()), &Validation::default())
        .map(|data| data.claims)
}
