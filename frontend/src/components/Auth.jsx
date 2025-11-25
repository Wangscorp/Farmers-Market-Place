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

  // Password reset states
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: username, 2: verify code
  const [resetUsername, setResetUsername] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Submit login request and update user context on success
  const handleLogin = async () => {
    try {
      console.log("[Auth] Attempting login with username:", username);
      const response = await axios.post("/login", {
        username,
        password,
      });
      console.log("[Auth] Login response:", response.data);

      // Check if user has a verification rejection reason
      const user = response.data.user;
      if (user && user.verification_rejected_reason) {
        toast.error(user.verification_rejected_reason, {
          autoClose: 8000, // Show for 8 seconds
        });
        // Don't redirect, stay on login page so they can re-upload verification
        return;
      }

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
    // Reset password reset fields
    setShowPasswordReset(false);
    setResetStep(1);
    setResetUsername("");
    setVerificationCode("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  /**
   * Handle password reset request - Step 1: Generate verification code
   */
  const handlePasswordResetRequest = async () => {
    if (!resetUsername.trim()) {
      toast.error("Please enter your username");
      return;
    }

    setResetLoading(true);
    try {
      await axios.post("/auth/password-reset", {
        username: resetUsername.trim(),
      });

      toast.success("Verification code generated! Check the backend console.");
      setResetStep(2);
    } catch (error) {
      console.error("[Auth] Password reset request failed:", error);
      toast.error(
        error.response?.data ||
          "Failed to send verification code. Please try again."
      );
    } finally {
      setResetLoading(false);
    }
  };

  /**
   * Handle password reset verification - Step 2: Verify code and set new password
   */
  const handlePasswordResetVerify = async () => {
    if (!verificationCode.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Validate new password requirements
    const pwdErrors = validatePassword(newPassword);
    if (pwdErrors.length > 0) {
      toast.error(
        "Password does not meet requirements: " + pwdErrors.join(", ")
      );
      return;
    }

    setResetLoading(true);
    try {
      await axios.post("/auth/password-reset/verify", {
        username: resetUsername.trim(),
        verification_code: verificationCode.trim(),
        new_password: newPassword,
      });

      toast.success(
        "Password reset successful! You can now log in with your new password."
      );

      // Reset the form and go back to login
      setShowPasswordReset(false);
      setResetStep(1);
      setResetUsername("");
      setVerificationCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setUsername(resetUsername); // Pre-fill username for login
    } catch (error) {
      console.error("[Auth] Password reset verify failed:", error);
      toast.error(
        error.response?.data || "Failed to reset password. Please try again."
      );
    } finally {
      setResetLoading(false);
    }
  };

  /**
   * Cancel password reset and return to login
   */
  const cancelPasswordReset = () => {
    setShowPasswordReset(false);
    setResetStep(1);
    setResetUsername("");
    setVerificationCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetLoading(false);
  };

  // Password Reset UI
  if (showPasswordReset) {
    return (
      <div className="auth">
        <h2>Reset Password</h2>

        {resetStep === 1 && (
          <>
            <p
              style={{
                marginBottom: "1rem",
                color: "#666",
                fontSize: "0.9rem",
              }}
            >
              Enter your username to generate a verification code
            </p>
            <input
              type="text"
              placeholder="Username"
              value={resetUsername}
              onChange={(e) => setResetUsername(e.target.value)}
              style={{ marginBottom: "1rem" }}
            />
            <button
              onClick={handlePasswordResetRequest}
              disabled={resetLoading}
              style={{ marginBottom: "1rem" }}
            >
              {resetLoading ? "Generating..." : "Generate Verification Code"}
            </button>
          </>
        )}

        {resetStep === 2 && (
          <>
            <p
              style={{
                marginBottom: "1rem",
                color: "#666",
                fontSize: "0.9rem",
              }}
            >
              Enter the 6-digit verification code generated for '{resetUsername}
              ' (check backend console)
            </p>
            <input
              type="text"
              placeholder="Verification code"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(
                  e.target.value.replace(/[^0-9]/g, "").slice(0, 6)
                )
              }
              maxLength={6}
              style={{
                marginBottom: "1rem",
                textAlign: "center",
                fontSize: "1.2rem",
              }}
            />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordErrors(validatePassword(e.target.value));
              }}
              style={{ marginBottom: "0.5rem" }}
            />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              style={{ marginBottom: "1rem" }}
            />

            {passwordErrors.length > 0 && (
              <div
                style={{
                  marginBottom: "1rem",
                  color: "#e74c3c",
                  fontSize: "0.8rem",
                }}
              >
                Password requirements:
                <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                  {passwordErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <label
              style={{
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{ marginRight: "0.5rem" }}
              />
              Show Password
            </label>

            <button
              onClick={handlePasswordResetVerify}
              disabled={resetLoading}
              style={{ marginBottom: "1rem" }}
            >
              {resetLoading ? "Resetting..." : "Reset Password"}
            </button>
          </>
        )}

        <button onClick={cancelPasswordReset} className="toggle-btn">
          Back to Login
        </button>
      </div>
    );
  }

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

      {isLogin && (
        <button
          onClick={() => setShowPasswordReset(true)}
          className="forgot-password-btn"
          style={{
            background: "none",
            border: "none",
            color: "#3498db",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "0.9rem",
            marginTop: "0.5rem",
          }}
        >
          Forgot Password?
        </button>
      )}

      <button onClick={toggleMode} className="toggle-btn">
        {isLogin ? "Need an account? Sign Up" : "Have an account? Login"}
      </button>
    </div>
  );
};

export default Auth;
