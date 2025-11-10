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
        }`,
        { tokenPrefix: token.substring(0, 20) + "..." }
      );
    } else {
      console.warn(
        `[API] No token found in localStorage for request to ${config.url}`
      );
    }
    return config;
  },
  (error) => {
    console.error("[API] Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Interceptor to handle responses and errors
axios.interceptors.response.use(
  (response) => {
    console.log(
      `[API] Response received for ${response.config.method?.toUpperCase()} ${
        response.config.url
      }`,
      {
        status: response.status,
      }
    );
    return response;
  },
  (error) => {
    console.error(
      `[API] Response error for ${error.config?.method?.toUpperCase()} ${
        error.config?.url
      }`,
      {
        status: error.response?.status,
        data: error.response?.data,
      }
    );
    return Promise.reject(error);
  }
);

// Export configured axios instance for use throughout the application
export default axios;
