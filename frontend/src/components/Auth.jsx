/**
 * Authentication Component - Login and Signup Forms
 *
 * Provides user interface for user authentication and registration.
 * Handles login for existing users and signup for new users.
 * Supports different user roles (Customer, Vendor) and profile image upload during signup.
 */

import { useState, useContext, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../api"; // Configured axios instance with base URL
import { useUser } from "../hooks/useUser"; // React context for user state management
import ImageUploadWithResize from "./ImageUploadWithResize"; // Image compression component
import { UserContext } from "./UserContext"; // User context for location functionality
import "./Auth.css";

const Auth = () => {
  // Hook from UserContext to update global user state
  const { login } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Location context for geolocation functionality
  const { location, locationError, locationLoading, requestLocation } = useContext(UserContext);

  // Form state management
  const [isLogin, setIsLogin] = useState(true); // Toggle between login/signup mode
  const [username, setUsername] = useState(""); // Username input
  const [email, setEmail] = useState(""); // Email input (signup only)
  const [password, setPassword] = useState(""); // Password input
  const [confirmPassword, setConfirmPassword] = useState(""); // Password confirmation (signup only)
  const [role, setRole] = useState("Customer"); // User role selection (signup only)
  const [resizedImage, setResizedImage] = useState(null); // Profile image data
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility

  // Location state for signup
  const [manualLocation, setManualLocation] = useState(""); // Manual location text input
  const [useCurrentLocation, setUseCurrentLocation] = useState(true); // Toggle between current/manual location

  /**
   * Handle user login attempt
   *
   * Sends username and password to backend API and updates user context on success.
   * Shows alert for success/failure feedback.
   */
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
      toast.success("Login successful!");
      navigate("/");
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      toast.error("Login failed: " + (error.response?.data || "Please try again"));
    }
  };

  /**
   * Handle location request
   *
   * Attempts to get the user's current location using geolocation API.
   */
  const handleRequestLocation = async () => {
    try {
      await requestLocation();
      toast.success("Location acquired successfully!");
    } catch (error) {
      console.error("Location request failed:", error);
      toast.error("Could not get location. Please enter your location manually.");
    }
  };

  /**
   * Handle user signup attempt
   *
   * Validates password confirmation, sends user data to backend, and updates user context.
   * Handles signup errors like duplicate usernames/emails.
   * Profile image is required for vendors for verification.
   * Includes location data (either from geolocation or manual input).
   */
  const handleSignup = async () => {
    // Client-side validation before API call
    if (password !== confirmPassword) {
      toast.warning("Passwords do not match");
      return;
    }

    // Validate location input
    if (useCurrentLocation && !location) {
      toast.warning("Please acquire your location or switch to manual entry");
      return;
    }

    if (!useCurrentLocation && !manualLocation.trim()) {
      toast.warning("Please enter your location manually");
      return;
    }

    // Profile image is no longer required for signup

    // Prepare location data
    let locationData = null;
    if (useCurrentLocation && location) {
      locationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        location_string: null // Will be reverse geocoded later if needed
      };
    } else if (!useCurrentLocation && manualLocation.trim()) {
      locationData = {
        latitude: null,
        longitude: null,
        location_string: manualLocation.trim()
      };
    }

    try {
      const signupData = {
        username,
        email,
        password,
        role,
        profile_image: resizedImage, // Base64 encoded resized image
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
        location_string: locationData?.location_string
      };

      const response = await axios.post("/signup", signupData);
      login(response.data);
      toast.success("Signup successful!");

      // For vendors, redirect to setup page instead of home
      if (role === "Vendor") {
        navigate("/vendor-setup");
      } else {
        navigate("/");
      }
    } catch (error) {
      toast.error("Signup failed: " + (error.response?.data || "Please try again"));
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

          {/* Location Input Section */}
          <div className="location-input-section">
            <h4>Location Information</h4>
            <div className="location-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="locationType"
                  checked={useCurrentLocation}
                  onChange={() => setUseCurrentLocation(true)}
                />
                Use Current Location
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="locationType"
                  checked={!useCurrentLocation}
                  onChange={() => setUseCurrentLocation(false)}
                />
                Enter Location Manually
              </label>
            </div>

            {useCurrentLocation ? (
              <div className="location-current">
                <button
                  type="button"
                  onClick={handleRequestLocation}
                  disabled={locationLoading}
                  className="location-btn"
                >
                  {locationLoading ? "Getting Location..." : "📍 Get My Location"}
                </button>

                {location && (
                  <div className="location-status success">
                    ✅ Location acquired: Lat {location.latitude.toFixed(4)}, Lng {location.longitude.toFixed(4)}
                  </div>
                )}

                {locationError && !location && (
                  <div className="location-status error">
                    ❌ {locationError}
                  </div>
                )}

                {!locationLoading && !location && !locationError && (
                  <div className="location-status info">
                    ℹ️ Click "Get My Location" to automatically detect your position
                  </div>
                )}
              </div>
            ) : (
              <div className="location-manual">
                <input
                  type="text"
                  placeholder="Enter your city or location (e.g., Nairobi, Kenya)"
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  className="location-input"
                />
                {!manualLocation.trim() && (
                  <div className="location-status info">
                    ℹ️ Please enter your location to help us show relevant products
                  </div>
                )}
              </div>
            )}
          </div>

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
