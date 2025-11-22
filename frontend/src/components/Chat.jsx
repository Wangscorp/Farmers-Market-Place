import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "../api";
import { useUser } from "../hooks/useUser";
import "./Chat.css";

const Chat = ({ otherUserId, otherUsername, onClose, onMessageSent }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const { user } = useUser();
  const pollIntervalRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!otherUserId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/messages/${otherUserId}`);
      setMessages(response.data || []);

      // Mark messages as read
      try {
        await axios.patch(`/messages/${otherUserId}/read`);
      } catch (readError) {
        console.warn("Failed to mark messages as read:", readError);
        // Don't fail the whole operation if marking as read fails
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      setError("Failed to load messages. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Set up polling to refresh messages every 3 seconds
  useEffect(() => {
    loadMessages();

    pollIntervalRef.current = setInterval(() => {
      loadMessages();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [otherUserId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !otherUserId) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    try {
      const response = await axios.post("/messages", {
        receiver_id: otherUserId,
        content: messageContent,
      });

      if (response.data) {
        setMessages((prev) => [...prev, response.data]);
      }

      // Notify parent component that a message was sent
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Restore the message if sending failed
      setNewMessage(messageContent);
      toast.error("Failed to send message. Please try again.");
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) {
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    try {
      // Handle ISO 8601 format and other common formats
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        // If the date is invalid, use current time
        return new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting time:", timestamp, error);
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  if (!user) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h3>Please log in to use chat</h3>
          <button onClick={onClose} className="close-btn">
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat with {otherUsername}</h3>
        <button onClick={onClose} className="close-btn">
          ×
        </button>
      </div>

      <div className="messages-container">
        {error && <div className="error-message">{error}</div>}
        {loading ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.sender_id === user.id ? "sent" : "received"
              }`}
            >
              <div className="message-content">
                <p>{message.content}</p>
                <span className="message-time">
                  {formatTime(message.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="message-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="message-input"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="send-btn"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
