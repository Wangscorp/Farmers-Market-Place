//! Farmers Market Place backend server.
//! Provides REST API endpoints for products, users, messaging, and M-Pesa payments.

use actix_web::{App, HttpServer, web};
use actix_cors::Cors;
use std::io;

mod db;
mod models;
mod routes;
mod mpesa;
mod gemini;
mod email;

/// Entry point: initializes database and starts HTTP server on port 8080.
#[actix_web::main]
async fn main() -> io::Result<()> {
    dotenv::dotenv().ok();
    println!("Starting Farmers Market Place Backend...");

    let pool = db::init_db().await;
    
    println!("🚀 Starting HTTP server on http://127.0.0.1:8080");

    let server = HttpServer::new(move || {
        println!("🔧 Configuring app instance...");
        let cors = Cors::permissive();
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .wrap(cors)
            .configure(routes::init)
    })
    .bind("127.0.0.1:8080")?;
    
    println!("✅ Server bound to port 8080, starting...");
    
    server.run().await
}
