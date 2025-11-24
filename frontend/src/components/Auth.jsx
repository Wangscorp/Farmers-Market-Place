// Authentication: login and signup forms with role selection and image upload.

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../api"; // Configured axios instance with base URL
import { useUser } from "../hooks/useUser"; // React context for user state management
import { useCart } from "./CartContext"; // Cart context to load cart after login
import ImageUploadWithResize from "./ImageUploadWithResize"; // Image compression component
import "./Auth.css";

const Auth = () => {
  // Hook from UserContext to update global user state
  const { login } = useUser();
  const { loadCartItems } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Customer");
  const [resizedImage, setResizedImage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [location, setLocation] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [passwordErrors, setPasswordErrors] = useState([]);

  // Submit login request and update user context on success
  const handleLogin = async () => {
    try {
      console.log("[Auth] Attempting login with username:", username);
      const response = await axios.post("/login", {
        username,
        password,
      });
      console.log("[Auth] Login response:", response.data);
      // Update global user state with returned user data
      login(response.data);
      // Load cart items after successful login
      await loadCartItems();
      toast.success("Login successful!");
      navigate("/");
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      toast.error(
        "Login failed: " + (error.response?.data || "Please try again")
      );
    }
  };

  // Validate password: min 8 chars, uppercase, lowercase, number, special char
  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(pwd)) errors.push("At least one uppercase letter");
    if (!/[a-z]/.test(pwd)) errors.push("At least one lowercase letter");
    if (!/[0-9]/.test(pwd)) errors.push("At least one number");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd))
      errors.push("At least one special character (!@#$%^&*...)");
    return errors;
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    if (pwd && !isLogin) {
      setPasswordErrors(validatePassword(pwd));
    } else {
      setPasswordErrors([]);
    }
  };

  // Submit signup request after validating password and location
  const handleSignup = async () => {
    const pwdErrors = validatePassword(password);
    if (pwdErrors.length > 0) {
      setPasswordErrors(pwdErrors);
      toast.error("Password does not meet requirements");
      return;
    }

    // Client-side validation before API call
    if (password !== confirmPassword) {
      toast.warning("Passwords do not match");
      return;
    }

    // Validate location input
    if (!location.trim()) {
      toast.warning("Please enter your location");
      return;
    }

    // Validate phone number input
    if (!phoneNumber.trim()) {
      toast.warning("Please enter your phone number");
      return;
    }
    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
      toast.warning("Phone number must be between 10 and 15 digits");
      return;
    }
    if (!phoneNumber.match(/^[+]?[0-9]+$/)) {
      toast.warning(
        "Phone number must contain only numbers and optionally start with +"
      );
      return;
    }

    try {
      const signupData = {
        username,
        email,
        password,
        mpesa_number: phoneNumber.trim(),
        role,
        profile_image: resizedImage,
        location_string: location.trim(),
      };

      const response = await axios.post("/signup", signupData);
      login(response.data);
      // Load cart items after successful signup (will be empty for new users)
      await loadCartItems();
      toast.success("Signup successful!");

      // For vendors, redirect to setup page instead of home
      if (role === "Vendor") {
        navigate("/vendor-setup");
      } else {
        navigate("/");
      }
    } catch (error) {
      toast.error(
        "Signup failed: " + (error.response?.data || "Please try again")
      );
    }
  };

  // Check URL parameters on component mount
  useEffect(() => {
    const mode = searchParams.get("mode");
    const roleParam = searchParams.get("role");

    if (mode === "signup") {
      setIsLogin(false);
    } else if (mode === "login") {
      setIsLogin(true);
    }

    if (roleParam && (roleParam === "vendor" || roleParam === "customer")) {
      setRole(roleParam.charAt(0).toUpperCase() + roleParam.slice(1));
    }
  }, [searchParams]);

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
    setLocation("");
    setPhoneNumber("");
    setPasswordErrors([]);
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
        onChange={handlePasswordChange}
      />
      {!isLogin && passwordErrors.length > 0 && (
        <div className="password-requirements">
          <p
            style={{
              margin: "0.5rem 0",
              fontWeight: "600",
              fontSize: "0.9rem",
              color: "#dc3545",
            }}
          >
            Password must have:
          </p>
          <ul
            style={{
              margin: "0 0 0.5rem 0",
              paddingLeft: "1.5rem",
              fontSize: "0.85rem",
              color: "#dc3545",
            }}
          >
            {passwordErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
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

          <input
            type="text"
            placeholder="Enter your location (e.g., Nairobi, Kenya)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ marginTop: "0.5rem" }}
          />

          <input
            type="tel"
            placeholder="Phone number (e.g., +254712345678)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={{ marginTop: "0.5rem" }}
          />

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
