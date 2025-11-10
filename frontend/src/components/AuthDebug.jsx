/**
 * Authentication Debug Component
 *
 * Helps diagnose authentication issues by showing:
 * - Current user state
 * - Token presence and validity
 * - API connectivity
 */

import { useState, useEffect } from "react";
import { useUser } from "../hooks/useUser";
import axios from "../api";

const AuthDebug = () => {
  const { user } = useUser();
  const [debugInfo, setDebugInfo] = useState({
    hasToken: false,
    tokenValue: "",
    userInContext: null,
    userInLocalStorage: null,
    apiTest: null,
  });

  useEffect(() => {
    // Gather debug information
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    setDebugInfo({
      hasToken: !!token,
      tokenValue: token ? `${token.substring(0, 30)}...` : "No token",
      userInContext: user,
      userInLocalStorage: storedUser ? JSON.parse(storedUser) : null,
      apiTest: null,
    });
  }, [user]);

  const testCartAPI = async () => {
    try {
      console.log("[AuthDebug] Testing cart API...");
      const response = await axios.get("/cart");
      setDebugInfo((prev) => ({
        ...prev,
        apiTest: { success: true, data: response.data },
      }));
    } catch (error) {
      console.error("[AuthDebug] Cart API test failed:", error);
      setDebugInfo((prev) => ({
        ...prev,
        apiTest: {
          success: false,
          error: error.response?.data || error.message,
          status: error.response?.status,
        },
      }));
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h2>🔍 Authentication Debug Info</h2>

      <div style={{ marginBottom: "20px" }}>
        <h3>Token Status:</h3>
        <p>
          <strong>Has Token:</strong> {debugInfo.hasToken ? "✅ Yes" : "❌ No"}
        </p>
        <p>
          <strong>Token Value:</strong> {debugInfo.tokenValue}
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>User in Context:</h3>
        <pre>{JSON.stringify(debugInfo.userInContext, null, 2)}</pre>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>User in LocalStorage:</h3>
        <pre>{JSON.stringify(debugInfo.userInLocalStorage, null, 2)}</pre>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>API Test:</h3>
        <button
          onClick={testCartAPI}
          style={{ padding: "10px 20px", marginBottom: "10px" }}
        >
          Test Cart API
        </button>
        {debugInfo.apiTest && (
          <div>
            <p>
              <strong>Success:</strong>{" "}
              {debugInfo.apiTest.success ? "✅ Yes" : "❌ No"}
            </p>
            {debugInfo.apiTest.status && (
              <p>
                <strong>Status Code:</strong> {debugInfo.apiTest.status}
              </p>
            )}
            <pre>
              {JSON.stringify(
                debugInfo.apiTest.data || debugInfo.apiTest.error,
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: "30px",
          padding: "15px",
          backgroundColor: "#f0f0f0",
        }}
      >
        <h3>Instructions:</h3>
        <ol>
          <li>Check if token exists - if not, log in first</li>
          <li>Verify user object is populated correctly</li>
          <li>Click "Test Cart API" to check backend connectivity</li>
          <li>If you see 401 error, the token might be invalid or expired</li>
        </ol>
      </div>
    </div>
  );
};

export default AuthDebug;
