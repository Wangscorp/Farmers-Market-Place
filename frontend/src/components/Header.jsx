import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useUser } from "../hooks/useUser";
import { useState } from "react";
import "./Header.css";

const Header = () => {
  const { user, logout } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    setMenuOpen(false);
  };

  return (
    <header>
      <div className="header-container">
        <h1>Farmers Market Place</h1>
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <nav className={menuOpen ? "active" : ""}>
        <Link to="/" onClick={() => setMenuOpen(false)}>
          Home
        </Link>
        <Link to="/products" onClick={() => setMenuOpen(false)}>
          Products
        </Link>
        {user?.role !== "Vendor" && (
          <Link to="/cart" onClick={() => setMenuOpen(false)}>
            Cart
          </Link>
        )}
        {user?.role === "Customer" && (
          <Link to="/shipping" onClick={() => setMenuOpen(false)}>
            My Orders
          </Link>
        )}
        {user && user.role !== "Admin" && (
          <Link to="/messages" onClick={() => setMenuOpen(false)}>
            Messages
          </Link>
        )}
        {user ? (
          <>
            <Link
              to={
                user.role === "Vendor"
                  ? "/vendor"
                  : user.role === "Admin"
                  ? "/admin"
                  : "/customer"
              }
              onClick={() => setMenuOpen(false)}
              className="user-profile-link"
            >
              <div className="user-profile">
                {user.profile_image ? (
                  <img
                    src={
                      user.profile_image.startsWith("data:")
                        ? user.profile_image
                        : `data:image/jpeg;base64,${user.profile_image}`
                    }
                    alt={user.username}
                    className="profile-image"
                    title={`${user.username} - Go to Dashboard`}
                  />
                ) : (
                  <div
                    className="profile-icon"
                    title={`${user.username} - Go to Dashboard`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                )}
              </div>
            </Link>
            <span className="welcome-text">Welcome, {user.username}!</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
            {user.role === "Vendor" && (
              <Link to="/vendor" onClick={() => setMenuOpen(false)}>
                Vendor Dashboard
              </Link>
            )}
            {user.role === "Admin" && (
              <Link to="/admin" onClick={() => setMenuOpen(false)}>
                Admin Dashboard
              </Link>
            )}
            {user.role === "Customer" && (
              <Link to="/customer" onClick={() => setMenuOpen(false)}>
                Customer Dashboard
              </Link>
            )}
          </>
        ) : (
          <Link to="/auth" onClick={() => setMenuOpen(false)}>
            Login
          </Link>
        )}
      </nav>
    </header>
  );
};

export default Header;
