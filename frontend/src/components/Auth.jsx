/**
 * Authentication Component - Login and Signup Forms
 *
 * Provides user interface for user authentication and registration.
 * Handles login for existing users and signup for new users.
 * Supports different user roles (Customer, Vendor) and profile image upload during signup.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api"; // Configured axios instance with base URL
import { useUser } from "../hooks/useUser"; // React context for user state management
import ImageUploadWithResize from "./ImageUploadWithResize"; // Image compression component
import "./Auth.css";

const Auth = () => {
  // Hook from UserContext to update global user state
  const { login } = useUser();
  const navigate = useNavigate();

  // Form state management
  const [isLogin, setIsLogin] = useState(true); // Toggle between login/signup mode
  const [username, setUsername] = useState(""); // Username input
  const [email, setEmail] = useState(""); // Email input (signup only)
  const [password, setPassword] = useState(""); // Password input
  const [confirmPassword, setConfirmPassword] = useState(""); // Password confirmation (signup only)
  const [role, setRole] = useState("Customer"); // User role selection (signup only)
  const [resizedImage, setResizedImage] = useState(null); // Profile image data
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility

  /**
   * Handle user login attempt
   *
   * Sends username and password to backend API and updates user context on success.
   * Shows alert for success/failure feedback.
   */
  const handleLogin = async () => {
    try {
      const response = await axios.post("/login", {
        username,
        password,
      });
      // Update global user state with returned user data
      login(response.data);
      alert("Login successful");
      navigate("/");
    } catch (error) {
      alert("Login failed: " + error.response?.data);
    }
  };

  /**
   * Handle user signup attempt
   *
   * Validates password confirmation, sends user data to backend, and updates user context.
   * Handles signup errors like duplicate usernames/emails.
   * Profile image is required for vendors for verification.
   */
  const handleSignup = async () => {
    // Client-side validation before API call
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // Profile image is no longer required for signup

    try {
      const response = await axios.post("/signup", {
        username,
        email,
        password,
        role,
        profile_image: resizedImage, // Base64 encoded resized image
      });
      login(response.data);
      alert("Signup successful");

      // For vendors, redirect to setup page instead of home
      if (role === "Vendor") {
        navigate("/vendor-setup");
      } else {
        navigate("/");
      }
    } catch (error) {
      alert("Signup failed: " + error.response?.data);
    }
  };

  /**
   * Handle image resize callback
   *
   * Called by ImageUploadWithResize component when image is processed.
   * Stores the resized image data for profile image upload.
   */
  const handleImageResize = (uri) => {
    setResizedImage(uri); // uri is base64 encoded image data
  };

  /**
   * Toggle between login and signup modes
   *
   * Switches the form display and resets all form fields to pristine state.
   * Allows users to switch between existing account login and new account creation.
   */
  const toggleMode = () => {
    setIsLogin(!isLogin);
    // Reset all form fields when switching modes
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("Customer");
    setResizedImage(null);
  };

  return (
    <div className="auth">
      <h2>{isLogin ? "Login" : "Sign Up"}</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {!isLogin && (
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}
      <input
        type={showPassword ? "text" : "password"}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {!isLogin && (
        <>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Customer">Customer</option>
            <option value="Vendor">Vendor</option>
          </select>
          <ImageUploadWithResize onImageResize={handleImageResize} />
        </>
      )}
      <label>
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
        />
        Show Password
      </label>
      <button onClick={isLogin ? handleLogin : handleSignup}>
        {isLogin ? "Login" : "Sign Up"}
      </button>
      <button onClick={toggleMode} className="toggle-btn">
        {isLogin ? "Need an account? Sign Up" : "Have an account? Login"}
      </button>
    </div>
  );
};

export default Auth;
