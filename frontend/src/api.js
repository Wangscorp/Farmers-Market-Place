/**
 * API configuration and HTTP client setup
 *
 * This module configures the Axios HTTP client for making API calls to the backend.
 * It provides a centralized place to set the base URL and any other default configurations.
 */

import axios from "axios";

// Configure default base URL for all API requests
// Uses environment variable VITE_API_URL if available, otherwise defaults to localhost
// This allows the frontend to work in both development and production environments
axios.defaults.baseURL =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

// Interceptor to add JWT token to requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(
        `[API] Adding auth token for ${config.method?.toUpperCase()} ${
          config.url
        }`
      );
    } else {
      console.warn("No token found in localStorage for request to", config.url);
    }
    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Export configured axios instance for use throughout the application
export default axios;
