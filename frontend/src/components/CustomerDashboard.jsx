import React, { useState, useEffect } from 'react';
import axios from '../api';
import { useUser } from '../hooks/useUser';
import { useFollow } from './FollowContext';
import Chat from './Chat';
import './CustomerDashboard.css';

const CustomerDashboard = () => {
  const { user } = useUser();
  const { follows } = useFollow();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/messages');
      setConversations(response.data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openChat = (conversation) => {
    // Find the other user in the conversation
    const otherUserId = conversation.sender_id === user.id
      ? conversation.receiver_id
      : conversation.sender_id;
    const otherUsername = conversation.sender_id === user.id
      ? conversation.receiver_username
      : conversation.sender_username;

    setSelectedChat({ id: otherUserId, username: otherUsername });
  };

  const closeChat = () => {
    setSelectedChat(null);
  };

  if (!user) {
    return <div>Please log in to access your dashboard.</div>;
  }

  return (
    <div className="customer-dashboard">
      <h1>Customer Dashboard</h1>

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
                    onClick={() => openChat({
                      sender_id: user.id,
                      receiver_id: follow.vendor_id,
                      sender_username: user.username,
                      receiver_username: follow.vendor_username
                    })}
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
            <p>Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p>No conversations yet. Start chatting with vendors!</p>
          ) : (
            <div className="conversations-list">
              {conversations.map((conversation) => {
                const otherUsername = conversation.sender_id === user.id
                  ? conversation.receiver_username
                  : conversation.sender_username;

                return (
                  <div
                    key={`${conversation.sender_id}-${conversation.receiver_id}`}
                    className="conversation-item"
                    onClick={() => openChat(conversation)}
                  >
                    <div className="conversation-info">
                      <h4>{otherUsername}</h4>
                      <p className="last-message">
                        {conversation.content.length > 50
                          ? `${conversation.content.substring(0, 50)}...`
                          : conversation.content
                        }
                      </p>
                    </div>
                    <div className="conversation-time">
                      {new Date(conversation.created_at).toLocaleDateString()}
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
