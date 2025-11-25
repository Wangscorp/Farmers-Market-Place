//! Email service module for sending verification and notification emails.
//! Uses SMTP with lettre for email delivery.

use lettre::{
    message::{header::ContentType, Mailbox},
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
};
use std::env;

/// Error type for email operations
#[derive(Debug)]
pub enum EmailError {
    InvalidConfig(String),
    MessageBuild(lettre::error::Error),
    SmtpError(lettre::transport::smtp::Error),
}

impl std::fmt::Display for EmailError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EmailError::InvalidConfig(msg) => write!(f, "Email configuration error: {}", msg),
            EmailError::MessageBuild(err) => write!(f, "Email message build error: {}", err),
            EmailError::SmtpError(err) => write!(f, "SMTP error: {}", err),
        }
    }
}

impl std::error::Error for EmailError {}

/// Email configuration loaded from environment variables
struct EmailConfig {
    smtp_server: String,
    smtp_port: u16,
    smtp_username: String,
    smtp_password: String,
    from_email: String,
    from_name: String,
}

impl EmailConfig {
    /// Load email configuration from environment variables
    fn from_env() -> Result<Self, EmailError> {
        let smtp_server = env::var("SMTP_SERVER")
            .map_err(|_| EmailError::InvalidConfig("SMTP_SERVER not set".to_string()))?;
        
        let smtp_port = env::var("SMTP_PORT")
            .map_err(|_| EmailError::InvalidConfig("SMTP_PORT not set".to_string()))?
            .parse::<u16>()
            .map_err(|_| EmailError::InvalidConfig("SMTP_PORT must be a valid port number".to_string()))?;
        
        let smtp_username = env::var("SMTP_USERNAME")
            .map_err(|_| EmailError::InvalidConfig("SMTP_USERNAME not set".to_string()))?;
        
        let smtp_password = env::var("SMTP_PASSWORD")
            .map_err(|_| EmailError::InvalidConfig("SMTP_PASSWORD not set".to_string()))?;
        
        let from_email = env::var("FROM_EMAIL")
            .map_err(|_| EmailError::InvalidConfig("FROM_EMAIL not set".to_string()))?;
        
        let from_name = env::var("FROM_NAME")
            .unwrap_or_else(|_| "Farmers Market Place".to_string());

        Ok(EmailConfig {
            smtp_server,
            smtp_port,
            smtp_username,
            smtp_password,
            from_email,
            from_name,
        })
    }
}

/// Create an SMTP transport with the given configuration
fn create_mailer(config: &EmailConfig) -> Result<SmtpTransport, EmailError> {
    let creds = Credentials::new(config.smtp_username.clone(), config.smtp_password.clone());

    let mailer = SmtpTransport::relay(&config.smtp_server)
        .map_err(EmailError::SmtpError)?
        .port(config.smtp_port)
        .credentials(creds)
        .build();

    Ok(mailer)
}

/// Send a verification approval email to a user
pub async fn send_verification_approval_email(
    user_email: &str,
    username: &str,
) -> Result<(), EmailError> {
    let config = EmailConfig::from_env()?;
    let mailer = create_mailer(&config)?;

    let from_mailbox: Mailbox = format!("{} <{}>", config.from_name, config.from_email)
        .parse()
        .map_err(|_| EmailError::InvalidConfig("Invalid from email format".to_string()))?;

    let to_mailbox: Mailbox = user_email
        .parse()
        .map_err(|_| EmailError::InvalidConfig("Invalid recipient email format".to_string()))?;

    let subject = "Account Verification Approved - Farmers Market Place";
    let body = format!(
        r#"
Dear {},

Congratulations! Your account has been successfully verified on Farmers Market Place.

You now have full access to all features of our platform, including:
- Selling your farm products
- Purchasing from other verified vendors
- Using our secure payment system
- Accessing premium vendor tools

You can now log in to your account and start using all the features available to verified users.

If you have any questions or need assistance, please don't hesitate to contact our support team.

Welcome to the Farmers Market Place community!

Best regards,
The Farmers Market Place Team

---
This is an automated message. Please do not reply to this email.
"#,
        username
    );

    let email = Message::builder()
        .from(from_mailbox)
        .to(to_mailbox)
        .subject(subject)
        .header(ContentType::TEXT_PLAIN)
        .body(body)
        .map_err(EmailError::MessageBuild)?;

    // Send the email
    mailer.send(&email).map_err(EmailError::SmtpError)?;

    println!("✅ Verification approval email sent to {}", user_email);
    Ok(())
}

/// Send a verification rejection email to a user
pub async fn send_verification_rejection_email(
    user_email: &str,
    username: &str,
) -> Result<(), EmailError> {
    let config = EmailConfig::from_env()?;
    let mailer = create_mailer(&config)?;

    let from_mailbox: Mailbox = format!("{} <{}>", config.from_name, config.from_email)
        .parse()
        .map_err(|_| EmailError::InvalidConfig("Invalid from email format".to_string()))?;

    let to_mailbox: Mailbox = user_email
        .parse()
        .map_err(|_| EmailError::InvalidConfig("Invalid recipient email format".to_string()))?;

    let subject = "Account Verification Status - Farmers Market Place";
    let body = format!(
        r#"
Dear {},

Thank you for your interest in becoming a verified vendor on Farmers Market Place.

Unfortunately, we were unable to approve your verification request at this time. This could be due to:
- Incomplete or unclear documentation
- Information that doesn't meet our verification criteria
- Technical issues with the submitted materials

What you can do next:
1. Review your submitted information and documentation
2. Ensure all required fields are completed accurately
3. Upload clear, high-quality images of required documents
4. Resubmit your verification request with updated information

Our verification process helps maintain the quality and trustworthiness of our marketplace. We encourage you to review our vendor guidelines and try again.

If you have questions about the verification process or need assistance with your application, please contact our support team.

Thank you for your understanding.

Best regards,
The Farmers Market Place Team

---
This is an automated message. Please do not reply to this email.
"#,
        username
    );

    let email = Message::builder()
        .from(from_mailbox)
        .to(to_mailbox)
        .subject(subject)
        .header(ContentType::TEXT_PLAIN)
        .body(body)
        .map_err(EmailError::MessageBuild)?;

    // Send the email
    mailer.send(&email).map_err(EmailError::SmtpError)?;

    println!("📧 Verification rejection email sent to {}", user_email);
    Ok(())
}


