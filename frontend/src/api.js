// API client configuration with request/response interceptors for authentication.

import axios from "axios";

// Base URL from environment variable or localhost default
axios.defaults.baseURL =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

// Add JWT token to outgoing requests
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

// Log responses and handle errors
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

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      console.warn(
        "[API] Unauthorized access - clearing token and redirecting to login"
      );
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Only redirect if not already on auth page
      if (!window.location.pathname.includes("/auth")) {
        window.location.href = "/auth";
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
