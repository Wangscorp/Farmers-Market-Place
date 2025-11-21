// Global user state management with authentication persistence via localStorage.

import { useState, useEffect } from "react";
import { UserContext } from "./UserContext.js";

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Store user data and token in state and localStorage after authentication
  const login = (data) => {
    console.log("[UserContext] Login called with data:", data);

    if (data.token) {
      console.log("[UserContext] Storing token in localStorage");
      localStorage.setItem("token", data.token);
    } else {
      console.warn("[UserContext] No token found in login response!");
    }

    const userData = data.user || data;
    console.log("[UserContext] Setting user state:", userData);
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    console.log(
      "[UserContext] Login complete. Token stored:",
      !!localStorage.getItem("token")
    );
  };

  // Clear user state and remove session data from localStorage
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  // Request user's current geographic location via Geolocation API
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
            timestamp: position.timestamp,
          };

          setLocation(locationData);
          setLocationLoading(false);
          resolve(locationData);
        },
        (error) => {
          let errorMessage = "Unable to retrieve location";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Location access denied by user. Please enable location permissions or enter your location manually.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage =
                "Location information unavailable. Please check your device settings.";
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
          maximumAge: 300000, // Accept cached position up to 5 minutes old
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          location_string: locationData.location_string || null,
        }),
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
    <UserContext.Provider
      value={{
        user,
        login,
        logout,
        location,
        locationError,
        locationLoading,
        requestLocation,
        updateUserLocation,
        reverseGeocode,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
