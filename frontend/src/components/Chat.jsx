import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import axios from "../api";
import { useUser } from "../hooks/useUser";
import "./Chat.css";

const Chat = React.memo(
  ({ otherUserId, otherUsername, onClose, onMessageSent }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);
    const { user } = useUser();
    const pollIntervalRef = useRef(null);

    // Context menu and editing states
    const [contextMenu, setContextMenu] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [editContent, setEditContent] = useState("");

    const loadMessages = useCallback(async () => {
      if (!otherUserId) return;

      try {
        // Only show loading on first load
        const isFirstLoad = messages.length === 0;
        if (isFirstLoad) {
          setLoading(true);
        }
        setError(null);
        const response = await axios.get(`/messages/${otherUserId}`);
        const newMessages = response.data || [];

        // Only update if messages actually changed to prevent unnecessary re-renders
        setMessages((prevMessages) => {
          if (JSON.stringify(prevMessages) !== JSON.stringify(newMessages)) {
            return newMessages;
          }
          return prevMessages;
        });

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
    }, [otherUserId, messages.length]);

    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    };

    const isUserNearBottom = () => {
      const container = messagesEndRef.current?.parentElement;
      if (!container) return true;

      const threshold = 100; // pixels from bottom
      return (
        container.scrollHeight - container.scrollTop - container.clientHeight <
        threshold
      );
    };

    // Set up polling to refresh messages every 5 seconds (reduced frequency)
    useEffect(() => {
      loadMessages();

      pollIntervalRef.current = setInterval(() => {
        loadMessages();
      }, 5000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }, [otherUserId, loadMessages]);

    // Smart scroll behavior - only scroll if user is near bottom or it's the first load
    useEffect(() => {
      const shouldScroll =
        messages.length > 0 && (loading || isUserNearBottom());
      if (shouldScroll) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    }, [messages.length, loading]); // Depend on length and loading state

    const sendMessage = async (e) => {
      e.preventDefault();

      if (!newMessage.trim() || !otherUserId) return;

      const messageContent = newMessage.trim();
      setNewMessage("");

      try {
        // Add the sent message to the list immediately for better UX
        const optimisticMessage = {
          id: Date.now(), // Temporary ID
          sender_id: user.id,
          receiver_id: otherUserId,
          content: messageContent,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMessage]);

        const response = await axios.post("/messages", {
          receiver_id: otherUserId,
          content: messageContent,
        });

        if (response.data) {
          // Replace the optimistic message with the real one from the server
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === optimisticMessage.id ? response.data : msg
            )
          );
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

    // Handle right-click context menu
    const handleContextMenu = (e, message) => {
      e.preventDefault();

      // Only show context menu for user's own messages
      if (message.sender_id !== user.id) return;

      const rect = e.currentTarget.getBoundingClientRect();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        messageId: message.id,
        message: message,
      });
    };

    // Close context menu when clicking outside
    useEffect(() => {
      const handleClickOutside = () => {
        setContextMenu(null);
      };

      if (contextMenu) {
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
      }
    }, [contextMenu]);

    // Handle edit message
    const handleEditMessage = (message) => {
      setEditingMessage(message.id);
      setEditContent(message.content);
      setContextMenu(null);
    };

    // Submit edit
    const handleEditSubmit = async (e) => {
      e.preventDefault();
      if (!editContent.trim() || !editingMessage) return;

      try {
        const response = await axios.put(`/messages/${editingMessage}`, {
          content: editContent.trim(),
        });

        // Update the message in the local state
        setMessages((prev) =>
          prev.map((msg) => (msg.id === editingMessage ? response.data : msg))
        );

        setEditingMessage(null);
        setEditContent("");
        toast.success("Message updated");
      } catch (error) {
        console.error("Error editing message:", error);
        toast.error("Failed to edit message");
      }
    };

    // Cancel edit
    const handleEditCancel = () => {
      setEditingMessage(null);
      setEditContent("");
    };

    // Handle delete message
    const handleDeleteMessage = async (messageId) => {
      if (!window.confirm("Are you sure you want to delete this message?")) {
        return;
      }

      try {
        await axios.delete(`/messages/${messageId}`);

        // Remove the message from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        setContextMenu(null);
        toast.success("Message deleted");
      } catch (error) {
        console.error("Error deleting message:", error);
        toast.error("Failed to delete message");
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
                <div
                  className="message-content"
                  onContextMenu={(e) => handleContextMenu(e, message)}
                >
                  {editingMessage === message.id ? (
                    // Edit mode
                    <form
                      onSubmit={handleEditSubmit}
                      className="edit-message-form"
                    >
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="edit-message-input"
                        maxLength={500}
                        autoFocus
                        placeholder="Edit your message..."
                      />
                      <div className="edit-buttons">
                        <button
                          type="submit"
                          className="edit-btn"
                          disabled={!editContent.trim()}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="cancel-btn"
                          onClick={handleEditCancel}
                        >
                          ✕
                        </button>
                      </div>
                    </form>
                  ) : (
                    // Display mode
                    <>
                      <p>{message.content}</p>
                      <span className="message-time">
                        {formatTime(message.created_at)}
                        {message.updated_at && (
                          <span className="message-edited"> (edited)</span>
                        )}
                      </span>
                    </>
                  )}
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

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="context-menu"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              className="context-menu-item"
              onClick={() => handleEditMessage(contextMenu.message)}
            >
              ✏️ Edit Message
            </button>
            <button
              className="context-menu-item delete"
              onClick={() => handleDeleteMessage(contextMenu.messageId)}
            >
              🗑️ Delete Message
            </button>
          </div>
        )}
      </div>
    );
  }
);

Chat.displayName = "Chat";

export default Chat;
