import React, { useState, useEffect } from "react";
import axios from "../api";
import { useUser } from "../hooks/useUser";
import Chat from "./Chat";
import "./Conversations.css";

const Conversations = () => {
  const { user } = useUser();
  const [conversations, setConversations] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAvailableUsers, setShowAvailableUsers] = useState(false);
  const pollIntervalRef = React.useRef(null);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadAvailableUsers();

      // Set up auto-refresh every 5 seconds
      pollIntervalRef.current = setInterval(() => {
        loadConversations();
      }, 5000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [user]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/messages");
      setConversations(response.data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await axios.get("/users");
      // Response already filters out current user from backend
      setAvailableUsers(response.data || []);
    } catch (error) {
      console.error("Error loading available users:", error);
    }
  };

  const startConversation = (userId, username) => {
    setSelectedConversation({
      id: userId,
      username: username,
    });
    setShowAvailableUsers(false);
  };

  if (!user) {
    return (
      <div className="conversations-container">
        <p>Please log in to view messages</p>
      </div>
    );
  }

  if (selectedConversation) {
    return (
      <div className="conversations-container">
        <Chat
          otherUserId={selectedConversation.id}
          otherUsername={selectedConversation.username}
          onClose={() => {
            setSelectedConversation(null);
            loadConversations();
          }}
          onMessageSent={loadConversations}
        />
      </div>
    );
  }

  return (
    <div className="conversations-container">
      <h2>My Messages</h2>
      <button
        className="start-conversation-btn"
        onClick={() => setShowAvailableUsers(!showAvailableUsers)}
      >
        {showAvailableUsers ? "Hide Users" : "Start New Conversation"}
      </button>

      {showAvailableUsers && (
        <div className="available-users">
          <h3>Available Users</h3>
          {availableUsers.length === 0 ? (
            <p>No available users to chat with</p>
          ) : (
            <div className="users-cards">
              {availableUsers.map((u) => (
                <div
                  key={u.id}
                  className="user-card"
                  onClick={() => startConversation(u.id, u.username)}
                >
                  <div className="user-card-avatar">
                    {u.profile_image ? (
                      <img
                        src={
                          u.profile_image.startsWith("data:")
                            ? u.profile_image
                            : `data:image/jpeg;base64,${u.profile_image}`
                        }
                        alt={u.username}
                        className="user-avatar"
                      />
                    ) : (
                      <div className="user-avatar-placeholder">
                        {(u.username || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="user-card-info">
                    <div className="user-card-header">
                      <h4 className="user-username">{u.username}</h4>
                      <span className={`user-role role-${u.role ? u.role.toLowerCase() : 'unknown'}`}>
                        {u.role || 'User'}
                      </span>
                    </div>
                    <div className="user-card-status">
                      {u.is_mutual_friend ? (
                        <span className="friend-status mutual">Friends</span>
                      ) : u.is_followed ? (
                        <span className="friend-status following">Following</span>
                      ) : u.is_following_back ? (
                        <span className="friend-status followed">Follows you</span>
                      ) : (
                        <span className="friend-status none">Not connected</span>
                      )}
                    </div>
                    {u.is_mutual_friend && (
                      <div className="user-contact-info">
                        {/* Only show personal info for mutual friends */}
                        {u.email !== null && <p className="user-email">📧 {u.email}</p>}
                        {u.phone !== null && <p className="user-phone">📱 {u.phone}</p>}
                        {u.location !== null && <p className="user-location">📍 {u.location}</p>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p>Loading conversations...</p>
      ) : conversations.length === 0 ? (
        <div className="no-conversations">
          <p>No conversations yet</p>
          <p className="hint">Start chatting with vendors or customers!</p>
        </div>
      ) : (
        <div className="conversations-list">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className="conversation-item"
              onClick={() =>
                setSelectedConversation({
                  id: conversation.id,
                  username: conversation.username,
                })
              }
            >
              <div className="conversation-info">
                {conversation.profile_image ? (
                  <img
                    src={
                      conversation.profile_image.startsWith("data:")
                        ? conversation.profile_image
                        : `data:image/jpeg;base64,${conversation.profile_image}`
                    }
                    alt={conversation.username}
                    className="conversation-avatar"
                  />
                ) : (
                  <div className="conversation-avatar-placeholder">
                    {(conversation.username || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="conversation-details">
                  <h3>{conversation.username}</h3>
                  <p className="last-message">
                    {conversation.last_message || "No messages yet"}
                  </p>
                  <p className="message-time">
                    {conversation.last_message_time
                      ? new Date(
                          conversation.last_message_time
                        ).toLocaleDateString()
                      : ""}
                  </p>
                </div>
              </div>
              {conversation.unread_count > 0 && (
                <div className="unread-badge">{conversation.unread_count}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Conversations;
