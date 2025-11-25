# Farmers Market Place 🌾

A comprehensive full-stack marketplace platform connecting farmers, vendors, and customers with advanced features including real-time chat, vendor verification system, location-based product discovery, and integrated M-Pesa payments.

**Tech Stack:** React + Vite (Frontend) • Rust + Actix-Web (Backend) • PostgreSQL (Database)

## ✨ Key Features

### 🔐 **Authentication & User Management**

- JWT-based authentication with role-based access (Admin, Vendor, Customer)
- Username-based password reset system
- Vendor verification process with document upload
- Automatic verification rejection handling with user notifications

### 🛒 **Marketplace Functionality**

- Location-based product discovery using GPS coordinates
- Advanced shopping cart with persistent state
- Real-time inventory management
- Product search and filtering

### 💬 **Communication**

- Integrated chatbot for customer support
- Real-time messaging between users
- Vendor-customer communication channels

### 💳 **Payment Integration**

- M-Pesa STK Push integration
- Secure payment processing
- Transaction history and receipts
- Order tracking and shipping management

### 📍 **Location Services**

- GPS-based vendor/customer matching
- Distance-based product filtering
- Manual location input for flexibility

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16+) - [Download here](https://nodejs.org/)
- **Rust** (latest stable) - Install via [rustup](https://rustup.rs/)
- **PostgreSQL** (v12+) - [Installation guide](https://www.postgresql.org/download/)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Wangscorp/Farmers-Market-Place.git
   cd Farmers-Market-Place
   ```

2. **Setup Backend**

   ```bash
   cd backend
   cargo build
   ```

3. **Setup Frontend**

   ```bash
   cd frontend
   npm install
   ```

4. **Database Setup**

   ```bash
   # Create PostgreSQL database
   createdb farmers_market

   # Set DATABASE_URL (optional - defaults to localhost)
   export DATABASE_URL="postgres://username:password@localhost/farmers_market"
   ```

### Running the Application

**Terminal 1 - Backend:**

```bash
cd backend
cargo run
```

Server starts at `http://127.0.0.1:8080`

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

Application opens at `http://localhost:5173`

## 🏗️ Architecture Overview

The application follows a modern three-tier architecture:

- **Frontend (React + Vite)**: Modern SPA with responsive design and real-time updates
- **Backend (Rust + Actix-Web)**: High-performance REST API with JWT authentication
- **Database (PostgreSQL)**: Reliable data persistence with ACID compliance
- **Communication**: HTTP/HTTPS with JSON payloads (Frontend ↔ Backend)

## 🔑 Default Test Accounts

| Role     | Username         | Password      | Description        |
| -------- | ---------------- | ------------- | ------------------ |
| Admin    | `admin`          | `admin123`    | Full system access |
| Vendor   | `farmer_john`    | `vendor123`   | Product management |
| Vendor   | `organic_mary`   | `vendor123`   | Alternative vendor |
| Customer | `customer_alice` | `customer123` | Shopping features  |

## 🧪 Testing Features

### Payment Testing (M-Pesa)

1. Login as `customer_alice`
2. Add products to cart
3. Use phone number: `0712345678` (test number)
4. Complete checkout flow with simulated M-Pesa response

### Vendor Verification Testing

1. Login as a vendor account
2. Upload verification documents (any image file)
3. Admin can approve/reject from admin dashboard
4. Rejected users see notification on next login

## 🚀 Deployment Options

### Option 1: Railway + Vercel (Recommended)

**Backend (Railway):**

1. Connect GitHub repo to [Railway](https://railway.app)
2. Add PostgreSQL database service
3. Deploy automatically on git push

**Frontend (Vercel):**

1. Connect repo to [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variable: `VITE_API_URL=https://your-backend-url`

### Option 2: Docker Deployment

**Backend Dockerfile:**

```dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY backend/ .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/backend /usr/local/bin/backend
EXPOSE 8080
CMD ["backend"]
```

**Frontend Dockerfile:**

```dockerfile
FROM node:18 as builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🔧 Environment Configuration

### Backend (.env)

```env
DATABASE_URL=postgres://username:password@localhost/farmers_market
RUST_LOG=debug
JWT_SECRET=your-secret-key-here
SMTP_SERVER=smtp.gmail.com
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8080
VITE_GEMINI_API_KEY=your-gemini-api-key
```

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint             | Description                       | Auth Required |
| ------ | -------------------- | --------------------------------- | ------------- |
| POST   | `/login`             | User login with username/password | No            |
| POST   | `/signup`            | User registration                 | No            |
| POST   | `/send-reset-code`   | Initiate password reset           | No            |
| POST   | `/verify-reset-code` | Verify reset code                 | No            |
| POST   | `/reset-password`    | Complete password reset           | No            |

### Product Endpoints

| Method | Endpoint         | Description                          | Auth Required |
| ------ | ---------------- | ------------------------------------ | ------------- |
| GET    | `/products`      | Get all products (location-filtered) | No            |
| POST   | `/products`      | Create new product                   | Vendor        |
| PUT    | `/products/{id}` | Update product                       | Vendor        |
| DELETE | `/products/{id}` | Delete product                       | Vendor        |

### Cart & Orders

| Method | Endpoint     | Description               | Auth Required |
| ------ | ------------ | ------------------------- | ------------- |
| GET    | `/cart`      | Get user's cart items     | Customer      |
| POST   | `/cart`      | Add item to cart          | Customer      |
| PUT    | `/cart/{id}` | Update cart item quantity | Customer      |
| DELETE | `/cart/{id}` | Remove item from cart     | Customer      |
| POST   | `/checkout`  | Process M-Pesa payment    | Customer      |
| GET    | `/shipping`  | Get user's orders         | Customer      |

### Admin Endpoints

| Method | Endpoint                       | Description                        | Auth Required |
| ------ | ------------------------------ | ---------------------------------- | ------------- |
| GET    | `/admin/users`                 | Get all users                      | Admin         |
| GET    | `/admin/pending-verifications` | Get pending vendor verifications   | Admin         |
| POST   | `/admin/update-verification`   | Approve/reject vendor verification | Admin         |

## 🏗️ Project Structure

### Backend (`/backend/src/`)

- **`main.rs`** - Application entry point and server setup
- **`routes.rs`** - REST API endpoints and request handlers
- **`models.rs`** - Data structures and JWT handling
- **`db.rs`** - Database operations and queries
- **`mpesa.rs`** - M-Pesa payment integration
- **`email.rs`** - Email notification system
- **`gemini.rs`** - AI chatbot integration

### Frontend (`/frontend/src/`)

**Core Components:**

- **`UserContext.jsx`** - Global state management
- **`Auth.jsx`** - Authentication forms with password reset
- **`Products.jsx`** - Product catalog with location filtering
- **`Cart.jsx`** - Shopping cart management
- **`VendorDashboard.jsx`** - Vendor product management
- **`AdminDashboard.jsx`** - Admin user/verification management
- **`Chat.jsx`** - Real-time messaging
- **`Chatbot.jsx`** - AI customer support

**Specialized Components:**

- **`VerificationUpload.jsx`** - Vendor document verification
- **`MpesaTest.jsx`** - Payment testing interface
- **`Shipping.jsx`** - Order tracking and management

## 🛠️ Development Commands

### Backend Commands

```bash
cargo run          # Start development server
cargo build        # Build the project
cargo test         # Run tests
cargo check        # Check code without building
```

### Frontend Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

## 🔒 Security Features

- **JWT Authentication** with role-based access control
- **Password Hashing** using bcrypt with salt
- **CORS Protection** configured for specific origins
- **Input Validation** on all API endpoints
- **SQL Injection Prevention** via parameterized queries
- **XSS Protection** through React's built-in escaping
- **HTTPS Ready** for production deployment

## 🎯 Key Features Implemented

### ✅ User Management

- Multi-role authentication (Admin/Vendor/Customer)
- Username-based password reset system
- Account verification with document upload
- Automatic cleanup of rejected verifications

### ✅ E-commerce Core

- Location-based product discovery
- Shopping cart with persistent state
- M-Pesa payment integration
- Order tracking and management
- Real-time inventory updates

### ✅ Communication

- AI-powered chatbot support
- Real-time messaging between users
- Email notifications for important events

### ✅ Admin Features

- User management dashboard
- Vendor verification approval/rejection
- System-wide analytics and reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Wangscorp/Farmers-Market-Place/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Wangscorp/Farmers-Market-Place/discussions)
- **Email**: [support@farmersmarketplace.com](mailto:support@farmersmarketplace.com)

## 🙏 Acknowledgments

- Built with ❤️ using Rust, React, and PostgreSQL
- M-Pesa integration for seamless African payments
- AI-powered features via Gemini API
- Modern web technologies for optimal performance

---

### 🌾 Happy Farming & Trading! 🌾
