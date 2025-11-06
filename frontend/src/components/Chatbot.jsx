import React, { useState, useRef, useEffect } from "react";
import { useUser } from "../hooks/useUser";
import axios from "../api";
import "./Chatbot.css";

const Chatbot = () => {
  const { user } = useUser();
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: "assistant",
      content:
        "Hello! I'm your Farmers Market assistant. I can help you with information about our marketplace and answer questions about the app. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const timeoutRef = useRef(null);
  const messageIdRef = useRef(1);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      // Cleanup timeout on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Get current time period (morning, afternoon, evening, night)
  const getTimePeriod = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  };

  // Fetch and group products by category
  const getProductsByCategory = async () => {
    try {
      const response = await axios.get("/products");
      const products = response.data;

      if (products.length === 0) {
        return (
          <div>
            <p>No products available at the moment. Please check back later!</p>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li>
                <a href="#/products" className="chatbot-link">
                  Browse Products
                </a>
              </li>
            </ul>
          </div>
        );
      }

      // Group products by category
      const groupedByCategory = {};
      products.forEach((product) => {
        const category = product.category || "Uncategorized";
        if (!groupedByCategory[category]) {
          groupedByCategory[category] = [];
        }
        groupedByCategory[category].push(product);
      });

      // Sort products within each category by price
      Object.keys(groupedByCategory).forEach((category) => {
        groupedByCategory[category].sort((a, b) => a.price - b.price);
      });

      return (
        <div>
          <p>📦 Products grouped by category:</p>
          {Object.entries(groupedByCategory).map(
            ([category, categoryProducts]) => (
              <div key={category} style={{ marginTop: "12px" }}>
                <h4
                  style={{
                    margin: "8px 0",
                    color: "#4CAF50",
                    fontSize: "14px",
                  }}
                >
                  {category}
                </h4>
                <ul style={{ paddingLeft: "20px", margin: "4px 0" }}>
                  {categoryProducts.map((product) => (
                    <li
                      key={product.id}
                      style={{ marginBottom: "4px", fontSize: "13px" }}
                    >
                      <strong>{product.name}</strong> - KES{" "}
                      {product.price.toFixed(2)}
                      {product.description && (
                        <span style={{ fontSize: "11px", color: "#666" }}>
                          {" "}
                          ({product.description})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
          <p style={{ marginTop: "12px" }}>
            <a href="#/products" className="chatbot-link">
              Browse all products →
            </a>
          </p>
        </div>
      );
    } catch (error) {
      console.error("Error fetching products:", error);
      return (
        <div>
          <p>
            I'm having trouble fetching product categories right now. Please try
            again later or:
          </p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>
              <a href="#/products" className="chatbot-link">
                Browse Products
              </a>
            </li>
          </ul>
        </div>
      );
    }
  };

  // Fetch and recommend affordable products
  const getAffordableProductRecommendations = async () => {
    try {
      const response = await axios.get("/products");
      const products = response.data;

      // Filter vegetables (assuming products have a category field)
      const vegetables = products.filter(
        (p) => p.category && p.category.toLowerCase().includes("vegetable")
      );

      if (vegetables.length === 0) {
        return (
          <div>
            <p>
              I don't have vegetable recommendations at the moment, but you can
              browse all products:
            </p>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li>
                <a href="#/products" className="chatbot-link">
                  Browse All Products
                </a>
              </li>
            </ul>
          </div>
        );
      }

      // Sort by price (ascending) to get most affordable
      const sortedVeggies = vegetables.sort((a, b) => a.price - b.price);
      const topAffordable = sortedVeggies.slice(0, 5);

      return (
        <div>
          <p>🥬 Here are the most affordable vegetables available:</p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            {topAffordable.map((product) => (
              <li key={product.id} style={{ marginBottom: "6px" }}>
                <strong>{product.name}</strong> - KES {product.price.toFixed(2)}
                {product.description && (
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    {" "}
                    ({product.description})
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: "12px" }}>
            <a href="#/products" className="chatbot-link">
              Browse all products →
            </a>
          </p>
        </div>
      );
    } catch (error) {
      console.error("Error fetching products:", error);
      return (
        <div>
          <p>
            I'm having trouble fetching product recommendations right now.
            Please try again later or:
          </p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>
              <a href="#/products" className="chatbot-link">
                Browse Products
              </a>
            </li>
          </ul>
        </div>
      );
    }
  };

  // Simple response function for common queries
  const getBotResponse = async (userMessage) => {
    const message = userMessage.toLowerCase().trim();
    const currentTime = getTimePeriod();

    // Greetings
    if (
      message.includes("hello") ||
      message.includes("hi") ||
      message.includes("hey") ||
      message.includes("morning") ||
      message.includes("afternoon") ||
      message.includes("evening") ||
      message.includes("night")
    ) {
      // Check if greeting is time-appropriate
      let greetingResponse = "";
      let isTimely = true;

      if (message.includes("morning")) {
        if (currentTime !== "morning") {
          greetingResponse = `😄 Haha, nice try! But it's actually ${currentTime} right now! However, good morning energy is always welcome! How can I help you?`;
          isTimely = false;
        } else {
          greetingResponse =
            "Good morning! ☀️ Welcome to Farmers Market Place. How can I help you today?";
        }
      } else if (message.includes("afternoon")) {
        if (currentTime !== "afternoon") {
          greetingResponse = `😄 Haha, I wish! But it's actually ${currentTime} right now. Anyway, how can I help you?`;
          isTimely = false;
        } else {
          greetingResponse =
            "Good afternoon! ☀️ Welcome to Farmers Market Place. How can I help you today?";
        }
      } else if (message.includes("evening")) {
        if (currentTime !== "evening") {
          greetingResponse = `😄 Haha, not quite! It's ${currentTime} right now. But thanks for the warm greeting! How can I help you?`;
          isTimely = false;
        } else {
          greetingResponse =
            "Good evening! 🌙 Welcome to Farmers Market Place. How can I help you today?";
        }
      } else if (message.includes("night")) {
        if (currentTime !== "night") {
          greetingResponse = `😄 Getting ahead of yourself? It's still ${currentTime}! But I'm here whenever you need help.`;
          isTimely = false;
        } else {
          greetingResponse =
            "Good night! 🌙 Still shopping? How can I help you?";
        }
      } else {
        greetingResponse =
          "Hello! Welcome to Farmers Market Place. How can I help you today?";
      }

      if (!user && isTimely) {
        return (
          <div>
            <p>{greetingResponse}</p>
            <p>Not logged in yet? Get started:</p>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li>
                <a href="#/auth?mode=login" className="chatbot-link">
                  Login
                </a>
              </li>
              <li>
                <a href="#/auth?mode=signup" className="chatbot-link">
                  Sign Up
                </a>
              </li>
            </ul>
          </div>
        );
      } else if (!user && !isTimely) {
        return (
          <div>
            <p>{greetingResponse}</p>
            <p>Not logged in yet? Get started:</p>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li>
                <a href="#/auth?mode=login" className="chatbot-link">
                  Login
                </a>
              </li>
              <li>
                <a href="#/auth?mode=signup" className="chatbot-link">
                  Sign Up
                </a>
              </li>
            </ul>
          </div>
        );
      }

      return greetingResponse;
    }

    // Thank you / Gratitude
    if (
      message.includes("thank") ||
      message.includes("thanks") ||
      message.includes("appreciate") ||
      message.includes("grateful")
    ) {
      return "You're welcome! 😊 Feel free to ask me anything else about Farmers Market Place. I'm always here to help!";
    }

    // Product recommendations (affordable vegetables)
    if (
      (message.includes("recommend") && message.includes("vegetable")) ||
      (message.includes("affordable") && message.includes("vegetable")) ||
      (message.includes("cheap") && message.includes("vegetable")) ||
      (message.includes("most affordable") && message.includes("vegetable")) ||
      (message.includes("cheapest") && message.includes("vegetable")) ||
      message.includes("recommend me the most affordable vegetables")
    ) {
      return await getAffordableProductRecommendations();
    }

    // Group products by category
    if (
      (message.includes("group") && message.includes("category")) ||
      (message.includes("products") && message.includes("category")) ||
      message.includes("show me products by category") ||
      message.includes("group products") ||
      message.includes("products grouped")
    ) {
      return await getProductsByCategory();
    }

    // About the app
    if (
      (message.includes("what is") && message.includes("app")) ||
      (message.includes("about") && message.includes("marketplace"))
    ) {
      return "Farmers Market Place is an online marketplace where local farmers and vendors can sell their fresh produce, meats, dairy, and other agricultural products directly to customers. We connect you with local, fresh, and sustainable food sources!";
    }

    // How to use
    if (
      message.includes("how") &&
      (message.includes("use") ||
        message.includes("work") ||
        message.includes("start"))
    ) {
      return "To get started: 1) Browse products on the home page, 2) Create an account to buy or sell, 3) Add items to your cart, 4) Complete checkout with M-Pesa payment. Vendors can list their products after account verification.";
    }

    // Products
    if (
      message.includes("product") ||
      message.includes("buy") ||
      message.includes("sell")
    ) {
      return (
        <div>
          <p>
            We offer fresh produce, meats, dairy, eggs, honey, and more from
            local farmers. Check out what's available:
          </p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>
              <a href="#/products" className="chatbot-link">
                Browse All Products
              </a>
            </li>
            {user && user.role === "vendor" ? (
              <li>
                <a href="#/vendor-dashboard" className="chatbot-link">
                  Add Products to Inventory
                </a>
              </li>
            ) : (
              <li>
                <a
                  href="#/auth?mode=signup&role=vendor"
                  className="chatbot-link"
                >
                  Become a Vendor
                </a>
              </li>
            )}
          </ul>
        </div>
      );
    }

    // Registration/Signup
    if (
      message.includes("register") ||
      message.includes("signup") ||
      message.includes("account") ||
      message.includes("join")
    ) {
      return (
        <div>
          <p>To create an account, click the link below:</p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>
              <a href="#/auth?mode=signup" className="chatbot-link">
                Create Customer Account
              </a>
            </li>
            <li>
              <a href="#/auth?mode=signup&role=vendor" className="chatbot-link">
                Create Vendor Account
              </a>
            </li>
          </ul>
          <p style={{ marginTop: "8px", fontSize: "12px" }}>
            Vendors need admin verification before they can sell products. All
            accounts are secure and protected.
          </p>
        </div>
      );
    }

    // Payment/Checkout
    if (
      message.includes("payment") ||
      message.includes("pay") ||
      message.includes("mpesa") ||
      message.includes("checkout")
    ) {
      return "We accept M-Pesa payments for secure and easy transactions. During checkout, enter your M-Pesa number and the system will initiate a payment request to your phone.";
    }

    // Farmers/Vendors
    if (
      message.includes("farmer") ||
      message.includes("vendor") ||
      message.includes("sell")
    ) {
      return (
        <div>
          <p>
            Local farmers and vendors can create accounts to sell their
            products. After signup, submit your details for admin verification.
            Once approved, you can add products, manage your inventory, and
            track sales.
          </p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>
              <a href="#/auth?mode=signup&role=vendor" className="chatbot-link">
                Become a Vendor
              </a>
            </li>
            {user && user.role === "vendor" && (
              <li>
                <a href="#/vendor-dashboard" className="chatbot-link">
                  Go to Vendor Dashboard
                </a>
              </li>
            )}
          </ul>
        </div>
      );
    }

    // Support/Contact
    if (
      message.includes("help") ||
      message.includes("support") ||
      message.includes("contact") ||
      message.includes("problem")
    ) {
      return "I'm here to help! You can ask me about using the app, products, registration, or any other questions. For technical issues, please check our support section or contact the admin.";
    }

    // Cart/Shopping
    if (
      message.includes("cart") ||
      message.includes("shopping") ||
      message.includes("order")
    ) {
      return (
        <div>
          <p>
            Add products to your cart while browsing. You can view your cart
            anytime, update quantities, or remove items. When ready, proceed to
            checkout with secure M-Pesa payment.
          </p>
          {user && (
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li>
                <a href="#/cart" className="chatbot-link">
                  View Your Cart
                </a>
              </li>
            </ul>
          )}
        </div>
      );
    }

    // Default response
    return (
      <div>
        <p>
          I'm here to help with questions about Farmers Market Place! You can
          ask me about: registration, buying/selling products, payments, or how
          to use the app.
        </p>
        <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
          <li>
            <a href="#/products" className="chatbot-link">
              Browse Products
            </a>
          </li>
          {!user && (
            <li>
              <a href="#/auth" className="chatbot-link">
                Login or Sign Up
              </a>
            </li>
          )}
          {user && user.role === "admin" && (
            <li>
              <a href="#/admin-dashboard" className="chatbot-link">
                Admin Dashboard
              </a>
            </li>
          )}
        </ul>
        <p style={{ marginTop: "8px" }}>What would you like to know?</p>
      </div>
    );
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: messageIdRef.current++,
      role: "user",
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    // Simulate typing delay for more natural feel
    timeoutRef.current = setTimeout(async () => {
      const botResponse = await getBotResponse(currentInput);
      const assistantMessage = {
        id: messageIdRef.current++,
        role: "assistant",
        content: botResponse,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 500 + Math.random() * 1000); // Random delay between 0.5-1.5 seconds
  };

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Chatbot Toggle Button */}
      <button
        className="chatbot-toggle"
        onClick={toggleChatbot}
        aria-label="Toggle chatbot"
      >
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Chatbot Window */}
      {isOpen && (
        <div className="chatbot-container">
          <div className="chatbot-header">
            <h3>Farmers Market Assistant</h3>
            <button
              className="chatbot-close"
              onClick={toggleChatbot}
              aria-label="Close chatbot"
            >
              ✕
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${
                  message.role === "user" ? "user-message" : "assistant-message"
                }`}
              >
                <div className="message-content">
                  {typeof message.content === "string"
                    ? message.content
                    : message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant-message">
                <div className="message-content typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="chatbot-input"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="chatbot-send-button"
            >
              {isLoading ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default Chatbot;
