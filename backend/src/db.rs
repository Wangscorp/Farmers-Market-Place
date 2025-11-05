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
            banned BOOLEAN NOT NULL DEFAULT FALSE
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create users table");

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
            vendor_id INTEGER NOT NULL REFERENCES users(id)
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("Failed to create products table");

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

    // Create sample vendors if not exists
    let vendor1_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("farmer_john")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !vendor1_exists.0 {
        let vendor1_hash = hash("vendor123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("farmer_john")
        .bind("john@farmers.com")
        .bind(vendor1_hash)
        .bind("Vendor")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create sample vendor 1");
    }

    let vendor2_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("organic_mary")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !vendor2_exists.0 {
        let vendor2_hash = hash("vendor123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("organic_mary")
        .bind("mary@organic.com")
        .bind(vendor2_hash)
        .bind("Vendor")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create sample vendor 2");
    }

    let vendor3_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("green_grocer_sam")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !vendor3_exists.0 {
        let vendor3_hash = hash("vendor123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("green_grocer_sam")
        .bind("sam@greengrocer.com")
        .bind(vendor3_hash)
        .bind("Vendor")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create sample vendor 3");
    }

    let vendor4_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("fresh_farm_lisa")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !vendor4_exists.0 {
        let vendor4_hash = hash("vendor123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("fresh_farm_lisa")
        .bind("lisa@freshfarm.com")
        .bind(vendor4_hash)
        .bind("Vendor")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create sample vendor 4");
    }

    // Create sample customers if not exists
    let customer1_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("customer_alice")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !customer1_exists.0 {
        let customer1_hash = hash("customer123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("customer_alice")
        .bind("alice@email.com")
        .bind(customer1_hash)
        .bind("Customer")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create sample customer 1");
    }

    let customer2_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("shopper_bob")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !customer2_exists.0 {
        let customer2_hash = hash("customer123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("shopper_bob")
        .bind("bob@shopper.com")
        .bind(customer2_hash)
        .bind("Customer")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create sample customer 2");
    }

    let customer3_exists: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind("buyer_charlie")
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !customer3_exists.0 {
        let customer3_hash = hash("customer123", DEFAULT_COST).unwrap();
        sqlx::query(
            "INSERT INTO users (username, email, password_hash, role, verified) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind("buyer_charlie")
        .bind("charlie@buyer.com")
        .bind(customer3_hash)
        .bind("Customer")
        .bind(true)
        .execute(&pool)
        .await
        .expect("Failed to create sample customer 3");
    }

    // Create sample products if not exists
    let products_exist: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM products LIMIT 1)",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or((false,));

    if !products_exist.0 {
        // Get vendor IDs
        let farmer_john_id: (i32,) = sqlx::query_as(
            "SELECT id FROM users WHERE username = $1",
        )
        .bind("farmer_john")
        .fetch_one(&pool)
        .await
        .expect("Failed to get farmer_john ID");

        let organic_mary_id: (i32,) = sqlx::query_as(
            "SELECT id FROM users WHERE username = $1",
        )
        .bind("organic_mary")
        .fetch_one(&pool)
        .await
        .expect("Failed to get organic_mary ID");

        let green_grocer_sam_id: (i32,) = sqlx::query_as(
            "SELECT id FROM users WHERE username = $1",
        )
        .bind("green_grocer_sam")
        .fetch_one(&pool)
        .await
        .expect("Failed to get green_grocer_sam ID");

        let fresh_farm_lisa_id: (i32,) = sqlx::query_as(
            "SELECT id FROM users WHERE username = $1",
        )
        .bind("fresh_farm_lisa")
        .fetch_one(&pool)
        .await
        .expect("Failed to get fresh_farm_lisa ID");

        // Sample products with varied categories and descriptions
        let products_data = vec![
            ("Fresh Tomatoes", 50.0, "Vegetables", "Organic red tomatoes, perfect for salads and cooking", farmer_john_id.0),
            ("Bananas", 30.0, "Fruits", "Sweet, ripe bananas from local farms", farmer_john_id.0),
            ("Spinach Bundle", 25.0, "Vegetables", "Fresh green spinach leaves, rich in nutrients", farmer_john_id.0),
            ("Carrots", 40.0, "Vegetables", "Crunchy orange carrots, great for snacking", farmer_john_id.0),
            ("Avocados", 80.0, "Fruits", "Creamy avocados, perfect for guacamole", organic_mary_id.0),
            ("Oranges", 35.0, "Fruits", "Juicy navel oranges, rich in vitamin C", organic_mary_id.0),
            ("Kale", 45.0, "Vegetables", "Nutrient-dense kale leaves, superfood", organic_mary_id.0),
            ("Apples", 60.0, "Fruits", "Crisp red apples, perfect for eating fresh", organic_mary_id.0),
            ("Broccoli", 55.0, "Vegetables", "Fresh broccoli florets, excellent source of vitamins", green_grocer_sam_id.0),
            ("Strawberries", 90.0, "Fruits", "Sweet and juicy strawberries, perfect for desserts", green_grocer_sam_id.0),
            ("Bell Peppers", 65.0, "Vegetables", "Colorful bell peppers, great for stir-fries", green_grocer_sam_id.0),
            ("Grapes", 75.0, "Fruits", "Seedless grapes, naturally sweet and refreshing", green_grocer_sam_id.0),
            ("Zucchini", 35.0, "Vegetables", "Fresh zucchini, versatile for cooking", fresh_farm_lisa_id.0),
            ("Blueberries", 120.0, "Fruits", "Antioxidant-rich blueberries, perfect for smoothies", fresh_farm_lisa_id.0),
            ("Eggplant", 45.0, "Vegetables", "Purple eggplant, ideal for Mediterranean dishes", fresh_farm_lisa_id.0),
            ("Pineapples", 85.0, "Fruits", "Sweet tropical pineapples, great for fresh eating", fresh_farm_lisa_id.0),
            ("Cucumbers", 30.0, "Vegetables", "Cool and crisp cucumbers, perfect for salads", farmer_john_id.0),
            ("Mangoes", 95.0, "Fruits", "Juicy mangoes, tropical delight", organic_mary_id.0),
            ("Lettuce", 20.0, "Vegetables", "Fresh lettuce leaves, essential for sandwiches", green_grocer_sam_id.0),
            ("Pears", 70.0, "Fruits", "Sweet and crunchy pears, perfect for snacking", fresh_farm_lisa_id.0),
            ("Potatoes", 25.0, "Vegetables", "Versatile potatoes, great for many dishes", farmer_john_id.0),
            ("Kiwi", 40.0, "Fruits", "Tangy kiwi fruits, rich in vitamin C", organic_mary_id.0),
            ("Cauliflower", 50.0, "Vegetables", "Fresh cauliflower, low-carb vegetable option", green_grocer_sam_id.0),
            ("Watermelon", 150.0, "Fruits", "Large watermelon, refreshing summer fruit", fresh_farm_lisa_id.0),
        ];

        for (name, price, category, description, vendor_id) in products_data {
            // Add base64 encoded placeholder images for some products
            let image = match name {
                "Fresh Tomatoes" => Some("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmMDAwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkYiPC90ZXh0Pjwvc3ZnPg=="),
                "Bananas" => Some("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmYwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0iYmxhY2siIHRleHQtYW5jaG9yPSJtaWRkbGUiPkIiPC90ZXh0Pjwvc3ZnPg=="),
                "Avocados" => Some("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwODAwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkEiPC90ZXh0Pjwvc3ZnPg=="),
                "Oranges" => Some("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmYTUwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk8iPC90ZXh0Pjwvc3ZnPg=="),
                "Apples" => Some("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmMDAwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkEiPC90ZXh0Pjwvc3ZnPg=="),
                "Strawberries" => Some("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RjMTQzNiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlMiPC90ZXh0Pjwvc3ZnPg=="),
                "Blueberries" => Some("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwMDA4MCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkIiPC90ZXh0Pjwvc3ZnPg=="),
                "Watermelon" => Some("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwZmYwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0iYmxhY2siIHRleHQtYW5jaG9yPSJtaWRkbGUiPlciPC90ZXh0Pjwvc3ZnPg=="),
                _ => None,
            };

            if let Some(img) = image {
                sqlx::query(
                    "INSERT INTO products (name, price, category, description, image, vendor_id) VALUES ($1, $2, $3, $4, $5, $6)",
                )
                .bind(name)
                .bind(price)
                .bind(category)
                .bind(description)
                .bind(img)
                .bind(vendor_id)
                .execute(&pool)
                .await
                .expect("Failed to create sample product");
            } else {
                sqlx::query(
                    "INSERT INTO products (name, price, category, description, vendor_id) VALUES ($1, $2, $3, $4, $5)",
                )
                .bind(name)
                .bind(price)
                .bind(category)
                .bind(description)
                .bind(vendor_id)
                .execute(&pool)
                .await
                .expect("Failed to create sample product");
            }
        }
    }

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
    };

    Ok(user)
}

pub async fn get_cart_items(pool: &PgPool, user_id: i32) -> Result<Vec<CartItem>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            ci.id, ci.user_id, ci.product_id, ci.quantity,
            p.id as p_id, p.name, p.price, p.category, p.description, p.image, p.vendor_id
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
                p.id as p_id, p.name, p.price, p.category, p.description, p.image, p.vendor_id
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
        SELECT id, username, email, role, profile_image, verified, banned
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
        };
        users.push(user);
    }

    Ok(users)
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

pub async fn update_user_profile(pool: &PgPool, user_id: i32, new_username: Option<&str>, new_email: Option<&str>) -> Result<(), sqlx::Error> {
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
            SELECT id, name, price, category, description, image, vendor_id
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
            SELECT p.id, p.name, p.price, p.category, p.description, p.image, p.vendor_id
            FROM products p
            JOIN users u ON p.vendor_id = u.id
            WHERE u.verified = TRUE
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
            vendor_id: row.try_get::<i32, _>(6)? as u32,
        };
        products.push(product);
    }

    Ok(products)
}

pub async fn create_product(pool: &PgPool, name: &str, price: f64, category: &str, description: &str, image: Option<&str>, vendor_id: i32) -> Result<Product, sqlx::Error> {
    let row = if let Some(img) = image {
        sqlx::query(
            r#"
            INSERT INTO products (name, price, category, description, image, vendor_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, price, category, description, image, vendor_id
            "#,
        )
        .bind(name)
        .bind(price)
        .bind(category)
        .bind(description)
        .bind(img)
        .bind(vendor_id)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query(
            r#"
            INSERT INTO products (name, price, category, description, vendor_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, price, category, description, image, vendor_id
            "#,
        )
        .bind(name)
        .bind(price)
        .bind(category)
        .bind(description)
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
        image: row.try_get::<Option<String>, _>(5)?,
        vendor_id: row.try_get::<i32, _>(6)? as u32,
    };

    Ok(product)
}

pub async fn update_product(pool: &PgPool, product_id: i32, name: &str, price: f64, category: &str, description: &str, image: Option<&str>, vendor_id: i32) -> Result<Product, sqlx::Error> {
    let row = if let Some(img) = image {
        sqlx::query(
            r#"
            UPDATE products 
            SET name = $1, price = $2, category = $3, description = $4, image = $5
            WHERE id = $6 AND vendor_id = $7
            RETURNING id, name, price, category, description, image, vendor_id
            "#,
        )
        .bind(name)
        .bind(price)
        .bind(category)
        .bind(description)
        .bind(img)
        .bind(product_id)
        .bind(vendor_id)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query(
            r#"
            UPDATE products 
            SET name = $1, price = $2, category = $3, description = $4
            WHERE id = $5 AND vendor_id = $6
            RETURNING id, name, price, category, description, image, vendor_id
            "#,
        )
        .bind(name)
        .bind(price)
        .bind(category)
        .bind(description)
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
        image: row.try_get::<Option<String>, _>(5)?,
        vendor_id: row.try_get::<i32, _>(6)? as u32,
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
            p.id as p_id, p.name, p.price, p.category, p.description, p.image, p.vendor_id,
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
