/**
 * useUser Hook - Access Global User State
 *
 * Custom hook to access the authenticated user state from UserContext.
 * Must be used within a UserProvider component.
 */

import { useContext } from 'react';
import { UserContext } from '../components/UserContext.js';

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
