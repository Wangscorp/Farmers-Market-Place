/**
 * User Provider - Global User State Management
 *
 * Provides React Context for managing authenticated user state across the application.
 * Implements authentication persistence using localStorage for browser sessions.
 * Centralizes user login, logout, and state access for all components.
 */

import { useState, useEffect } from "react";
import { UserContext } from "./UserContext.js";

export const UserProvider = ({ children }) => {
  // User state - holds current user information or null
  const [user, setUser] = useState(null);
  // Location state - holds current user location information
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  /**
   * Login function - stores user data and token in state and localStorage
   *
   * Called after successful authentication API call to update global state.
   * Persists user session and token across browser refreshes using localStorage.
   *
   * @param {Object} data - Response object with token and user data
   */
  const login = (data) => {
    console.log("[UserContext] Login called with data:", data);

    if (data.token) {
      console.log("[UserContext] Storing token in localStorage");
      localStorage.setItem("token", data.token); // Store JWT token
    } else {
      console.warn("[UserContext] No token found in login response!");
    }

    const userData = data.user || data;
    console.log("[UserContext] Setting user state:", userData);
    setUser(userData); // Update React state with user data

    // Persist user session in localStorage for browser session management
    localStorage.setItem("user", JSON.stringify(userData));
    console.log(
      "[UserContext] Login complete. Token stored:",
      !!localStorage.getItem("token")
    );
  };

  /**
   * Logout function - clears user state and removes session data
   *
   * Removes user from global state and localStorage.
   * Called when user explicitly logs out or session becomes invalid.
   */
  const logout = () => {
    setUser(null); // Clear React state
    // Remove user session and token from localStorage
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  /**
   * Request user location using Geolocation API
   *
   * Attempts to get the user's current geographic location.
   * Updates location state and handles permission denials.
   *
   * @returns {Promise<Object>} Location data or error
   */
  const requestLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error("Geolocation is not supported by this browser");
        setLocationError(error.message);
        reject(error);
        return;
      }

      setLocationLoading(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          setLocation(locationData);
          setLocationLoading(false);
          resolve(locationData);
        },
        (error) => {
          let errorMessage = "Unable to retrieve location";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied by user. Please enable location permissions or enter your location manually.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information unavailable. Please check your device settings.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out. Please try again.";
              break;
          }

          setLocationError(errorMessage);
          setLocationLoading(false);
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: false, // Faster response, less accurate
          timeout: 15000, // 15 seconds
          maximumAge: 300000 // Accept cached position up to 5 minutes old
        }
      );
    });
  };

  /**
   * Update user location on the backend
   *
   * Sends location data to the backend to store user location.
   * Requires user to be authenticated.
   *
   * @param {Object} locationData - Location data with latitude, longitude, and optional location_string
   * @returns {Promise<Object>} API response
   */
  const updateUserLocation = async (locationData) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch("/api/location/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          location_string: locationData.location_string || null
        })
      });

      if (!response.ok) {
        throw new Error("Failed to update location");
      }

      return await response.json();
    } catch (error) {
      console.error("Error updating user location:", error);
      throw error;
    }
  };

  /**
   * Get reverse geocoded address from coordinates (if needed)
   *
   * Uses a geocoding service to convert coordinates to human-readable address.
   * This is optional and can be implemented if needed for better UX.
   *
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<string>} Human-readable location string
   */
  const reverseGeocode = async (latitude, longitude) => {
    // This is a placeholder - implement with a geocoding service like Google Maps API
    try {
      // For now, return coordinates as string
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch (error) {
      console.error("Geocoding error:", error);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  };

  /**
   * Effect hook - restore user session on application load
   *
   * Runs once when component mounts to check for existing user session.
   * If user data exists in localStorage, restores the user state.
   * This enables persistent login across browser sessions.
   */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []); // Empty dependency array - runs only once on mount

  /**
   * Effect hook - attempt to get location when user logs in
   *
   * Automatically requests location permissions when user logs in.
   * This enables location-based product filtering.
   */
  useEffect(() => {
    if (user && !location && !locationLoading) {
      // Wait a bit before requesting location to allow page to settle
      const timeoutId = setTimeout(() => {
        requestLocation().catch((error) => {
          console.log("Location request failed:", error.message);
          // Don't show error popup on login, user can manually enable later
        });
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [user, location, locationLoading]); // Re-run when user changes

  // Provide context values to consumer components
  return (
    <UserContext.Provider value={{
      user,
      login,
      logout,
      location,
      locationError,
      locationLoading,
      requestLocation,
      updateUserLocation,
      reverseGeocode
    }}>
      {children}
    </UserContext.Provider>
  );
};
