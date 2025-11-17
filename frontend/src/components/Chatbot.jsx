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
      content: (
        <div>
          <p>👋 Welcome to Farmers Market Place!</p>
          <p>I'm your virtual assistant. I can help you with:</p>
          <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
            <li>🌱 Browsing and purchasing fresh produce</li>
            <li>📍 Finding vendors near you</li>
            <li>📦 Tracking your orders</li>
            <li>🏪 Becoming a vendor</li>
            <li>💳 Payment and checkout help</li>
          </ul>
          <p>How can I assist you today?</p>
        </div>
      ),
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

  // Professional response function with comprehensive FAQ coverage
  const getBotResponse = async (userMessage) => {
    const message = userMessage.toLowerCase().trim();
    const currentTime = getTimePeriod();

    // === GREETINGS ===
    if (
      message.includes("hello") ||
      message.includes("hi") ||
      message.includes("hey") ||
      message.includes("good morning") ||
      message.includes("good afternoon") ||
      message.includes("good evening") ||
      message.includes("good night") ||
      message === "morning" ||
      message === "afternoon" ||
      message === "evening" ||
      message === "night"
    ) {
      const timeGreetings = {
        morning: "Good morning! ☀️ Welcome to Farmers Market Place.",
        afternoon: "Good afternoon! ☀️ Welcome to Farmers Market Place.",
        evening: "Good evening! 🌙 Welcome to Farmers Market Place.",
        night: "Good night! 🌙 Welcome to Farmers Market Place."
      };

      return (
        <div>
          <p>{timeGreetings[currentTime]}</p>
          {!user ? (
            <div>
              <p>To get the most out of our platform, please sign in or create an account:</p>
              <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                <li><a href="#/auth?mode=login" className="chatbot-link">Sign In</a> to existing account</li>
                <li><a href="#/auth?mode=signup" className="chatbot-link">Sign Up</a> for new account</li>
              </ul>
            </div>
          ) : (
            <p>I'm here to assist you with navigation, orders, and any questions about our marketplace. How can I help you today?</p>
          )}
        </div>
      );
    }

    // === LOCATION-BASED QUESTIONS ===
    if (
      message.includes("location") ||
      message.includes("near me") ||
      message.includes("local") ||
      message.includes("close") ||
      message.includes("distance") ||
      message.includes("find vendors") ||
      message.includes("shops near")
    ) {
      return (
        <div>
          <p>📍 <strong>Location-Based Shopping:</strong> We help you discover vendors near you!</p>
          <p>During signup, you can set your location automatically via GPS or manually enter your city/area. This enables:</p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Find vendors within 50km of your location</li>
            <li>Choose between "Local Shops" or "All Shops" mode</li>
            <li>Support local farmers in your community</li>
          </ul>
          {!user ? (
            <p><a href="#/auth?mode=signup" className="chatbot-link">Create an account</a> to enable location features.</p>
          ) : (
            <div>
              <p>In your Products section, you can toggle between local and nationwide shopping.</p>
              <p><a href="#/products" className="chatbot-link">Browse Products</a> to try location-based filtering.</p>
            </div>
          )}
        </div>
      );
    }

    // === ORDER TRACKING ===
    if (
      message.includes("order") ||
      message.includes("track") ||
      message.includes("status") ||
      message.includes("where is") ||
      message.includes("delivery")
    ) {
      if (!user) {
        return (
          <div>
            <p>Please sign in to view your orders and track their status.</p>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li><a href="#/auth?mode=login" className="chatbot-link">Sign In</a> to access your orders</li>
            </ul>
          </div>
        );
      }

      return (
        <div>
          <p>📦 <strong>Order Tracking:</strong> All orders are tracked with detailed status updates.</p>
          <p><strong>Order Statuses:</strong></p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li><strong>🟡 Pending:</strong> Payment confirmed, preparing for shipment</li>
            <li><strong>🔵 Shipped:</strong> Order dispatched by vendor</li>
            <li><strong>🟢 Delivered:</strong> Order received by customer</li>
            <li><strong>🔴 Cancelled:</strong> Order cancelled or returned</li>
          </ul>
          <p><a href="#/shipping" className="chatbot-link">View My Orders</a> to check your order status and history.</p>
          {user.role === "vendor" && (
            <p>As a vendor, you can update order statuses in your dashboard.</p>
          )}
        </div>
      );
    }

    // === ACCOUNT MANAGEMENT ===
    if (
      message.includes("account") ||
      message.includes("profile") ||
      message.includes("password") ||
      message.includes("settings")
    ) {
      if (!user) {
        return (
          <div>
            <p>To access your account settings, please sign in.</p>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li><a href="#/auth?mode=login" className="chatbot-link">Sign In</a></li>
              <li><a href="#/auth?mode=signup" className="chatbot-link">Create New Account</a></li>
            </ul>
          </div>
        );
      }

      return (
        <div>
          <p>⚙️ <strong>Account Management:</strong></p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Your current role: <strong>{user.role}</strong></li>
            <li>Username: {user.username}</li>
            {user.role === "vendor" && (
              <li><a href="#/vendor" className="chatbot-link">Vendor Dashboard</a> - Manage your products</li>
            )}
            {user.role === "customer" && (
              <li><a href="#/shipping" className="chatbot-link">My Orders</a> - View order history</li>
            )}
            {user.role === "admin" && (
              <li><a href="#/admin" className="chatbot-link">Admin Dashboard</a> - System management</li>
            )}
          </ul>
        </div>
      );
    }

    // === BECOMING A VENDOR ===
    if (
      message.includes("vendor") ||
      message.includes("seller") ||
      message.includes("sell") ||
      message.includes("farmer") ||
      message.includes("supplier")
    ) {
      return (
        <div>
          <p>🏪 <strong>Becoming a Vendor:</strong> Join our network of verified suppliers!</p>
          <p><strong>Process:</strong></p>
          <ol style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Create a vendor account</li>
            <li>Submit verification documents</li>
            <li>Await admin approval (usually 1-2 business days)</li>
            <li>Once approved, you can add products and start selling</li>
          </ol>
          {!user ? (
            <p><a href="#/auth?mode=signup&role=vendor" className="chatbot-link">Create Vendor Account</a></p>
          ) : user.role === "vendor" ? (
            <div>
              <p>Welcome back! As a verified vendor:</p>
              <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                <li><a href="#/vendor" className="chatbot-link">Manage Products</a></li>
                <li><a href="#/shipping" className="chatbot-link">View Customer Orders</a></li>
              </ul>
            </div>
          ) : (
            <p>You can also create a separate vendor account if you're currently a customer.</p>
          )}

          <p style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
            <em>All vendors undergo verification to ensure quality and authenticity of products.</em>
          </p>
        </div>
      );
    }

    // === PAYMENT QUESTIONS ===
    if (
      message.includes("payment") ||
      message.includes("pay") ||
      message.includes("mpesa") ||
      message.includes("checkout") ||
      message.includes("money") ||
      message.includes("cost")
    ) {
      return (
        <div>
          <p>💳 <strong>Secure Payments:</strong> We use M-Pesa for all transactions.</p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Safe and instant mobile money payments</li>
            <li>No credit card fees or hidden charges</li>
            <li>Real-time payment confirmation</li>
            <li>Minimum transaction: KSh 1</li>
            <li>All payments are secured and tracked</li>
          </ul>
          {user && (
            <div style={{ marginTop: "12px" }}>
              <p><a href="#/payments/history" className="chatbot-link">View Payment History</a></p>
              <p><a href="#/cart" className="chatbot-link">Checkout Cart</a></p>
            </div>
          )}
        </div>
      );
    }

    // === CART & SHOPPING ===
    if (
      message.includes("cart") ||
      message.includes("shopping") ||
      message.includes("add to cart") ||
      message.includes("basket")
    ) {
      return (
        <div>
          <p>🛒 <strong>Shopping Cart:</strong> Easy and secure online shopping.</p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Browse products and add to cart</li>
            <li>Adjust quantities anytime</li>
            <li>Secure M-Pesa checkout process</li>
            <li>Automatic order creation upon payment</li>
            <li>Track orders from cart to delivery</li>
          </ul>
          {!user ? (
            <p><a href="#/auth?mode=login" className="chatbot-link">Sign in</a> to access shopping features.</p>
          ) : (
            <div>
              <p>Ready to shop? <a href="#/products" className="chatbot-link">Browse Products</a></p>
              <p><a href="#/cart" className="chatbot-link">View Cart</a></p>
            </div>
          )}
        </div>
      );
    }

    // === PRODUCT QUESTIONS ===
    if (
      message.includes("product") ||
      message.includes("price") ||
      message.includes("quality") ||
      message.includes("fresh") ||
      message.includes("organic") ||
      (message.includes("what") && message.includes("buy"))
    ) {
      return await getProductsByCategory();
    }

    // === RECOMMENDATIONS ===
    if (
      message.includes("recommend") ||
      message.includes("suggest") ||
      message.includes("best") ||
      message.includes("cheap") ||
      message.includes("affordable")
    ) {
      if (message.includes("vegetable") || message.includes("fruit")) {
        return await getAffordableProductRecommendations();
      }

      return (
        <div>
          <p>🏆 <strong>Recommendations:</strong></p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li><strong>Affordable produce:</strong> Tomatoes, onions, and potatoes from local farmers</li>
            <li><strong>Fresh dairy:</strong> Milk and eggs from verified suppliers</li>
            <li><strong>Quality meats:</strong> Beef and chicken from trusted vendors</li>
          </ul>
          <p><a href="#/products" className="chatbot-link">Explore All Products</a></p>
        </div>
      );
    }

    // === HOW TO USE THE APP ===
    if (
      message.includes("how to") ||
      message.includes("guide") ||
      message.includes("tutorial") ||
      message.includes("begin") ||
      message.includes("start") ||
      message.includes("use")
    ) {
      return (
        <div>
          <p>🚀 <strong>Getting Started Guide:</strong></p>
          <ol style={{ marginTop: "8px", paddingLeft: "20px" }}>
            {!user && (
              <>
                <li><strong>Sign Up:</strong> <a href="#/auth?mode=signup" className="chatbot-link">Create Account</a> (customer or vendor)</li>
                <li><strong>Add Location:</strong> During signup, set your location for local shopping</li>
              </>
            )}
            <li><strong>Browse:</strong> <a href="#/products" className="chatbot-link">Explore Products</a> with location-based filtering</li>
            <li><strong>Shop:</strong> Add items to cart, then checkout with M-Pesa</li>
            <li><strong>Track:</strong> Monitor order status in "My Orders"</li>
            {user?.role === "vendor" && (
              <li><strong>Sell:</strong> Use vendor dashboard to manage products and orders</li>
            )}
          </ol>
          <p style={{ marginTop: "12px" }}>Need help with a specific feature? Just ask!</p>
        </div>
      );
    }

    // === ABOUT THE PLATFORM ===
    if (
      message.includes("about") ||
      message.includes("what is") ||
      message.includes("platform") ||
      message.includes("marketplace") ||
      message.includes("company")
    ) {
      return (
        <div>
          <p>🌱 <strong>About Farmers Market Place:</strong></p>
          <p>We are an innovative online marketplace connecting local farmers and vendors directly with customers. Our mission is to:</p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Support local agriculture and sustainable farming</li>
            <li>Provide fresh, quality produce at fair prices</li>
            <li>Enable location-based shopping for convenience</li>
            <li>Ensure secure transactions through M-Pesa integration</li>
            <li>Build a transparent supply chain from farm to table</li>
          </ul>
          <p><strong>Serving:</strong> Nairobi and surrounding areas | <strong>Payments:</strong> M-Pesa only</p>
        </div>
      );
    }

    // === NAVIGATION HELP ===
    if (
      message.includes("navigate") ||
      message.includes("find") ||
      message.includes("where") ||
      message.includes("menu") ||
      message.includes("dashboard")
    ) {
      if (!user) {
        return (
          <div>
            <p>🏠 <strong>Public Navigation:</strong></p>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li><strong>Home:</strong> Browse featured products and get started</li>
              <li><strong>Products:</strong> Search and filter all available items</li>
              <li><strong>Login:</strong> Access your account</li>
            </ul>
            <p><a href="#/" className="chatbot-link">Go to Homepage</a></p>
          </div>
        );
      }

      return (
        <div>
          <p>🧭 <strong>Navigation Guide:</strong></p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li><strong>Home:</strong> Featured products and marketplace overview</li>
            <li><strong>Products:</strong> Browse with location-based filtering</li>
            {user.role !== "vendor" && (
              <li><strong>Cart:</strong> Your shopping cart and checkout</li>
            )}
            <li><strong>My Orders:</strong> Order history and tracking</li>
            {user.role === "vendor" && (
              <li><strong>Vendor Dashboard:</strong> Product and sales management</li>
            )}
            {user.role === "admin" && (
              <li><strong>Admin Dashboard:</strong> System management</li>
            )}
          </ul>
        </div>
      );
    }

    // === CONTACT/SUPPORT ===
    if (
      message.includes("contact") ||
      message.includes("help") ||
      message.includes("support") ||
      message.includes("problem") ||
      message.includes("issue") ||
      message.includes("feedback") ||
      message.includes("report")
    ) {
      return (
        <div>
          <p>🆘 <strong>Support & Help:</strong></p>
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li><strong>I'm always here</strong> for questions about using the platform</li>
            <li><strong>Report vendor issues</strong> directly in your order history</li>
            <li><strong>Technical problems:</strong> Try refreshing the page or clearing cache</li>
            <li><strong>Payment issues:</strong> Check M-Pesa balance and network</li>
          </ul>
          <p style={{ marginTop: "12px" }}>
            For urgent issues requiring human intervention, please use the report features in orders or contact the admin.
          </p>
        </div>
      );
    }

    // === ADMINISTRATOR FEATURES ===
    if (
      message.includes("admin") ||
      message.includes("administrator") ||
      user?.role === "admin"
    ) {
      if (user?.role === "admin") {
        return (
          <div>
            <p>👑 <strong>Admin Features:</strong></p>
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              <li><strong>User Management:</strong> View, verify, and manage all accounts</li>
              <li><strong>Vendor Approval:</strong> Review vendor applications and documents</li>
              <li><strong>Report Resolution:</strong> Handle customer and vendor disputes</li>
              <li><strong>System Monitoring:</strong> Database insights and analytics</li>
              <li><strong>Account Recovery:</strong> Reset passwords and manage access</li>
            </ul>
            <p><a href="#/admin" className="chatbot-link">Access Admin Dashboard</a></p>
          </div>
        );
      } else if (message.includes("become admin")) {
        return "Administrator accounts are assigned by existing administrators. Contact the current admin if you need admin privileges.";
      }
    }

    // === THANK YOU ===
    if (
      message.includes("thank") ||
      message.includes("thanks") ||
      message.includes("appreciate") ||
      message.includes("grateful")
    ) {
      return (
        <div>
          <p>You're very welcome! 😊</p>
          <p>It's my pleasure to help you navigate Farmers Market Place. Whether you need help shopping, selling, or just have questions about our platform, I'm always here.</p>
          <p>Happy shopping! 🛒🌱</p>
        </div>
      );
    }

    // === DEFAULT RESPONSE ===
    return (
      <div>
        <p>🤔 I can help you with many aspects of Farmers Market Place.</p>
        <p><strong>I can assist with:</strong></p>
        <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
          <li>📍 Location-based shopping and finding nearby vendors</li>
          <li>📦 Order tracking and shipping status</li>
          <li>🛒 Shopping cart and checkout questions</li>
          <li>💳 Payment methods and M-Pesa integration</li>
          <li>🏪 Becoming a vendor or managing your store</li>
          <li>⚙️ Account settings and profile management</li>
          <li>🧭 Navigation and app features</li>
          <li>🆘 Support and troubleshooting</li>
        </ul>
        <p style={{ marginTop: "12px" }}>Try asking about any of these topics, or simply say what you're looking for!</p>
        {!user && (
          <p><a href="#/auth" className="chatbot-link">Sign in or sign up</a> to access all features.</p>
        )}
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
            <div>
              <h3>Farmers Market Assistant</h3>
              <div className="chatbot-subtitle">Your 24/7 marketplace guide</div>
            </div>
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
