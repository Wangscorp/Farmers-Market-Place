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
            verified BOOLEAN NOT NULL DEFAULT FALSE
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
            price DECIMAL(10,2) NOT NULL,
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
        .bind(true)
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
        .bind(false)
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
            description: row.try_get("description")?,
            image: row.try_get("image")?,
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
            description: row.try_get("description")?,
            image: row.try_get("image")?,
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
            description: row.try_get("p_description")?,
            image: row.try_get("p_image")?,
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
        description: row.try_get("p_description")?,
        image: row.try_get("p_image")?,
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
        SELECT id, username, email, role, profile_image, verified
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
            SELECT id, name, price, category, description, image, vendor_id
            FROM products
            ORDER BY id
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
            description: row.try_get(4)?,
            image: row.try_get(5)?,
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
        description: row.try_get(4)?,
        image: row.try_get(5)?,
        vendor_id: row.try_get::<i32, _>(6)? as u32,
    };

    Ok(product)
}
