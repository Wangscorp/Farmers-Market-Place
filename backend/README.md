# Farmers Market Place Backend

A Rust/Actix-Web backend for a farmers market platform where vendors can sell products to customers.

## Features

- User authentication and authorization (Admin, Vendor, Customer roles)
- Product management for vendors
- Shopping cart functionality
- M-Pesa payment integration (simulated)
- Admin dashboard for user and report management
- Vendor verification system

## Setup

1. Install Rust and Cargo (if not already installed)
2. Set up PostgreSQL database
3. Copy `.env.example` to `.env` and configure your database URL
4. Run the application: `cargo run`

## Sample Data

The application automatically creates sample data on first run:

### Users
- **Admin**: username: `admin`, password: `admin123`
- **Vendor 1**: username: `farmer_john`, password: `vendor123`
- **Vendor 2**: username: `organic_mary`, password: `vendor123`
- **Customer**: username: `customer_alice`, password: `customer123`

### Products
- Fresh Tomatoes (KSh 50) - farmer_john
- Bananas (KSh 30) - farmer_john
- Spinach Bundle (KSh 25) - farmer_john
- Carrots (KSh 40) - farmer_john
- Avocados (KSh 80) - organic_mary
- Oranges (KSh 35) - organic_mary
- Kale (KSh 45) - organic_mary
- Apples (KSh 60) - organic_mary

## API Endpoints

### Authentication
- `POST /login` - User login
- `POST /signup` - User registration

### Products
- `GET /products` - Get all products
- `POST /products` - Create product (vendors only)
- `PATCH /products/{id}` - Update product (vendors only)
- `DELETE /products/{id}` - Delete product (vendors only)

### Cart
- `GET /cart` - Get user's cart
- `POST /cart` - Add item to cart
- `PATCH /cart/{id}` - Update cart item quantity
- `DELETE /cart/{id}` - Remove item from cart

### Payment
- `POST /checkout` - Process M-Pesa payment

### Admin (requires admin role)
- `GET /api/admin/users` - Get all users
- `PATCH /api/admin/users/{id}` - Update user role
- `PATCH /api/admin/users/{id}/verify` - Verify user
- `DELETE /api/admin/users/{id}` - Delete user
- `GET /api/admin/cart` - Get all cart items

## Testing M-Pesa Payment

1. Log in as `customer_alice` (password: `customer123`)
2. Add some products to cart
3. Go to cart and enter M-Pesa number (format: 07XXXXXXXX)
4. Click "Pay with M-Pesa"
5. The system will simulate payment initiation and show a transaction ID

## Development

- Backend runs on `http://localhost:8080`
- Frontend runs on `http://localhost:5173` (Vite dev server)
- Database: PostgreSQL (configured via DATABASE_URL env var)

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `SUPABASE_URL`: Optional Supabase URL
- `SUPABASE_ANON_KEY`: Optional Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Optional Supabase service role key
