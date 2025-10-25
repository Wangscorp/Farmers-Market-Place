/**
 * Farmers Market Place Backend - Main entry point
 *
 * This is the main Rust/Actix-Web server application that provides REST API endpoints
 * for a farmers market platform where vendors can sell products to customers.
 */

use actix_web::{App, HttpServer, web};
use actix_cors::Cors;
use std::io;

mod db;      // Database initialization and connection
mod models;  // Data models for the application
mod routes;  // HTTP route handlers

/**
 * Main application entry point
 *
 * Sets up and starts the Actix-Web HTTP server with:
 * - Database connection pool for PostgreSQL
 * - CORS middleware for cross-origin requests
 * - Route configuration for API endpoints
 * - Server binding to localhost:8080
 */
#[actix_web::main]
async fn main() -> io::Result<()> {
    // Load environment variables from .env file
    dotenv::dotenv().ok();

    // Initialize the application logging
    println!("Starting Farmers Market Place Backend...");

    // Initialize database connection pool
    // This creates tables if they don't exist and connects to PostgreSQL
    let pool = db::init_db().await;

    // Create and start the HTTP server
    HttpServer::new(move || {
        // Configure CORS to allow cross-origin requests from frontend
        let cors = Cors::permissive();

        // Build the application with state and middleware
        App::new()
            .app_data(web::Data::new(pool.clone()))  // Share DB pool across requests
            .wrap(cors)                              // Apply CORS middleware
            .configure(routes::init)                 // Configure route handlers
    })
    .bind("127.0.0.1:8080")?  // Bind to localhost on port 8080
    .run()                    // Run the server indefinitely
    .await
}
