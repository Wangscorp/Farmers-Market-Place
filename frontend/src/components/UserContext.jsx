/**
 * User Provider - Global User State Management
 *
 * Provides React Context for managing authenticated user state across the application.
 * Implements authentication persistence using localStorage for browser sessions.
 * Centralizes user login, logout, and state access for all components.
 */

import { useState, useEffect } from 'react';
import { UserContext } from './UserContext.js';

export const UserProvider = ({ children }) => {
    // User state - holds current user information or null
    const [user, setUser] = useState(null);

    /**
     * Login function - stores user data and token in state and localStorage
     *
     * Called after successful authentication API call to update global state.
     * Persists user session and token across browser refreshes using localStorage.
     *
     * @param {Object} data - Response object with token and user data
     */
    const login = (data) => {
        if (data.token) {
            localStorage.setItem('token', data.token);  // Store JWT token
        }
        setUser(data.user || data);  // Update React state with user data
        // Persist user session in localStorage for browser session management
        localStorage.setItem('user', JSON.stringify(data.user || data));
    };

    /**
     * Logout function - clears user state and removes session data
     *
     * Removes user from global state and localStorage.
     * Called when user explicitly logs out or session becomes invalid.
     */
    const logout = () => {
        setUser(null);  // Clear React state
        // Remove user session and token from localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    /**
     * Effect hook - restore user session on application load
     *
     * Runs once when component mounts to check for existing user session.
     * If user data exists in localStorage, restores the user state.
     * This enables persistent login across browser sessions.
     */
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);  // Empty dependency array - runs only once on mount

    // Provide context values to consumer components
    return (
        <UserContext.Provider value={{ user, login, logout }}>
            {children}
        </UserContext.Provider>
    );
};
