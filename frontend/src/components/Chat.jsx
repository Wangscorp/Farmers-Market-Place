import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from "react-toastify";
import axios from '../api';
import { useUser } from '../hooks/useUser';
import './Chat.css';

const Chat = ({ otherUserId, otherUsername, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useUser();

  useEffect(() => {
    if (otherUserId) {
      loadMessages();
    }
  }, [otherUserId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = useCallback(async () => {
    if (!otherUserId) return;

    try {
      setLoading(true);
      const response = await axios.get(`/messages/${otherUserId}`);
      setMessages(response.data);

      // Mark messages as read
      await axios.patch(`/messages/${otherUserId}/read`);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !otherUserId) return;

    try {
      const response = await axios.post('/messages', {
        receiver_id: otherUserId,
        content: newMessage.trim()
      });

      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <h3>Please log in to use chat</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat with {otherUsername}</h3>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="messages-container">
        {loading ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.sender_id === user.id ? 'sent' : 'received'}`}
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
