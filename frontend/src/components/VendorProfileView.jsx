import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../api";
import { useUser } from "../hooks/useUser";
import { useFollow } from "./FollowContext";
import Chat from "./Chat";
import "./VendorProfileView.css";

const VendorProfileView = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { followVendor, unfollowVendor, isFollowing } = useFollow();

  const [vendorProfile, setVendorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatUser, setChatUser] = useState(null);

  useEffect(() => {
    const fetchVendorProfile = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/vendors/${vendorId}/profile`);
        setVendorProfile(response.data);
      } catch (err) {
        setError("Failed to load vendor profile");
        console.error("Error fetching vendor profile:", err);
      } finally {
        setLoading(false);
      }
    };

    if (vendorId) {
      fetchVendorProfile();
    }
  }, [vendorId]);

  const handleFollowToggle = async () => {
    if (!user) {
      toast.error("Please log in to follow vendors");
      return;
    }

    const following = isFollowing(parseInt(vendorId));
    const success = following
      ? await unfollowVendor(parseInt(vendorId))
      : await followVendor(parseInt(vendorId));

    if (success) {
      // Refresh the profile to update follower count
      try {
        const response = await axios.get(`/vendors/${vendorId}/profile`);
        setVendorProfile(response.data);
      } catch (err) {
        console.error("Error refreshing profile:", err);
      }
    }
  };

  const handleMessage = () => {
    if (!user) {
      toast.error("Please log in to message vendors");
      return;
    }

    setChatUser({ id: parseInt(vendorId), username: vendorProfile.username });
  };

  if (loading) {
    return <div className="loading">Loading vendor profile...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!vendorProfile) {
    return <div className="error">Vendor not found</div>;
  }

  return (
    <div className="vendor-profile-view">
      <button className="back-button" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="vendor-header">
        {vendorProfile.profile_image && (
          <img
            src={vendorProfile.profile_image}
            alt={vendorProfile.username}
            className="vendor-avatar"
          />
        )}
        <div className="vendor-info">
          <h1>{vendorProfile.username}</h1>
          <p className="vendor-email">{vendorProfile.email}</p>
          <div className="vendor-stats">
            <div className="stat">
              <span className="stat-number">
                {vendorProfile.total_purchases}
              </span>
              <span className="stat-label">Total Purchases</span>
            </div>
            <div className="stat">
              <span className="stat-number">
                {vendorProfile.follower_count}
              </span>
              <span className="stat-label">Followers</span>
            </div>
          </div>
          <div className="verification-status">
            {vendorProfile.verified ? (
              <span className="verified">✓ Verified Vendor</span>
            ) : (
              <span className="unverified">Unverified Vendor</span>
            )}
          </div>
        </div>
      </div>

      <div className="vendor-actions">
        {user && user.role === "Customer" && (
          <>
            <button
              onClick={handleFollowToggle}
              className={`follow-btn ${
                isFollowing(parseInt(vendorId)) ? "following" : ""
              }`}
            >
              {isFollowing(parseInt(vendorId)) ? "Following" : "Follow Vendor"}
            </button>
            <button onClick={handleMessage} className="message-btn">
              Message Vendor
            </button>
          </>
        )}
      </div>

      {/* Chat Component */}
      {chatUser && (
        <Chat
          otherUserId={chatUser.id}
          otherUsername={chatUser.username}
          onClose={() => setChatUser(null)}
        />
      )}
    </div>
  );
};

export default VendorProfileView;
