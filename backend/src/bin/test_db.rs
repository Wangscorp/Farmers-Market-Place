use sqlx::{postgres::PgPoolOptions, Row};

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql:///farmers_market?user=wangs".to_string());
    
    println!("Connecting to: {}", database_url);
    
    match PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url)
        .await 
    {
        Ok(pool) => {
            println!("✅ Connected successfully!");
            
            match sqlx::query("SELECT COUNT(*) as cnt FROM users")
                .fetch_one(&pool)
                .await 
            {
                Ok(row) => {
                    let count: i64 = row.get("cnt");
                    println!("✅ Query successful! User count: {}", count);
                }
                Err(e) => {
                    println!("❌ Query failed: {:?}", e);
                }
            }
        }
        Err(e) => {
            println!("❌ Connection failed: {:?}", e);
        }
    }
}
