//! Utility to hash passwords using bcrypt.
//! Usage: cargo run --bin hash_password <password>

use bcrypt::{hash, DEFAULT_COST};
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        eprintln!("Usage: cargo run --bin hash_password <password>");
        std::process::exit(1);
    }
    
    let password = &args[1];
    
    match hash(password, DEFAULT_COST) {
        Ok(hashed) => {
            println!("Password hash for '{}':", password);
            println!("{}", hashed);
        }
        Err(e) => {
            eprintln!("Error hashing password: {}", e);
            std::process::exit(1);
        }
    }
}
