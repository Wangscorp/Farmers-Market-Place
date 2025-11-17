# Farmers Market Place

A full-stack web application for connecting farmers/vendors with customers, built with React (frontend), Rust/Actix (backend), and PostgreSQL (database).

## Prerequisites

Before running the application, ensure you have the following installed:

### Node.js (v16 or higher) - for the frontend

Download and install Node.js from [nodejs.org](https://nodejs.org/) or use a package manager:

**On Ubuntu/Debian Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**On macOS (using Homebrew):**
```bash
brew install node
```

Verify installation:
```bash
node --version
npm --version
```

### Rust/Cargo (latest stable version) - for the backend

Install Rust using rustup (the official installer):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Verify installation:
```bash
rustc --version
cargo --version
```

### PostgreSQL - for the database

**On Ubuntu/Debian Linux:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**On macOS (using Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**On Windows:** Download and install from [postgresql.org](https://www.postgresql.org/download/windows/).

Create a database user (replace 'your_username' and 'your_password' with your preferred credentials):

**On Linux/macOS:**
```bash
sudo -u postgres createuser --createdb your_username
sudo -u postgres psql -c "ALTER USER your_username WITH PASSWORD 'your_password';"
```

**On Windows:** Open Command Prompt as Administrator and run:
```cmd
createuser --createdb --username postgres your_username
psql --username postgres --command "ALTER USER your_username WITH PASSWORD 'your_password';"
```

### Database Setup

1. Start your PostgreSQL server
2. Create a database named `farmers_market`
3. Optionally set the `DATABASE_URL` environment variable. If not set, the default is:
   ```
   postgres://user:password@localhost/farmers_market
   ```

## Installation

### Backend Installation

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Install dependencies (this will download Rust crates):
   ```bash
   cargo build
   ```

### Frontend Installation

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

Start the backend and frontend in separate terminals:

### Backend
1. In the `backend` directory:
   ```bash
   cargo run
   ```
   The backend will start on [`http://127.0.0.1:8080`](http://127.0.0.1:8080)

### Frontend
1. In the `frontend` directory:
   ```bash
   npm run dev
   ```
   The frontend will start on [`http://localhost:5173`](http://localhost:5173) (opens automatically in browser)

## How It Works

- **Backend**: Built with Rust and Actix-Web, providing REST API endpoints
- **Frontend**: React application using Vite for fast development
- **Database**: PostgreSQL for data persistence
- **Connection**: Frontend communicates with backend via HTTP requests (localhost:5173 → localhost:8080)

The application supports user authentication with roles (Admin, Vendor, Customer) and features like product management, shopping cart, vendor dashboards, and more.

## Codebase Guide

### Backend Structure (`/backend`)

#### Core Files
- **`src/main.rs`** - Application entry point and server initialization
- **`src/routes.rs`** - All HTTP API endpoints and route handlers
- **`src/models.rs`** - Data structures and database serialization
- **`src/db.rs`** - Database connection and query functions
- **`src/mpesa.rs`** - M-Pesa payment integration

#### Key API Endpoints
- **Authentication**: `/login`, `/signup` (JWT-based)
- **Products**: `/products` (CRUD operations)
- **Cart**: `/cart` (shopping cart management)
- **Orders**: `/shipping` (order/shipping management)
- **Location**: `/location/update` (user location updates)
- **Payments**: `/checkout`, `/mpesa/callback` (M-Pesa integration)

### Frontend Structure (`/frontend`)

#### Core Components (`/src/components`)
- **`UserContext.jsx`** - Global user state and geolocation management
- **`Auth.jsx`** - Login/signup forms with location collection
- **`Products.jsx`** - Product browsing with location-based filtering
- **`Cart.jsx`** - Shopping cart functionality
- **`Shipping.jsx`** - Order management ("My Orders" page)
- **`VendorDashboard.jsx`** - Vendor product management
- **`AdminDashboard.jsx`** - Administrative functions

#### API Integration
- **`src/api.js`** - Axios configuration for backend communication
- **`src/hooks/useUser.jsx`** - User authentication hook

#### Styling
- **`src/App.css`** - Global styles and CSS variables
- **Component-specific CSS** - Individual component styling

### Database Schema & Connections

#### Database Setup
- **`backend/Cargo.toml`** - Rust dependencies including SQLx for database
- **Environment**: `DATABASE_URL` environment variable (see `.env.example`)
- **Connection**: PostgreSQL with connection pooling via SQLx

#### Key Models (User Data)
```rust
// Location fields in user model
pub struct User {
    pub id: i32,
    pub username: String,
    pub latitude: Option<f64>,        // GPS coordinates
    pub longitude: Option<f64>,       // GPS coordinates
    pub location_string: Option<String>, // Manual location text
    // ... other fields
}
```

#### Database Tables
- **`users`** - User accounts with location data
- **`products`** - Products with vendor location filtering
- **`cart_items`** - Shopping cart contents
- **`shipping_orders`** - Order and shipping status
- **`payment_transactions`** - M-Pesa payment records

### Authentication & Security

#### JWT Authentication
- **Generation**: `src/models.rs::create_jwt()`
- **Verification**: `src/models.rs::verify_jwt()`
- **Storage**: Frontend localStorage (`token` key)
- **Middleware**: `src/routes.rs` route guards (`check_customer_auth`, etc.)

#### User Roles & Permissions
- **Admin**: Full system access (`check_admin_auth`)
- **Vendor**: Product management (`check_vendor_auth`)
- **Customer**: Shopping features (`check_customer_auth`)

### Location System

#### Geolocation Features
- **Frontend Collection**: `UserContext.jsx` + `Auth.jsx` signup
- **Automatic Detection**: Browser Geolocation API
- **Manual Input**: City/location text input
- **Storage**: Database `latitude/longitude` or `location_string`

#### Location-Based Filtering
- **Product Discovery**: `Products.jsx` with distance-based search
- **Query Parameters**: `lat`, `lng`, `max_distance` in `/products` API
- **Algorithm**: Haversine formula for distance calculation

#### Location Endpoints
- **Update Location**: `POST /location/update`
- **Product Filtering**: `GET /products?lat=X&lng=Y&max_distance=Z`

### Payment Integration

#### M-Pesa System
- **Client**: `src/mpesa.rs::MpesaClient`
- **Endpoints**: `/checkout` (initiate), `/mpesa/callback` (confirmation)
- **Flow**: STK Push → User PIN entry → Callback confirmation
- **Database**: `payment_transactions` and `shipping_orders` tables

### Development Workflow

#### Environment Setup
```bash
# Backend (.env)
DATABASE_URL=postgres://user:pass@localhost/farmers_market

# Frontend (.env)
VITE_API_URL=http://localhost:8080
```

#### Key Development Files
- **`backend/src/lib.rs`** - (if exists) shared utilities
- **`frontend/src/main.jsx`** - React app entry point
- **`frontend/vite.config.js`** - Frontend build configuration
- **`backend/Cargo.toml`** - Backend dependencies and metadata

### Quick File Reference

| Feature | Backend | Frontend | Database |
|---------|---------|----------|----------|
| User Auth | `routes.rs`, `models.rs` | `UserContext.jsx`, `Auth.jsx` | `users` table |
| Products | `routes.rs::get_products` | `Products.jsx` | `products` table |
| Cart | `routes.rs::cart_*` | `Cart.jsx`, `CartContext.jsx` | `cart_items` table |
| Orders | `routes.rs::shipping_*` | `Shipping.jsx` | `shipping_orders` table |
| Location | `routes.rs::update_location` | `UserContext.jsx`, `Auth.jsx` | `users.latitude/longitude` |
| Payments | `mpesa.rs`, `routes.rs` | Cart integration | `payment_transactions` table |
| Admin | Admin routes in `routes.rs` | `AdminDashboard.jsx` | All tables |

## Environment Configuration

The application uses environment variables for configuration:

- Copy `.env.example` to `backend/.env` and `frontend/.env`
- Set `DATABASE_URL` in backend/.env with your PostgreSQL connection string
- Set `VITE_API_URL` in frontend/.env with your backend URL (e.g., `http://localhost:8080` for local)

For production deployment, ensure these are set in your hosting platform's environment variables.

## Deployment

### Recommended: Railway + Vercel

#### 1. Backend (Railway)

Railway provides free tier with PostgreSQL database.

1. Go to [Railway.app](https://railway.app) and connect your GitHub account
2. Create a new project and select your repository
3. Railway will auto-detect the Rust backend and provide a PostgreSQL database
4. Set environment variables in Railway dashboard:
   - `DATABASE_URL` (auto-provided by Railway's database service)
5. The backend will deploy automatically on code pushes

#### 2. Frontend (Vercel)

1. Go to [Vercel.com](https://vercel.com) and connect your GitHub
2. Create a new project, select your repository
3. Configure build settings:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variables:
   - `VITE_API_URL`: Your Railway backend URL (e.g., `https://farmers-market-production.up.railway.app`)
5. Deploy

#### Alternative Deployment Options

- **Backend**: Heroku, Railway, or any cloud provider with Rust support
- **Frontend**: Netlify, GitHub Pages, or any static hosting
- **Database**: Use managed PostgreSQL from providers like Supabase, Railway, or AWS

## Sample Data & Testing

The application automatically creates sample data on first run for testing purposes:

### Sample Users
- **Admin**: username: `admin`, password: `admin123`
- **Vendor 1**: username: `farmer_john`, password: `vendor123`
- **Vendor 2**: username: `organic_mary`, password: `vendor123`
- **Customer**: username: `customer_alice`, password: `customer123`

### Sample Products
- Fresh Tomatoes (KSh 50) - farmer_john
- Bananas (KSh 30) - farmer_john
- Spinach Bundle (KSh 25) - farmer_john
- Carrots (KSh 40) - farmer_john
- Avocados (KSh 80) - organic_mary
- Oranges (KSh 35) - organic_mary
- Kale (KSh 45) - organic_mary
- Apples (KSh 60) - organic_mary

### Testing M-Pesa Payment

1. Log in as `customer_alice` (password: `customer123`)
2. Add some products to your cart from the marketplace
3. Go to your cart and enter a M-Pesa number (format: 07XXXXXXXX, e.g., 0712345678)
4. Click "Pay with M-Pesa"
5. The system will simulate payment initiation and show a transaction ID

## Available Scripts

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Backend
- `cargo run` - Start the server
- `cargo build` - Build the project
- `cargo test` - Run tests

## Default Credentials

A default admin user is created automatically:

- Username: `admin`
- Password: `admin123`
