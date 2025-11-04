# Farmers Market Place - Run Guide

This guide will help you set up and run the Farmers Market Place application, which consists of a React frontend and a Rust/Actix-web backend with PostgreSQL database.

## Prerequisites

Before running the application, ensure you have the following installed:

- **Rust**: Install from [rustup.rs](https://rustup.rs/)
- **Node.js**: Version 16+ (includes npm)
- **PostgreSQL**: Version 12+ or a Supabase account
- **Git**: For cloning the repository

## Project Structure

```
FarmersMarketPlace/
├── backend/          # Rust/Actix-web API server
│   ├── .env.example  # Backend environment template
│   ├── Cargo.toml    # Rust dependencies
│   └── src/          # Source code
├── frontend/         # React/Vite web application
│   ├── .env.example  # Frontend environment template
│   ├── package.json  # Node.js dependencies
│   └── src/          # Source code
├── .env.example      # Root environment template
├── .gitignore        # Git ignore rules
└── Run.md           # This file
```

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd FarmersMarketPlace
```

### 2. Database Setup

You have two options for the database:

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL and create database
createdb farmers_market

# Or using psql
psql -U postgres -c "CREATE DATABASE farmers_market;"
```

#### Option B: Supabase (Recommended)
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Get your database URL from Project Settings > Database

### 3. Environment Configuration

#### Backend Environment Variables
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your database connection:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost/farmers_market"
# OR for Supabase:
DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@db.[project-ref].supabase.co:5432/postgres"

# JWT Secret (generate a secure random string)
JWT_SECRET="your-secure-jwt-secret-key-change-this-in-production"

# Optional: Supabase Configuration
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

#### Frontend Environment Variables (Optional)
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:8080
```

### 4. Install Dependencies

#### Backend Dependencies
```bash
cd backend
cargo build
```

#### Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 5. Run the Application

#### Start Backend Server
```bash
cd backend
cargo run
```
The backend will start on `http://localhost:8080`

#### Start Frontend (in a new terminal)
```bash
cd frontend
npm run dev
```
The frontend will start on `http://localhost:5173`

### 6. Access the Application

Open your browser and navigate to `http://localhost:5173`

## Default Admin Account

The application creates a default admin account on first run:
- **Username**: `admin`
- **Password**: `admin123`

Use this account to access the admin dashboard and manage users/vendors.

## Database Schema

The application automatically creates the following tables:

- **users**: User accounts (Admin, Vendor, Customer roles)
- **products**: Products listed by vendors
- **cart_items**: Shopping cart items
- **vendor_reports**: Customer reports about vendors

## Viewing Database

### Using psql (Local PostgreSQL)

```bash
# Connect to database
psql -U postgres -d farmers_market

# List tables
\d

# View users
SELECT * FROM users;

# View products
SELECT * FROM products;

# View cart items
SELECT * FROM cart_items;

# View vendor reports
SELECT * FROM vendor_reports;
```

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to "Table Editor"
3. Browse and query your tables directly in the web interface

### Using Database GUI Tools

- **pgAdmin**: Free PostgreSQL administration tool
- **DBeaver**: Universal database tool
- **TablePlus**: Modern database client

## API Endpoints

The backend provides REST API endpoints on `http://localhost:8080`:

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### Products
- `GET /products` - Get all products
- `POST /products` - Create product (vendors only)
- `PUT /products/{id}` - Update product (vendors only)
- `DELETE /products/{id}` - Delete product (vendors only)

### Cart
- `GET /cart` - Get user's cart
- `POST /cart` - Add item to cart
- `PUT /cart/{id}` - Update cart item quantity
- `DELETE /cart/{id}` - Remove item from cart

### Admin
- `GET /admin/users` - Get all users
- `PUT /admin/users/{id}/role` - Update user role
- `PUT /admin/users/{id}/verify` - Verify vendor
- `DELETE /admin/users/{id}` - Delete user

### Vendor Reports
- `POST /reports` - Create vendor report
- `GET /reports` - Get all reports (admin only)
- `PUT /reports/{id}/status` - Update report status (admin only)

## Development Commands

### Frontend
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Backend
```bash
cd backend
cargo run        # Run development server
cargo build      # Build release
cargo test       # Run tests
cargo check      # Check code without building
```

## Troubleshooting

### Backend Issues
- **Database connection failed**: Check your `DATABASE_URL` in `backend/.env`
- **Port 8080 already in use**: Kill the process using the port or change the port in `main.rs`
- **Compilation errors**: Run `cargo clean` and `cargo build`

### Frontend Issues
- **API connection failed**: Ensure backend is running on port 8080
- **Build errors**: Run `npm install` to ensure all dependencies are installed
- **Port 5173 already in use**: Vite will automatically use the next available port

### Database Issues
- **Permission denied**: Ensure your PostgreSQL user has proper permissions
- **Connection timeout**: Check if PostgreSQL service is running
- **Migration errors**: The app creates tables automatically, but you may need to drop and recreate the database

## Production Deployment

For production deployment:

1. Set secure environment variables (especially `JWT_SECRET`)
2. Use a production database (Supabase recommended)
3. Build the frontend: `npm run build`
4. Serve frontend statically and deploy backend to a server
5. Configure proper CORS settings
6. Set up SSL/HTTPS

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify all prerequisites are installed
3. Ensure environment variables are correctly set
4. Check database connectivity

The application includes comprehensive error handling and logging to help with debugging.
