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
```

Verify installation:

```bash
node --version
npm --version
```
npm --version
```

### Rust/Cargo (latest stable version) - for the backend

Install Rust using rustup (the official installer):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
Verify installation:

```bash
rustc --version
cargo --version
```
rustc --version
cargo --version
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

**Note for Windows:**

- After installation, PostgreSQL service should start automatically
- Use pgAdmin (installed with PostgreSQL) to create the database if needed
- Or use Windows Command Prompt/PowerShell instead of bash

Create a database user (replace 'your_username' and 'your_password' with your preferred credentials):

- **On Linux/macOS:**

  ```bash
  sudo -u postgres createuser --createdb your_username
  sudo -u postgres psql -c "ALTER USER your_username WITH PASSWORD 'your_password';"
  ```

- **On Windows:** Open Command Prompt as Administrator and run:

  ```cmd
  createuser --createdb --username postgres your_username
  psql --username postgres --command "ALTER USER your_username WITH PASSWORD 'your_password';"
  ```

Verify installation:

### Database Setup

1. Start your PostgreSQL server
2. Create a database named `farmers_market`
3. Optionally set the `DATABASE_URL` environment variable. If not set, the default is:

   ```text
   postgres://user:password@localhost/farmers_market
   ```

### Backend Installation

1. Navigate to the `backend` directory:

   ```bash
   cd backend
   ```

2. Install dependencies (this will download Rust crates):

   ```bash
### Frontend Installation

1. Navigate to the `frontend` directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```
   cd backend
   ```
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
   npm install
   ```

## Running the Application

Start the backend and frontend in separate terminals:

### Backend
1. In the `backend` directory:
   ```
   cargo run
   ```
   The backend will start on `http://127.0.0.1:8080`

### Frontend
1. In the `frontend` directory:
   ```
   npm run dev
   ```
   The frontend will start on `http://localhost:5173` (opens automatically in browser)

## How It Works

- **Backend**: Built with Rust and Actix-Web, providing REST API endpoints
- **Frontend**: React application using Vite for fast development
- **Database**: PostgreSQL for data persistence
- **Connection**: Frontend communicates with backend via HTTP requests (localhost:5173 → localhost:8080)

The application supports user authentication with roles (Admin, Vendor, Customer) and features like product management, shopping cart, vendor dashboards, and more.
**User Roles:**

- **Admin**: Full system access, user management
- **Vendor**: Can add/manage products for sale
- **Customer**: Can browse, search, and purchase products

**Cross-Platform Notes:**

- The application runs identically on Windows, macOS, and Linux
- Use Command Prompt or PowerShell on Windows instead of bash
- PostgreSQL installation differs slightly by platform (see prerequisites)
- All paths and commands work the same way across platforms
   - For quick testing, use the demo admin account
The application uses environment variables for configuration:

- Copy `.env.example` to `backend/.env` and `frontend/.env`
- Set `DATABASE_URL` in backend/.env with your PostgreSQL connection string
- Set `VITE_API_URL` in frontend/.env with your backend URL (e.g., [Railway backend](https://your-railway-backend.up.railway.app) for deployed, or [`http://localhost:8080`](http://localhost:8080) for local)

For production deployment, ensure these are set in your hosting platform's environment variables.
   - Access the Vendor Dashboard via the navigation
   - Add new products with descriptions, prices, and images
   - Manage your existing products
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
   - `VITE_API_URL`: Your Railway backend URL (e.g., [Production Railway backend](https://farmers-market-production.up.railway.app))
5. Deploy
- Set `VITE_API_URL` in frontend/.env with your backend URL (e.g., https://your-railway-backend.up.railway.app for deployed, or http://localhost:8080 for local)
**Full-stack on Railway:**

- Deploy both frontend and backend to single Railway service
- Use Railway's static site hosting for frontend
- Manual database setup required

**Separate Services:**

- Backend: Heroku, Railway, or any cloud provider with Rust support
- Frontend: Netlify, GitHub Pages, or any static hosting
## Default Credentials

A default admin user is created automatically:

- Username: `admin`
- Password: `admin123`

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

#### Alternative Deployment Options

**Full-stack on Railway:**
- Deploy both frontend and backend to single Railway service
- Use Railway's static site hosting for frontend
- Manual database setup required

**Separate Services:**
- Backend: Heroku, Railway, or any cloud provider with Rust support
- Frontend: Netlify, GitHub Pages, or any static hosting
- Database: Use managed PostgreSQL from providers like Supabase, Railway, or AWS

## Default Credentials

A default admin user is created automatically:

- Username: `admin`
- Password: `admin123`

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
