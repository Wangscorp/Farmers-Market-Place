import React, { useState, useEffect } from "react";
import axios from "../api";
import { toast } from "react-toastify";
import { useUser } from "../hooks/useUser";
import { useCart } from "./CartContext";
import { useFollow } from "./FollowContext";
import Chat from "./Chat";
import PurchaseReport from "./PurchaseReport";
import ImageUploadWithResize from "./ImageUploadWithResize";
import "./CustomerDashboard.css";

const CustomerDashboard = () => {
  const { user, login } = useUser();
  const { loadCartItems } = useCart();
  const { follows } = useFollow();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPurchaseReport, setShowPurchaseReport] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Profile edit form state
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    location_string: "",
  });
  const [resizedImage, setResizedImage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConversations();
    if (user) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        location_string: user.location_string || "",
      });
    }
  }, [user]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/messages");
      setConversations(response.data);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const response = await axios.get("/payments/history");
      setTransactions(response.data);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transaction history");
    } finally {
      setLoadingTransactions(false);
    }
  };

  const processCompletedPayments = async () => {
    try {
      setLoadingTransactions(true);
      const response = await axios.post("/payments/process-completed");
      if (response.data.success) {
        toast.success(
          `Processed ${response.data.processed_count} payment(s) and created ${response.data.orders_created} order(s)`
        );
        // Reload both transactions and cart items since cart was cleared
        loadTransactions();
        await loadCartItems();
      } else {
        toast.info("No completed payments found to process");
      }
    } catch (error) {
      console.error("Error processing payments:", error);
      toast.error("Failed to process completed payments");
    } finally {
      setLoadingTransactions(false);
    }
  };

  const openChat = (conversation) => {
    // The conversation object contains the other user's information
    setSelectedChat({ id: conversation.id, username: conversation.username });
  };

  const closeChat = () => {
    setSelectedChat(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageResize = (uri) => {
    setResizedImage(uri);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    if (
      formData.newPassword &&
      formData.newPassword !== formData.confirmPassword
    ) {
      toast.error("New passwords do not match");
      return;
    }

    if (formData.newPassword && formData.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }

    try {
      setSaving(true);
      const updateData = {
        username: formData.username,
        email: formData.email,
        location_string: formData.location_string,
      };

      if (resizedImage) {
        updateData.profile_image = resizedImage;
      }

      if (formData.newPassword) {
        updateData.current_password = formData.currentPassword;
        updateData.new_password = formData.newPassword;
      }

      const response = await axios.put("/user/profile", updateData);

      // Update user context with new data
      const updatedUser = { ...user, ...response.data };
      login({ user: updatedUser, token: localStorage.getItem("token") });

      toast.success("Profile updated successfully!");
      setShowProfileEdit(false);
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setResizedImage(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(
        error.response?.data || "Failed to update profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="dashboard-message">
        <div className="message-icon">🔒</div>
        <h2>Authentication Required</h2>
        <p>Please log in to access your customer dashboard</p>
        <button
          className="btn-primary"
          onClick={() => (window.location.href = "/auth")}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="customer-dashboard">
      <h1>Customer Dashboard</h1>

      <div className="dashboard-actions">
        <button
          className="btn-primary"
          onClick={() => setShowProfileEdit(!showProfileEdit)}
        >
          {showProfileEdit ? "Hide Profile" : "Edit Profile"}
        </button>
        <button
          className="btn-analytics"
          onClick={() => setShowPurchaseReport(!showPurchaseReport)}
        >
          {showPurchaseReport ? "Hide Purchase Report" : "View Purchase Report"}
        </button>
        <button
          className="btn-transactions"
          onClick={() => {
            setShowTransactions(!showTransactions);
            if (!showTransactions) {
              loadTransactions();
            }
          }}
        >
          {showTransactions
            ? "Hide Transaction History"
            : "View Transaction History"}
        </button>
      </div>

      {showProfileEdit && (
        <div className="profile-edit-section">
          <h2>Edit Your Profile</h2>
          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="location_string">Location</label>
              <input
                type="text"
                id="location_string"
                name="location_string"
                value={formData.location_string}
                onChange={handleInputChange}
                placeholder="e.g., Nairobi, Nakuru, Mombasa"
              />
            </div>

            <div className="form-group">
              <label>Profile Image</label>
              <ImageUploadWithResize onImageResize={handleImageResize} />
              {user.profile_image && !resizedImage && (
                <div className="current-image">
                  <p>Current image:</p>
                  <img src={user.profile_image} alt="Current profile" />
                </div>
              )}
            </div>

            <div className="password-section">
              <h3>Change Password (Optional)</h3>
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  placeholder="Enter current password to change"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    placeholder="Min 8 characters"
                    disabled={!formData.currentPassword}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Re-enter new password"
                    disabled={!formData.currentPassword}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-save" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowProfileEdit(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showPurchaseReport && <PurchaseReport />}

      {showTransactions && (
        <div className="transactions-section">
          <div className="transactions-header">
            <h2>Transaction History</h2>
            <button
              className="btn-process-payments"
              onClick={processCompletedPayments}
              disabled={loadingTransactions}
              title="Process any completed payments that didn't create shipping orders"
            >
              {loadingTransactions
                ? "Processing..."
                : "🔄 Process Completed Payments"}
            </button>
          </div>
          {loadingTransactions ? (
            <p className="loading-text">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="no-data-text">No transactions found.</p>
          ) : (
            <div className="transactions-table-wrapper">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Date</th>
                    <th>Amount (KSh)</th>
                    <th>Phone Number</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="transaction-id">
                        {transaction.mpesa_receipt_number || transaction.id}
                      </td>
                      <td className="transaction-date">
                        {new Date(transaction.created_at).toLocaleString()}
                      </td>
                      <td className="transaction-amount">
                        {parseFloat(transaction.amount).toFixed(2)}
                      </td>
                      <td className="transaction-phone">
                        {transaction.phone_number}
                      </td>
                      <td className="transaction-status">
                        <span
                          className={`status-badge status-${transaction.status.toLowerCase()}`}
                        >
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2>Your Follows</h2>
          {follows.length === 0 ? (
            <p>You haven't followed any vendors yet.</p>
          ) : (
            <div className="follows-list">
              {follows.map((follow) => (
                <div key={follow.id} className="follow-item">
                  <span>{follow.vendor_username}</span>
                  <button
                    onClick={() =>
                      openChat({
                        id: follow.vendor_id,
                        username: follow.vendor_username,
                      })
                    }
                    className="chat-btn-small"
                  >
                    Chat
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-section">
          <h2>Recent Conversations</h2>
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <p>No conversations yet</p>
              <p className="empty-hint">
                Start chatting with vendors to get support or ask questions!
              </p>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map((conversation) => {
                return (
                  <div
                    key={conversation.id}
                    className="conversation-item"
                    onClick={() => openChat(conversation)}
                  >
                    <div className="conversation-info">
                      <h4>{conversation.username}</h4>
                      <p className="last-message">
                        {conversation.last_message &&
                        conversation.last_message.length > 50
                          ? `${conversation.last_message.substring(0, 50)}...`
                          : conversation.last_message || "No messages yet"}
                      </p>
                    </div>
                    <div className="conversation-time">
                      {conversation.last_message_time
                        ? new Date(
                            conversation.last_message_time
                          ).toLocaleDateString()
                        : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chat Component */}
      {selectedChat && (
        <Chat
          otherUserId={selectedChat.id}
          otherUsername={selectedChat.username}
          onClose={closeChat}
        />
      )}
    </div>
  );
};

export default CustomerDashboard;
