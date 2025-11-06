use sqlx::{PgPool, postgres::PgPoolOptions, Row};
use crate::models::{User, Role, CartItem, Product};
use bcrypt::{hash, verify, DEFAULT_COST};

pub async fn init_db() -> PgPool {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://wangs@localhost/farmers_market".to_string());
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Create users table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'Customer',
            profile_image TEXT,
            verified BOOLEAN NOT NULL DEFAULT FALSE,
            banned BOOLEAN NOT NULL DEFAULT FALSE,
            verification_document TEXT,
            verification_submitted_at TIMESTAMP WITH TIME ZONE
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create users table");

    // Alter table to add verification_document column if it doesn't exist (for existing databases)
    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_document TEXT"
    )
    .execute(&pool)
    .await;

    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMP WITH TIME ZONE"
    )
    .execute(&pool)
    .await;

    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mpesa_number VARCHAR(20)"
    )
    .execute(&pool)
    .await;

    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_preference VARCHAR(50) DEFAULT 'monthly'" // 'after_order' or 'monthly'
    )
    .execute(&pool)
    .await;

    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS secondary_email VARCHAR(255)"
    )
    .execute(&pool)
    .await;

    // Create products table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            price FLOAT8 NOT NULL,
            category VARCHAR(100) NOT NULL,
            description TEXT,
            image TEXT,
            quantity INTEGER NOT NULL DEFAULT 0,
            vendor_id INTEGER NOT NULL REFERENCES users(id)
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create products table");

    // Create reviews table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES users(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            vendor_id INTEGER NOT NULL REFERENCES users(id),
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(customer_id, product_id)
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create reviews table");

    // Create shipping_orders table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS shipping_orders (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES users(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            vendor_id INTEGER NOT NULL REFERENCES users(id),
            quantity INTEGER NOT NULL,
            total_amount FLOAT8 NOT NULL,
            shipping_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'shipped', 'delivered', 'cancelled'
            tracking_number VARCHAR(255),
            shipping_address TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create shipping_orders table");

    // Add quantity column to existing products table if it doesn't exist
    let _ = sqlx::query(
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0"
    )
    .execute(&pool)
    .await;

    // Create cart_items table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS cart_items (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create cart_items table");

    // Create vendor_reports table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS vendor_reports (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES users(id),
            vendor_id INTEGER NOT NULL REFERENCES users(id),
            product_id INTEGER REFERENCES products(id),
            report_type VARCHAR(50) NOT NULL, -- 'non_delivery', 'wrong_product', 'damaged_product', 'other'
            description TEXT,
            status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'investigating', 'resolved', 'dismissed'
            admin_notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create vendor_reports table");

    // Create follows table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS follows (
            id SERIAL PRIMARY KEY,
            follower_id INTEGER NOT NULL REFERENCES users(id),
            vendor_id INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(follower_id, vendor_id)
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create follows table");

    // Create messages table if not exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES users(id),
            receiver_id INTEGER NOT NULL REFERENCES users(id),
            content TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create messages table");

    // Create default admin user if not exists
    let admin_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("admin")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !admin_exists.0 {
        let admin_hash = hash("admin123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        )
        .bind("admin")
        .bind("admin@example.com")
        .bind(admin_hash)
        .bind("Admin")
        .execute(&pool)
        .await
        .expect("Failed to create default admin user");
    }

    // Create Mercy user if not exists
    let mercy_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("Mercy")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !mercy_exists.0 {
        let mercy_hash = hash("password123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("Mercy")
        .bind("mercy@example.com")
        .bind(mercy_hash)
        .bind("Customer")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create Mercy user");
    }

    // Create Risper user if not exists
    let risper_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("Risper")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !risper_exists.0 {
        let risper_hash = hash("password123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("Risper")
        .bind("risper@example.com")
        .bind(risper_hash)
        .bind("Vendor")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create Risper user");
    }

    // No sample products - users will create them through the interface

    pool
}

pub async fn create_user(pool: &PgPool, username: &str, email: &str, password: &str, role: &Role, profile_image: Option<&str>) -> Result<User, sqlx::Error> {
    let password_hash = hash(password, DEFAULT_COST).map_err(|_| sqlx::Error::RowNotFound)?;
    let role_str = match role {
        Role::Admin => "Admin",
        Role::Customer => "Customer",
        Role::Vendor => "Vendor",
    };

    let row = if let Some(image) = profile_image {
        sqlx::query(
            r#"
            INSERT INTO users (username, email, password_hash, role, profile_image, verified)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, email, role, profile_image, verified
            "#,
        )
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .bind(role_str)
        .bind(image)
        .bind(false)  // Vendors are not auto-verified anymore
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query(
            r#"
            INSERT INTO users (username, email, password_hash, role, verified)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, username, email, role, profile_image, verified
            "#,
        )
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .bind(role_str)
        .bind(false)  // All new users start as unverified
        .fetch_one(pool)
        .await?
    };

    let user = User {
        id: row.try_get(0)?,
        username: row.try_get(1)?,
        email: row.try_get(2)?,
        role: match row.try_get::<String, _>(3)?.as_str() {
            "Admin" => Role::Admin,
            "Customer" => Role::Customer,
            "Vendor" => Role::Vendor,
            _ => Role::Customer,
        },
        profile_image: row.try_get(4)?,
        verified: row.try_get(5)?,
        banned: false,
        verification_document: None,
        secondary_email: None,
        mpesa_number: None,
        payment_preference: None,
    };

    Ok(user)
}

pub async fn authenticate_user(pool: &PgPool, username: &str, password: &str) -> Result<User, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT id, username, email, password_hash, role, profile_image, verified
        FROM users
        WHERE username = $1
        "#,
    )
    .bind(username)
    .fetch_one(pool)
    .await?;

    let stored_hash: String = row.try_get(3)?;
    let is_valid = verify(password, &stored_hash).map_err(|_| sqlx::Error::RowNotFound)?;

    if !is_valid {
        return Err(sqlx::Error::RowNotFound);
    }

    let user = User {
        id: row.try_get(0)?,
        username: row.try_get(1)?,
        email: row.try_get(2)?,
        role: match row.try_get::<String, _>(4)?.as_str() {
            "Admin" => Role::Admin,
            "Customer" => Role::Customer,
            "Vendor" => Role::Vendor,
            _ => Role::Customer,
        },
        profile_image: row.try_get(5)?,
        verified: row.try_get(6)?,
        banned: false, // Default to false for legacy users
        verification_document: None,
        secondary_email: None,
        mpesa_number: None,
        payment_preference: None,
    };

    Ok(user)
}

pub async fn get_cart_items(pool: &PgPool, user_id: i32) -> Result<Vec<CartItem>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            ci.id, ci.user_id, ci.product_id, ci.quantity,
            p.id as p_id, p.name, p.price, p.category, p.description, p.image, p.quantity, p.vendor_id
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut cart_items = Vec::new();
    for row in rows {
        let product = Product {
            id: row.try_get::<i32, _>("p_id")? as u32,
            name: row.try_get("name")?,
            price: row.try_get::<f64, _>("price")?,
            category: row.try_get("category")?,
            description: row.try_get::<Option<String>, _>("description")?,
            image: row.try_get::<Option<String>, _>("image")?,
            quantity: row.try_get("quantity")?,
            vendor_id: row.try_get::<i32, _>("vendor_id")? as u32,
        };

        let cart_item = CartItem {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
            product_id: row.try_get("product_id")?,
            quantity: row.try_get("quantity")?,
            product,
        };
        cart_items.push(cart_item);
    }

    Ok(cart_items)
}

pub async fn upload_verification_document(pool: &PgPool, user_id: i32, document_image: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users SET verification_document = $1, verification_submitted_at = CURRENT_TIMESTAMP WHERE id = $2"
    )
    .bind(document_image)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

#[allow(dead_code)]
pub async fn get_user_verification_document(pool: &PgPool, user_id: i32) -> Result<Option<String>, sqlx::Error> {
    let result: Option<(String,)> = sqlx::query_as(
        "SELECT verification_document FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(result.map(|(doc,)| doc))
}

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
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

pub async fn create_vendor_report(
    pool: &PgPool,
    customer_id: i32,
    vendor_id: i32,
    product_id: Option<i32>,
    report_type: &str,
    description: Option<&str>
) -> Result<VendorReport, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO vendor_reports (customer_id, vendor_id, product_id, report_type, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, customer_id, vendor_id, product_id, report_type, description, status, admin_notes,
                  created_at, updated_at
        "#,
    )
    .bind(customer_id)
    .bind(vendor_id)
    .bind(product_id)
    .bind(report_type)
    .bind(description)
    .fetch_one(pool)
    .await?;

    // Get customer and vendor usernames, and product name if provided
    let customer_username = sqlx::query_scalar(
        "SELECT username FROM users WHERE id = $1"
    )
    .bind(customer_id)
    .fetch_one(pool)
    .await?;

    let vendor_username = sqlx::query_scalar(
        "SELECT username FROM users WHERE id = $1"
    )
    .bind(vendor_id)
    .fetch_one(pool)
    .await?;

    let product_name = if let Some(pid) = product_id {
        Some(sqlx::query_scalar("SELECT name FROM products WHERE id = $1")
            .bind(pid)
            .fetch_one(pool)
            .await?)
    } else {
        None
    };

    Ok(VendorReport {
        id: row.try_get("id")?,
        customer_id: row.try_get("customer_id")?,
        vendor_id: row.try_get("vendor_id")?,
        product_id: row.try_get("product_id")?,
        report_type: row.try_get("report_type")?,
        description: row.try_get("description")?,
        status: row.try_get("status")?,
        admin_notes: row.try_get("admin_notes")?,
        created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
        updated_at: row.try_get::<String, _>("updated_at").unwrap_or_else(|_| "?".to_string()),
        customer_username,
        vendor_username,
        product_name,
    })
}

pub async fn count_vendor_reports(pool: &PgPool, vendor_id: i32) -> Result<i32, sqlx::Error> {
    let row: (i32,) = sqlx::query_as(
        "SELECT COUNT(*) as report_count FROM vendor_reports WHERE vendor_id = $1"
    )
    .bind(vendor_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn get_all_vendor_reports(pool: &PgPool) -> Result<Vec<VendorReport>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            vr.id, vr.customer_id, vr.vendor_id, vr.product_id, vr.report_type,
            vr.description, vr.status, vr.admin_notes, vr.created_at, vr.updated_at,
            cu.username as customer_username, vu.username as vendor_username,
            p.name as product_name
        FROM vendor_reports vr
        JOIN users cu ON vr.customer_id = cu.id
        JOIN users vu ON vr.vendor_id = vu.id
        LEFT JOIN products p ON vr.product_id = p.id
        ORDER BY vr.created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut reports = Vec::new();
    for row in rows {
        reports.push(VendorReport {
            id: row.try_get("id")?,
            customer_id: row.try_get("customer_id")?,
            vendor_id: row.try_get("vendor_id")?,
            product_id: row.try_get("product_id")?,
            report_type: row.try_get("report_type")?,
            description: row.try_get("description")?,
            status: row.try_get("status")?,
            admin_notes: row.try_get("admin_notes")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            updated_at: row.try_get::<String, _>("updated_at").unwrap_or_else(|_| "?".to_string()),
            customer_username: row.try_get("customer_username")?,
            vendor_username: row.try_get("vendor_username")?,
            product_name: row.try_get("product_name")?,
        });
    }

    Ok(reports)
}

pub async fn update_report_status(
    pool: &PgPool,
    report_id: i32,
    status: &str,
    admin_notes: Option<&str>
) -> Result<(), sqlx::Error> {
    let query = if let Some(notes) = admin_notes {
        sqlx::query(
            "UPDATE vendor_reports SET status = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3"
        )
        .bind(status)
        .bind(notes)
        .bind(report_id)
    } else {
        sqlx::query(
            "UPDATE vendor_reports SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
        )
        .bind(status)
        .bind(report_id)
    };

    query.execute(pool).await?;
    Ok(())
}

pub async fn add_to_cart(pool: &PgPool, user_id: i32, product_id: i32, quantity: i32) -> Result<CartItem, sqlx::Error> {
    // Check if item already exists in cart
    let existing_row = sqlx::query(
        "SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2"
    )
    .bind(user_id)
    .bind(product_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = existing_row {
        let existing_id: i32 = row.try_get(0)?;
        let existing_quantity: i32 = row.try_get(1)?;
        let new_quantity = existing_quantity + quantity;

        // Update existing item
        sqlx::query(
            "UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
        )
        .bind(new_quantity)
        .bind(existing_id)
        .execute(pool)
        .await?;

        // Return updated cart item with product info - use manual construction to avoid compile-time validation
        let row = sqlx::query(
            r#"
            SELECT
                ci.id, ci.user_id, ci.product_id, ci.quantity,
                p.id as p_id, p.name, p.price, p.category, p.description, p.image, p.quantity, p.vendor_id
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.id = $1
            "#,
        )
        .bind(existing_id)
        .fetch_one(pool)
        .await?;

        let product = Product {
            id: row.try_get::<i32, _>("p_id")? as u32,
            name: row.try_get("name")?,
            price: row.try_get::<f64, _>("price")?,
            category: row.try_get("category")?,
            description: row.try_get::<Option<String>, _>("description")?,
            image: row.try_get::<Option<String>, _>("image")?,
            quantity: row.try_get("quantity")?,
            vendor_id: row.try_get::<i32, _>("vendor_id")? as u32,
        };

        return Ok(CartItem {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
            product_id: row.try_get("product_id")?,
            quantity: row.try_get("quantity")?,
            product,
        });
    } else {
        // Insert new item
        let row = sqlx::query(
            r#"
            INSERT INTO cart_items (user_id, product_id, quantity)
            VALUES ($1, $2, $3)
            RETURNING
                id, user_id, product_id, quantity,
                (SELECT name FROM products WHERE id = $2) as p_name,
                (SELECT price FROM products WHERE id = $2) as p_price,
                (SELECT category FROM products WHERE id = $2) as p_category,
                (SELECT description FROM products WHERE id = $2) as p_description,
                (SELECT image FROM products WHERE id = $2) as p_image,
                (SELECT vendor_id FROM products WHERE id = $2) as p_vendor_id
            "#,
        )
        .bind(user_id)
        .bind(product_id)
        .bind(quantity)
        .fetch_one(pool)
        .await?;

        let product = Product {
            id: product_id as u32,
            name: row.try_get("p_name")?,
            price: row.try_get::<f64, _>("p_price")?,
            category: row.try_get("p_category")?,
            description: row.try_get::<Option<String>, _>("p_description")?,
            image: row.try_get::<Option<String>, _>("p_image")?,
            quantity: 0, // Default for new cart items
            vendor_id: row.try_get::<i32, _>("p_vendor_id")? as u32,
        };

        let cart_item = CartItem {
            id: row.try_get("id")?,
            user_id,
            product_id,
            quantity,
            product,
        };

        Ok(cart_item)
    }
}

pub async fn update_cart_item_quantity(pool: &PgPool, cart_item_id: i32, user_id: i32, quantity: i32) -> Result<CartItem, sqlx::Error> {
    let row = sqlx::query(
        r#"
        UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND user_id = $3
        RETURNING
            id, user_id, product_id, quantity,
            (SELECT name FROM products WHERE id = product_id) as p_name,
            (SELECT price FROM products WHERE id = product_id) as p_price,
            (SELECT category FROM products WHERE id = product_id) as p_category,
            (SELECT description FROM products WHERE id = product_id) as p_description,
            (SELECT image FROM products WHERE id = product_id) as p_image,
            (SELECT quantity FROM products WHERE id = product_id) as p_quantity,
            (SELECT vendor_id FROM products WHERE id = product_id) as p_vendor_id
        "#,
    )
    .bind(quantity)
    .bind(cart_item_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let product = Product {
        id: row.try_get::<i32, _>("product_id")? as u32,
        name: row.try_get("p_name")?,
        price: row.try_get::<f64, _>("p_price")?,
        category: row.try_get("p_category")?,
        description: row.try_get::<Option<String>, _>("p_description")?,
        image: row.try_get::<Option<String>, _>("p_image")?,
        quantity: row.try_get("p_quantity")?,
        vendor_id: row.try_get::<i32, _>("p_vendor_id")? as u32,
    };

    let cart_item = CartItem {
        id: row.try_get("id")?,
        user_id: row.try_get("user_id")?,
        product_id: row.try_get("product_id")?,
        quantity: row.try_get("quantity")?,
        product,
    };

    Ok(cart_item)
}

pub async fn remove_from_cart_with_user(pool: &PgPool, cart_item_id: i32, user_id: i32) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM cart_items WHERE id = $1 AND user_id = $2")
        .bind(cart_item_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

// Admin user management functions
pub async fn get_all_users(pool: &PgPool) -> Result<Vec<User>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT id, username, email, role, profile_image, verified, banned, secondary_email, mpesa_number, payment_preference
        FROM users
        ORDER BY id
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut users = Vec::new();
    for row in rows {
        let user = User {
            id: row.try_get(0)?,
            username: row.try_get(1)?,
            email: row.try_get(2)?,
            role: match row.try_get::<String, _>(3)?.as_str() {
                "Admin" => Role::Admin,
                "Customer" => Role::Customer,
                "Vendor" => Role::Vendor,
                _ => Role::Customer,
            },
            profile_image: row.try_get(4)?,
            verified: row.try_get(5)?,
            banned: row.try_get(6)?,
            verification_document: None,
            secondary_email: row.try_get(7)?,
            mpesa_number: row.try_get(8)?,
            payment_preference: row.try_get(9)?,
        };
        users.push(user);
    }

    Ok(users)
}

pub async fn get_pending_vendors(pool: &PgPool) -> Result<Vec<crate::models::VendorVerification>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT id, username, email, profile_image, mpesa_number, payment_preference
        FROM users
        WHERE role = 'Vendor' AND verified = false AND profile_image IS NOT NULL
        ORDER BY id
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut vendors = Vec::new();
    for row in rows {
        let vendor = crate::models::VendorVerification {
            id: row.try_get(0)?,
            username: row.try_get(1)?,
            email: row.try_get(2)?,
            profile_image: row.try_get(3)?,
            mpesa_number: row.try_get(4)?,
            payment_preference: row.try_get(5)?,
        };
        vendors.push(vendor);
    }

    Ok(vendors)
}

pub async fn update_user_role(pool: &PgPool, user_id: i32, new_role: &Role) -> Result<(), sqlx::Error> {
    let role_str = match new_role {
        Role::Admin => "Admin",
        Role::Customer => "Customer",
        Role::Vendor => "Vendor",
    };

    sqlx::query(
        "UPDATE users SET role = $1 WHERE id = $2",
    )
    .bind(role_str)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_user_verification(pool: &PgPool, user_id: i32, verified: bool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users SET verified = $1 WHERE id = $2",
    )
    .bind(verified)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ban_user(pool: &PgPool, user_id: i32, banned: bool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users SET banned = $1 WHERE id = $2",
    )
    .bind(banned)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_user_profile_image(pool: &PgPool, user_id: i32, profile_image: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users SET profile_image = $1 WHERE id = $2",
    )
    .bind(profile_image)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_user_profile(pool: &PgPool, user_id: i32, new_username: Option<&str>, new_email: Option<&str>, secondary_email: Option<&str>, mpesa_number: Option<&str>, payment_preference: Option<&str>) -> Result<(), sqlx::Error> {
    if let Some(username) = new_username {
        sqlx::query(
            "UPDATE users SET username = $1 WHERE id = $2",
        )
        .bind(username)
        .bind(user_id)
        .execute(pool)
        .await?;
    }

    if let Some(email) = new_email {
        sqlx::query(
            "UPDATE users SET email = $1 WHERE id = $2",
        )
        .bind(email)
        .bind(user_id)
        .execute(pool)
        .await?;
    }

    if let Some(sec_email) = secondary_email {
        sqlx::query(
            "UPDATE users SET secondary_email = $1 WHERE id = $2",
        )
        .bind(sec_email)
        .bind(user_id)
        .execute(pool)
        .await?;
    }

    if let Some(mpesa) = mpesa_number {
        sqlx::query(
            "UPDATE users SET mpesa_number = $1 WHERE id = $2",
        )
        .bind(mpesa)
        .bind(user_id)
        .execute(pool)
        .await?;
    }

    if let Some(pref) = payment_preference {
        sqlx::query(
            "UPDATE users SET payment_preference = $1 WHERE id = $2",
        )
        .bind(pref)
        .bind(user_id)
        .execute(pool)
        .await?;
    }

    Ok(())
}

pub async fn reset_user_password(pool: &PgPool, user_id: i32, new_password: &str) -> Result<(), sqlx::Error> {
    let password_hash = hash(new_password, DEFAULT_COST).map_err(|_| sqlx::Error::RowNotFound)?;

    sqlx::query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
    )
    .bind(password_hash)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_user(pool: &PgPool, user_id: i32) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_all_products(pool: &PgPool, vendor_filter: Option<i32>) -> Result<Vec<Product>, sqlx::Error> {
    let rows = if let Some(vendor_id) = vendor_filter {
        sqlx::query(
            r#"
            SELECT id, name, price, category, description, image, quantity, vendor_id
            FROM products
            WHERE vendor_id = $1
            ORDER BY id
            "#,
        )
        .bind(vendor_id)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query(
            r#"
            SELECT p.id, p.name, p.price, p.category, p.description, p.image, p.quantity, p.vendor_id
            FROM products p
            JOIN users u ON p.vendor_id = u.id
            WHERE u.verified = TRUE AND u.banned = FALSE
            ORDER BY p.id
            "#,
        )
        .fetch_all(pool)
        .await?
    };

    let mut products = Vec::new();
    for row in rows {
        let product = Product {
            id: row.try_get::<i32, _>(0)? as u32,
            name: row.try_get(1)?,
            price: row.try_get::<f64, _>(2)?,
            category: row.try_get(3)?,
            description: row.try_get::<Option<String>, _>(4)?,
            image: row.try_get::<Option<String>, _>(5)?,
            quantity: row.try_get(6)?,
            vendor_id: row.try_get::<i32, _>(7)? as u32,
        };
        products.push(product);
    }

    Ok(products)
}

pub async fn create_product(pool: &PgPool, name: &str, price: f64, category: &str, description: &str, quantity: i32, image: Option<&str>, vendor_id: i32) -> Result<Product, sqlx::Error> {
    let row = if let Some(img) = image {
        sqlx::query(
            r#"
            INSERT INTO products (name, price, category, description, quantity, image, vendor_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, price, category, description, quantity, image, vendor_id
            "#,
        )
        .bind(name)
        .bind(price)
        .bind(category)
        .bind(description)
        .bind(quantity)
        .bind(img)
        .bind(vendor_id)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query(
            r#"
            INSERT INTO products (name, price, category, description, quantity, vendor_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, price, category, description, quantity, image, vendor_id
            "#,
        )
        .bind(name)
        .bind(price)
        .bind(category)
        .bind(description)
        .bind(quantity)
        .bind(vendor_id)
        .fetch_one(pool)
        .await?
    };

    let product = Product {
        id: row.try_get::<i32, _>(0)? as u32,
        name: row.try_get(1)?,
        price: row.try_get::<f64, _>(2)?,
        category: row.try_get(3)?,
        description: row.try_get::<Option<String>, _>(4)?,
        quantity: row.try_get(5)?,
        image: row.try_get::<Option<String>, _>(6)?,
        vendor_id: row.try_get::<i32, _>(7)? as u32,
    };

    Ok(product)
}

pub async fn update_product(pool: &PgPool, product_id: i32, name: &str, price: f64, category: &str, description: &str, quantity: i32, image: Option<&str>, vendor_id: i32) -> Result<Product, sqlx::Error> {
    let row = if let Some(img) = image {
        sqlx::query(
            r#"
            UPDATE products
            SET name = $1, price = $2, category = $3, description = $4, quantity = $5, image = $6
            WHERE id = $7 AND vendor_id = $8
            RETURNING id, name, price, category, description, quantity, image, vendor_id
            "#,
        )
        .bind(name)
        .bind(price)
        .bind(category)
        .bind(description)
        .bind(quantity)
        .bind(img)
        .bind(product_id)
        .bind(vendor_id)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query(
            r#"
            UPDATE products
            SET name = $1, price = $2, category = $3, description = $4, quantity = $5
            WHERE id = $6 AND vendor_id = $7
            RETURNING id, name, price, category, description, quantity, image, vendor_id
            "#,
        )
        .bind(name)
        .bind(price)
        .bind(category)
        .bind(description)
        .bind(quantity)
        .bind(product_id)
        .bind(vendor_id)
        .fetch_one(pool)
        .await?
    };

    let product = Product {
        id: row.try_get::<i32, _>(0)? as u32,
        name: row.try_get(1)?,
        price: row.try_get::<f64, _>(2)?,
        category: row.try_get(3)?,
        description: row.try_get::<Option<String>, _>(4)?,
        quantity: row.try_get(5)?,
        image: row.try_get::<Option<String>, _>(6)?,
        vendor_id: row.try_get::<i32, _>(7)? as u32,
    };

    Ok(product)
}

pub async fn delete_product(pool: &PgPool, product_id: i32, vendor_id: i32) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM products WHERE id = $1 AND vendor_id = $2")
        .bind(product_id)
        .bind(vendor_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_all_cart_items(pool: &PgPool) -> Result<Vec<CartItem>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            ci.id, ci.user_id, ci.product_id, ci.quantity,
            p.id as p_id, p.name, p.price, p.category, p.description, p.image, p.quantity, p.vendor_id,
            u.username as user_name
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        JOIN users u ON ci.user_id = u.id
        ORDER BY ci.updated_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut cart_items = Vec::new();
    for row in rows {
        let product = Product {
            id: row.try_get::<i32, _>("p_id")? as u32,
            name: row.try_get("name")?,
            price: row.try_get::<f64, _>("price")?,
            category: row.try_get("category")?,
            description: row.try_get::<Option<String>, _>("description")?,
            image: row.try_get::<Option<String>, _>("image")?,
            quantity: row.try_get("quantity")?,
            vendor_id: row.try_get::<i32, _>("vendor_id")? as u32,
        };

        let cart_item = CartItem {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
            product_id: row.try_get("product_id")?,
            quantity: row.try_get("quantity")?,
            product,
        };
        cart_items.push(cart_item);
    }

    Ok(cart_items)
}

// Message functions
pub async fn send_message(pool: &PgPool, sender_id: i32, receiver_id: i32, content: &str) -> Result<crate::models::Message, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO messages (sender_id, receiver_id, content)
        VALUES ($1, $2, $3)
        RETURNING id, sender_id, receiver_id, content, is_read, created_at
        "#,
    )
    .bind(sender_id)
    .bind(receiver_id)
    .bind(content)
    .fetch_one(pool)
    .await?;

    // Get usernames
    let sender_username = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(sender_id)
        .fetch_one(pool)
        .await?;

    let receiver_username = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(receiver_id)
        .fetch_one(pool)
        .await?;

    Ok(crate::models::Message {
        id: row.try_get("id")?,
        sender_id: row.try_get("sender_id")?,
        receiver_id: row.try_get("receiver_id")?,
        content: row.try_get("content")?,
        is_read: row.try_get("is_read")?,
        created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
        sender_username,
        receiver_username,
    })
}

pub async fn get_messages_between_users(pool: &PgPool, user1_id: i32, user2_id: i32) -> Result<Vec<crate::models::Message>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
            su.username as sender_username, ru.username as receiver_username
        FROM messages m
        JOIN users su ON m.sender_id = su.id
        JOIN users ru ON m.receiver_id = ru.id
        WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
        ORDER BY m.created_at ASC
        "#,
    )
    .bind(user1_id)
    .bind(user2_id)
    .fetch_all(pool)
    .await?;

    let mut messages = Vec::new();
    for row in rows {
        messages.push(crate::models::Message {
            id: row.try_get("id")?,
            sender_id: row.try_get("sender_id")?,
            receiver_id: row.try_get("receiver_id")?,
            content: row.try_get("content")?,
            is_read: row.try_get("is_read")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            sender_username: row.try_get("sender_username")?,
            receiver_username: row.try_get("receiver_username")?,
        });
    }

    Ok(messages)
}

pub async fn get_user_conversations(pool: &PgPool, user_id: i32) -> Result<Vec<crate::models::Message>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT ON (LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id))
            m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
            su.username as sender_username, ru.username as receiver_username
        FROM messages m
        JOIN users su ON m.sender_id = su.id
        JOIN users ru ON m.receiver_id = ru.id
        WHERE m.sender_id = $1 OR m.receiver_id = $1
        ORDER BY LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id), m.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut messages = Vec::new();
    for row in rows {
        messages.push(crate::models::Message {
            id: row.try_get("id")?,
            sender_id: row.try_get("sender_id")?,
            receiver_id: row.try_get("receiver_id")?,
            content: row.try_get("content")?,
            is_read: row.try_get("is_read")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            sender_username: row.try_get("sender_username")?,
            receiver_username: row.try_get("receiver_username")?,
        });
    }

    Ok(messages)
}

pub async fn mark_messages_as_read(pool: &PgPool, user_id: i32, other_user_id: i32) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE"
    )
    .bind(other_user_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

// Follow functions
pub async fn follow_vendor(pool: &PgPool, follower_id: i32, vendor_id: i32) -> Result<crate::models::Follow, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO follows (follower_id, vendor_id)
        VALUES ($1, $2)
        RETURNING id, follower_id, vendor_id, created_at
        "#,
    )
    .bind(follower_id)
    .bind(vendor_id)
    .fetch_one(pool)
    .await?;

    // Get usernames
    let follower_username = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(follower_id)
        .fetch_one(pool)
        .await?;

    let vendor_username = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(vendor_id)
        .fetch_one(pool)
        .await?;

    Ok(crate::models::Follow {
        id: row.try_get("id")?,
        follower_id: row.try_get("follower_id")?,
        vendor_id: row.try_get("vendor_id")?,
        created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
        follower_username,
        vendor_username,
    })
}

pub async fn unfollow_vendor(pool: &PgPool, follower_id: i32, vendor_id: i32) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM follows WHERE follower_id = $1 AND vendor_id = $2")
        .bind(follower_id)
        .bind(vendor_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn is_following(pool: &PgPool, follower_id: i32, vendor_id: i32) -> Result<bool, sqlx::Error> {
    let result: Option<(i32,)> = sqlx::query_as(
        "SELECT id FROM follows WHERE follower_id = $1 AND vendor_id = $2"
    )
    .bind(follower_id)
    .bind(vendor_id)
    .fetch_optional(pool)
    .await?;

    Ok(result.is_some())
}

pub async fn get_user_follows(pool: &PgPool, user_id: i32) -> Result<Vec<crate::models::Follow>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            f.id, f.follower_id, f.vendor_id, f.created_at,
            fu.username as follower_username, vu.username as vendor_username
        FROM follows f
        JOIN users fu ON f.follower_id = fu.id
        JOIN users vu ON f.vendor_id = vu.id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut follows = Vec::new();
    for row in rows {
        follows.push(crate::models::Follow {
            id: row.try_get("id")?,
            follower_id: row.try_get("follower_id")?,
            vendor_id: row.try_get("vendor_id")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            follower_username: row.try_get("follower_username")?,
            vendor_username: row.try_get("vendor_username")?,
        });
    }

    Ok(follows)
}

pub async fn get_vendor_followers(pool: &PgPool, vendor_id: i32) -> Result<Vec<crate::models::Follow>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            f.id, f.follower_id, f.vendor_id, f.created_at,
            fu.username as follower_username, vu.username as vendor_username
        FROM follows f
        JOIN users fu ON f.follower_id = fu.id
        JOIN users vu ON f.vendor_id = vu.id
        WHERE f.vendor_id = $1
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(vendor_id)
    .fetch_all(pool)
    .await?;

    let mut follows = Vec::new();
    for row in rows {
        follows.push(crate::models::Follow {
            id: row.try_get("id")?,
            follower_id: row.try_get("follower_id")?,
            vendor_id: row.try_get("vendor_id")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            follower_username: row.try_get("follower_username")?,
            vendor_username: row.try_get("vendor_username")?,
        });
    }

    Ok(follows)
}

// Review functions
pub async fn create_review(
    pool: &PgPool,
    customer_id: i32,
    product_id: i32,
    rating: i32,
    comment: Option<&str>
) -> Result<crate::models::Review, sqlx::Error> {
    // Get vendor_id from product
    let vendor_id: i32 = sqlx::query_scalar("SELECT vendor_id FROM products WHERE id = $1")
        .bind(product_id)
        .fetch_one(pool)
        .await?;

    let row = sqlx::query(
        r#"
        INSERT INTO reviews (customer_id, product_id, vendor_id, rating, comment)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, customer_id, product_id, vendor_id, rating, comment, created_at
        "#,
    )
    .bind(customer_id)
    .bind(product_id)
    .bind(vendor_id)
    .bind(rating)
    .bind(comment)
    .fetch_one(pool)
    .await?;

    // Get usernames and product name
    let customer_username = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(customer_id)
        .fetch_one(pool)
        .await?;

    let product_name = sqlx::query_scalar("SELECT name FROM products WHERE id = $1")
        .bind(product_id)
        .fetch_one(pool)
        .await?;

    Ok(crate::models::Review {
        id: row.try_get("id")?,
        customer_id: row.try_get("customer_id")?,
        product_id: row.try_get("product_id")?,
        vendor_id: row.try_get("vendor_id")?,
        rating: row.try_get("rating")?,
        comment: row.try_get("comment")?,
        created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
        customer_username,
        product_name,
    })
}

pub async fn get_product_reviews(pool: &PgPool, product_id: i32) -> Result<Vec<crate::models::Review>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            r.id, r.customer_id, r.product_id, r.vendor_id, r.rating, r.comment, r.created_at,
            u.username as customer_username, p.name as product_name
        FROM reviews r
        JOIN users u ON r.customer_id = u.id
        JOIN products p ON r.product_id = p.id
        WHERE r.product_id = $1
        ORDER BY r.created_at DESC
        "#,
    )
    .bind(product_id)
    .fetch_all(pool)
    .await?;

    let mut reviews = Vec::new();
    for row in rows {
        reviews.push(crate::models::Review {
            id: row.try_get("id")?,
            customer_id: row.try_get("customer_id")?,
            product_id: row.try_get("product_id")?,
            vendor_id: row.try_get("vendor_id")?,
            rating: row.try_get("rating")?,
            comment: row.try_get("comment")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            customer_username: row.try_get("customer_username")?,
            product_name: row.try_get("product_name")?,
        });
    }

    Ok(reviews)
}

pub async fn get_customer_reviews(pool: &PgPool, customer_id: i32) -> Result<Vec<crate::models::Review>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            r.id, r.customer_id, r.product_id, r.vendor_id, r.rating, r.comment, r.created_at,
            u.username as customer_username, p.name as product_name
        FROM reviews r
        JOIN users u ON r.customer_id = u.id
        JOIN products p ON r.product_id = p.id
        WHERE r.customer_id = $1
        ORDER BY r.created_at DESC
        "#,
    )
    .bind(customer_id)
    .fetch_all(pool)
    .await?;

    let mut reviews = Vec::new();
    for row in rows {
        reviews.push(crate::models::Review {
            id: row.try_get("id")?,
            customer_id: row.try_get("customer_id")?,
            product_id: row.try_get("product_id")?,
            vendor_id: row.try_get("vendor_id")?,
            rating: row.try_get("rating")?,
            comment: row.try_get("comment")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            customer_username: row.try_get("customer_username")?,
            product_name: row.try_get("product_name")?,
        });
    }

    Ok(reviews)
}

// Shipping order functions
pub async fn create_shipping_order(
    pool: &PgPool,
    customer_id: i32,
    product_id: i32,
    quantity: i32,
    shipping_address: &str
) -> Result<crate::models::ShippingOrder, sqlx::Error> {
    // Get product details
    let product_row: (i32, String, f64) = sqlx::query_as(
        "SELECT vendor_id, name, price FROM products WHERE id = $1"
    )
    .bind(product_id)
    .fetch_one(pool)
    .await?;

    let vendor_id = product_row.0;
    let product_name = product_row.1;
    let price = product_row.2;
    let total_amount = price * quantity as f64;

    let row = sqlx::query(
        r#"
        INSERT INTO shipping_orders (customer_id, product_id, vendor_id, quantity, total_amount, shipping_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, customer_id, product_id, vendor_id, quantity, total_amount, shipping_status,
                  tracking_number, shipping_address, created_at, updated_at
        "#,
    )
    .bind(customer_id)
    .bind(product_id)
    .bind(vendor_id)
    .bind(quantity)
    .bind(total_amount)
    .bind(shipping_address)
    .fetch_one(pool)
    .await?;

    // Get usernames
    let customer_username = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(customer_id)
        .fetch_one(pool)
        .await?;

    let vendor_username = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(vendor_id)
        .fetch_one(pool)
        .await?;

    Ok(crate::models::ShippingOrder {
        id: row.try_get("id")?,
        customer_id: row.try_get("customer_id")?,
        product_id: row.try_get("product_id")?,
        vendor_id: row.try_get("vendor_id")?,
        quantity: row.try_get("quantity")?,
        total_amount: row.try_get("total_amount")?,
        shipping_status: row.try_get("shipping_status")?,
        tracking_number: row.try_get("tracking_number")?,
        shipping_address: row.try_get("shipping_address")?,
        created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
        updated_at: row.try_get::<String, _>("updated_at").unwrap_or_else(|_| "?".to_string()),
        customer_username,
        vendor_username,
        product_name,
    })
}

pub async fn get_customer_shipping_orders(pool: &PgPool, customer_id: i32) -> Result<Vec<crate::models::ShippingOrder>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            so.id, so.customer_id, so.product_id, so.vendor_id, so.quantity, so.total_amount,
            so.shipping_status, so.tracking_number, so.shipping_address, so.created_at, so.updated_at,
            cu.username as customer_username, vu.username as vendor_username, p.name as product_name
        FROM shipping_orders so
        JOIN users cu ON so.customer_id = cu.id
        JOIN users vu ON so.vendor_id = vu.id
        JOIN products p ON so.product_id = p.id
        WHERE so.customer_id = $1
        ORDER BY so.created_at DESC
        "#,
    )
    .bind(customer_id)
    .fetch_all(pool)
    .await?;

    let mut orders = Vec::new();
    for row in rows {
        orders.push(crate::models::ShippingOrder {
            id: row.try_get("id")?,
            customer_id: row.try_get("customer_id")?,
            product_id: row.try_get("product_id")?,
            vendor_id: row.try_get("vendor_id")?,
            quantity: row.try_get("quantity")?,
            total_amount: row.try_get("total_amount")?,
            shipping_status: row.try_get("shipping_status")?,
            tracking_number: row.try_get("tracking_number")?,
            shipping_address: row.try_get("shipping_address")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            updated_at: row.try_get::<String, _>("updated_at").unwrap_or_else(|_| "?".to_string()),
            customer_username: row.try_get("customer_username")?,
            vendor_username: row.try_get("vendor_username")?,
            product_name: row.try_get("product_name")?,
        });
    }

    Ok(orders)
}

pub async fn get_vendor_shipping_orders(pool: &PgPool, vendor_id: i32) -> Result<Vec<crate::models::ShippingOrder>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            so.id, so.customer_id, so.product_id, so.vendor_id, so.quantity, so.total_amount,
            so.shipping_status, so.tracking_number, so.shipping_address, so.created_at, so.updated_at,
            cu.username as customer_username, vu.username as vendor_username, p.name as product_name
        FROM shipping_orders so
        JOIN users cu ON so.customer_id = cu.id
        JOIN users vu ON so.vendor_id = vu.id
        JOIN products p ON so.product_id = p.id
        WHERE so.vendor_id = $1
        ORDER BY so.created_at DESC
        "#,
    )
    .bind(vendor_id)
    .fetch_all(pool)
    .await?;

    let mut orders = Vec::new();
    for row in rows {
        orders.push(crate::models::ShippingOrder {
            id: row.try_get("id")?,
            customer_id: row.try_get("customer_id")?,
            product_id: row.try_get("product_id")?,
            vendor_id: row.try_get("vendor_id")?,
            quantity: row.try_get("quantity")?,
            total_amount: row.try_get("total_amount")?,
            shipping_status: row.try_get("shipping_status")?,
            tracking_number: row.try_get("tracking_number")?,
            shipping_address: row.try_get("shipping_address")?,
            created_at: row.try_get::<String, _>("created_at").unwrap_or_else(|_| "?".to_string()),
            updated_at: row.try_get::<String, _>("updated_at").unwrap_or_else(|_| "?".to_string()),
            customer_username: row.try_get("customer_username")?,
            vendor_username: row.try_get("vendor_username")?,
            product_name: row.try_get("product_name")?,
        });
    }

    Ok(orders)
}

pub async fn update_shipping_status(
    pool: &PgPool,
    order_id: i32,
    shipping_status: &str,
    tracking_number: Option<&str>
) -> Result<(), sqlx::Error> {
    let query = if let Some(tracking) = tracking_number {
        sqlx::query(
            "UPDATE shipping_orders SET shipping_status = $1, tracking_number = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3"
        )
        .bind(shipping_status)
        .bind(tracking)
        .bind(order_id)
    } else {
        sqlx::query(
            "UPDATE shipping_orders SET shipping_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
        )
        .bind(shipping_status)
        .bind(order_id)
    };

    query.execute(pool).await?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct VendorProfile {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub profile_image: Option<String>,
    pub verified: bool,
    pub total_purchases: i64,
    pub total_revenue: f64,
    pub follower_count: i64,
}

pub async fn get_vendor_profile(pool: &PgPool, vendor_id: i32) -> Result<VendorProfile, sqlx::Error> {
    // Get vendor basic info
    let vendor_row = sqlx::query(
        "SELECT id, username, email, profile_image, verified FROM users WHERE id = $1 AND role = 'Vendor'"
    )
    .bind(vendor_id)
    .fetch_one(pool)
    .await?;

    // Get total purchases (number of shipping orders)
    let total_purchases: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM shipping_orders WHERE vendor_id = $1"
    )
    .bind(vendor_id)
    .fetch_one(pool)
    .await?;

    // Get total revenue
    let total_revenue: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(total_amount), 0.0) FROM shipping_orders WHERE vendor_id = $1"
    )
    .bind(vendor_id)
    .fetch_one(pool)
    .await?;

    // Get follower count
    let follower_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM follows WHERE vendor_id = $1"
    )
    .bind(vendor_id)
    .fetch_one(pool)
    .await?;

    Ok(VendorProfile {
        id: vendor_row.try_get("id")?,
        username: vendor_row.try_get("username")?,
        email: vendor_row.try_get("email")?,
        profile_image: vendor_row.try_get("profile_image")?,
        verified: vendor_row.try_get("verified")?,
        total_purchases,
        total_revenue,
        follower_count,
    })
}
