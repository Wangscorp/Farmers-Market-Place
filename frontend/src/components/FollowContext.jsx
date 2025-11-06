import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from '../api';
import { useUser } from '../hooks/useUser';

const FollowContext = createContext();

export const useFollow = () => {
  const context = useContext(FollowContext);
  if (!context) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return context;
};

export const FollowProvider = ({ children }) => {
  const [follows, setFollows] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useUser();

  // Load user's follows when user changes
  useEffect(() => {
    if (user) {
      loadFollows();
    } else {
      setFollows([]);
    }
  }, [user]);

  const loadFollows = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await axios.get('/follow');
      setFollows(response.data);
    } catch (error) {
      console.error('Error loading follows:', error);
    } finally {
      setLoading(false);
    }
  };

  const followVendor = async (vendorId) => {
    if (!user) {
      alert('Please log in to follow vendors');
      return false;
    }

    try {
      const response = await axios.post('/follow', { vendor_id: vendorId });
      setFollows(prev => [...prev, response.data]);
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        alert('You are already following this vendor');
      } else {
        console.error('Error following vendor:', error);
        alert('Failed to follow vendor');
      }
      return false;
    }
  };

  const unfollowVendor = async (vendorId) => {
    if (!user) return false;

    try {
      await axios.delete(`/follow/${vendorId}`);
      setFollows(prev => prev.filter(follow => follow.vendor_id !== vendorId));
      return true;
    } catch (error) {
      console.error('Error unfollowing vendor:', error);
      alert('Failed to unfollow vendor');
      return false;
    }
  };

  const isFollowing = (vendorId) => {
    return follows.some(follow => follow.vendor_id === vendorId);
  };

  const getFollowedVendorIds = () => {
    return follows.map(follow => follow.vendor_id);
  };

  const value = {
    follows,
    loading,
    followVendor,
    unfollowVendor,
    isFollowing,
    getFollowedVendorIds,
    loadFollows
  };

  return (
    <FollowContext.Provider value={value}>
      {children}
    </FollowContext.Provider>
  );
};
