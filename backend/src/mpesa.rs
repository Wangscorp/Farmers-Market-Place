/**
 * M-Pesa Daraja API Integration Module
 * 
 * This module handles integration with Safaricom's M-Pesa Daraja API for:
 * - STK Push (Customer pays merchant)
 * - Transaction status queries
 * - Payment callbacks handling
 * 
 * For production use:
 * 1. Register your app on https://developer.safaricom.co.ke/
 * 2. Get Consumer Key and Consumer Secret
 * 3. Set up callback URL (must be publicly accessible)
 * 4. Configure shortcode and passkey
 */

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::env;
use reqwest;
use base64;
use chrono;

// M-Pesa API Configuration
#[derive(Clone)]
pub struct MpesaConfig {
    pub consumer_key: String,
    pub consumer_secret: String,
    pub shortcode: String,
    pub passkey: String,
    pub callback_url: String,
    pub environment: MpesaEnvironment,
}

#[derive(Clone)]
pub enum MpesaEnvironment {
    Sandbox,
    Production,
}

impl MpesaConfig {
    /// Load M-Pesa configuration from environment variables
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let consumer_key = env::var("MPESA_CONSUMER_KEY")
            .map_err(|_| "MPESA_CONSUMER_KEY environment variable not set")?;
        let consumer_secret = env::var("MPESA_CONSUMER_SECRET")
            .map_err(|_| "MPESA_CONSUMER_SECRET environment variable not set")?;
        let shortcode = env::var("MPESA_SHORTCODE")
            .unwrap_or_else(|_| "174379".to_string()); // Default sandbox shortcode
        let passkey = env::var("MPESA_PASSKEY")
            .unwrap_or_else(|_| "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919".to_string()); // Default sandbox passkey
        let callback_url = env::var("MPESA_CALLBACK_URL")
            .unwrap_or_else(|_| "https://your-domain.com/mpesa/callback".to_string());
        let environment = match env::var("MPESA_ENVIRONMENT").unwrap_or_else(|_| "sandbox".to_string()).as_str() {
            "production" => MpesaEnvironment::Production,
            _ => MpesaEnvironment::Sandbox,
        };

        Ok(MpesaConfig {
            consumer_key,
            consumer_secret,
            shortcode,
            passkey,
            callback_url,
            environment,
        })
    }

    /// Get the base URL for M-Pesa API based on environment
    pub fn base_url(&self) -> &str {
        match self.environment {
            MpesaEnvironment::Sandbox => "https://sandbox.safaricom.co.ke",
            MpesaEnvironment::Production => "https://api.safaricom.co.ke",
        }
    }
}

// M-Pesa API Request/Response Models



#[derive(Deserialize)]
pub struct AuthResponse {
    pub access_token: String,
    #[allow(dead_code)] // Token expiration time - might be useful for caching in future
    pub expires_in: String,
}

#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct StkPushRequest {
    pub business_short_code: String,
    pub password: String,
    pub timestamp: String,
    pub transaction_type: String,
    pub amount: String,
    pub party_a: String, // Phone number paying
    pub party_b: String, // Organization shortcode
    pub phone_number: String,
    pub call_back_u_r_l: String,
    pub account_reference: String,
    pub transaction_desc: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct StkPushResponse {
    pub merchant_request_i_d: String,
    pub checkout_request_i_d: String,
    pub response_code: String,
    pub response_description: String,
    pub customer_message: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct StkCallbackBody {
    pub stk_callback: StkCallback,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct StkCallback {
    pub merchant_request_i_d: String,
    pub checkout_request_i_d: String,
    pub result_code: i32,
    pub result_desc: String,
    pub callback_metadata: Option<CallbackMetadata>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct CallbackMetadata {
    pub item: Vec<CallbackItem>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct CallbackItem {
    pub name: String,
    pub value: Option<serde_json::Value>,
}

// Payment Status for our database
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum PaymentStatus {
    Initiated,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for PaymentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PaymentStatus::Initiated => write!(f, "initiated"),
            PaymentStatus::Completed => write!(f, "completed"),
            PaymentStatus::Failed => write!(f, "failed"),
            PaymentStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

// M-Pesa Client Implementation
pub struct MpesaClient {
    config: MpesaConfig,
    client: reqwest::Client,
}

impl MpesaClient {
    /// Create a new M-Pesa client with configuration
    pub fn new(config: MpesaConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        MpesaClient { config, client }
    }

    /// Get OAuth access token from M-Pesa API
    pub async fn get_access_token(&self) -> Result<String, Box<dyn std::error::Error>> {
        let auth_url = format!("{}/oauth/v1/generate?grant_type=client_credentials", self.config.base_url());
        
        // Create Basic Auth header
        let credentials = format!("{}:{}", self.config.consumer_key, self.config.consumer_secret);
        let encoded_credentials = base64::engine::general_purpose::STANDARD.encode(credentials);
        let auth_header = format!("Basic {}", encoded_credentials);

        let response = self.client
            .get(&auth_url)
            .header("Authorization", auth_header)
            .send()
            .await?;

        if response.status().is_success() {
            let auth_response: AuthResponse = response.json().await?;
            Ok(auth_response.access_token)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to get access token: {}", error_text).into())
        }
    }

    /// Generate password for STK push request
    fn generate_password(&self, timestamp: &str) -> String {
        let password_string = format!("{}{}{}", self.config.shortcode, self.config.passkey, timestamp);
        base64::engine::general_purpose::STANDARD.encode(password_string)
    }

    /// Generate timestamp in the required format (YYYYMMDDHHMMSS)
    fn generate_timestamp() -> String {
        chrono::Utc::now().format("%Y%m%d%H%M%S").to_string()
    }

    /// Initiate STK Push payment
    pub async fn stk_push(
        &self,
        phone_number: String,
        amount: f64,
        account_reference: String,
        transaction_description: String,
    ) -> Result<StkPushResponse, Box<dyn std::error::Error>> {
        // Get access token
        let access_token = self.get_access_token().await?;
        
        // Generate timestamp and password
        let timestamp = Self::generate_timestamp();
        let password = self.generate_password(&timestamp);

        // Format phone number (ensure it starts with 254)
        let formatted_phone = if phone_number.starts_with("07") {
            format!("254{}", &phone_number[1..])
        } else if phone_number.starts_with("+254") {
            phone_number[1..].to_string()
        } else if phone_number.starts_with("254") {
            phone_number
        } else {
            return Err("Invalid phone number format".into());
        };

        // Create STK push request
        let stk_request = StkPushRequest {
            business_short_code: self.config.shortcode.clone(),
            password,
            timestamp,
            transaction_type: "CustomerPayBillOnline".to_string(),
            amount: amount.to_string(),
            party_a: formatted_phone.clone(),
            party_b: self.config.shortcode.clone(),
            phone_number: formatted_phone,
            call_back_u_r_l: self.config.callback_url.clone(),
            account_reference,
            transaction_desc: transaction_description,
        };

        // Make API request
        let stk_url = format!("{}/mpesa/stkpush/v1/processrequest", self.config.base_url());
        
        let response = self.client
            .post(&stk_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&stk_request)
            .send()
            .await?;

        if response.status().is_success() {
            let stk_response: StkPushResponse = response.json().await?;
            Ok(stk_response)
        } else {
            let error_text = response.text().await?;
            Err(format!("STK Push failed: {}", error_text).into())
        }
    }
}

// Utility functions for callback processing
pub fn extract_callback_data(callback: &StkCallback) -> Option<(String, String, f64)> {
    if let Some(metadata) = &callback.callback_metadata {
        let mut mpesa_receipt_number = None;
        let mut transaction_date = None;
        let mut amount = None;

        for item in &metadata.item {
            match item.name.as_str() {
                "MpesaReceiptNumber" => {
                    mpesa_receipt_number = item.value.as_ref().and_then(|v| v.as_str()).map(|s| s.to_string());
                }
                "TransactionDate" => {
                    transaction_date = item.value.as_ref().and_then(|v| v.as_str()).map(|s| s.to_string());
                }
                "Amount" => {
                    amount = item.value.as_ref().and_then(|v| v.as_f64());
                }
                _ => {}
            }
        }

        if let (Some(receipt), Some(date), Some(amt)) = (mpesa_receipt_number, transaction_date, amount) {
            return Some((receipt, date, amt));
        }
    }
    None
}
