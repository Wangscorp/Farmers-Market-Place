import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import axios from "../api";
import { useCart } from "./CartContext";
import { useUser } from "../hooks/useUser";
import { useContext } from "react";
import { UserContext } from "./UserContext";
import "./Products.css";
import Chat from "./Chat";

const Products = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [locationBasedShopping, setLocationBasedShopping] = useState(() => {
    // Load preference from localStorage, default to true
    return localStorage.getItem("locationBasedShopping") !== "false";
  });

  // Function to toggle location-based shopping
  const toggleLocationBasedShopping = () => {
    const newValue = !locationBasedShopping;
    setLocationBasedShopping(newValue);
    localStorage.setItem("locationBasedShopping", newValue.toString());
    // Refetch products with the new preference
    fetchProducts();
  };

  const fetchProducts = async () => {
    try {
      let url = "/products";
      const params = [];

      // Filter by user's text location if enabled and available
      if (locationBasedShopping && user?.location_string) {
        params.push(`location=${encodeURIComponent(user.location_string)}`);
      }

      if (params.length > 0) {
        url += `?${params.join("&")}`;
      }

      const response = await axios.get(url);
      setProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const [chatUser, setChatUser] = useState(null);
  const [quantities, setQuantities] = useState({});
  const { addToCart } = useCart();
  const { user } = useUser();

  // Define category mappings
  const categoryMapping = {
    Vegetables: ["vegetable", "greens", "leafy"],
    Fruits: ["fruit", "berry", "citrus", "apple", "orange", "banana"],
    "Animal Products": [
      "meat",
      "dairy",
      "egg",
      "honey",
      "cheese",
      "milk",
      "beef",
      "chicken",
      "fish",
    ],
    "Dry Grains": [
      "grain",
      "rice",
      "wheat",
      "maize",
      "beans",
      "lentils",
      "cereal",
      "flour",
    ],
  };

  const getCategoryFromProduct = (product) => {
    const productCategory = product.category?.toLowerCase() || "";
    for (const [category, keywords] of Object.entries(categoryMapping)) {
      if (keywords.some((keyword) => productCategory.includes(keyword))) {
        return category;
      }
    }
    return "Other";
  };

  useEffect(() => {
    fetchProducts();
  }, [user, locationBasedShopping]); // Refetch when user or preference changes

  const getFilteredProducts = () => {
    if (selectedCategory === "All") {
      return products;
    }
    return products.filter(
      (product) => getCategoryFromProduct(product) === selectedCategory
    );
  };

  const getAvailableCategories = () => {
    const categories = new Set(
      products.map((product) => getCategoryFromProduct(product))
    );
    return ["All", ...Array.from(categories).sort()];
  };

  const handleQuantityChange = (productId, value) => {
    const quantity = parseInt(value, 10);
    if (isNaN(quantity) || quantity < 1) {
      setQuantities((prev) => ({ ...prev, [productId]: 1 }));
    } else {
      setQuantities((prev) => ({ ...prev, [productId]: quantity }));
    }
  };

  const incrementQuantity = (productId, maxQuantity) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.min((prev[productId] || 1) + 1, maxQuantity),
    }));
  };

  const decrementQuantity = (productId) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max((prev[productId] || 1) - 1, 1),
    }));
  };

  const handleAddToCart = async (product) => {
    if (!user) {
      const shouldRedirect = window.confirm(
        "Please log in to add items to cart. Would you like to go to the login page?"
      );
      if (shouldRedirect) {
        navigate("/auth");
      }
      return;
    }

    const quantity = quantities[product.id] || 1;

    try {
      await addToCart(product, quantity);
      // Immediately redirect to cart for checkout/payment
      navigate("/cart");
    } catch (error) {
      console.error("Error adding to cart:", error);
      // Handle 401 authentication errors
      if (
        error.message.includes("Authentication failed") ||
        error.message.includes("log in")
      ) {
        const shouldRedirect = window.confirm(
          "Your session has expired. Would you like to log in again?"
        );
        if (shouldRedirect) {
          navigate("/auth");
        }
      } else {
        // Show specific error message if available, otherwise generic message
        const errorMessage = error.message || "Failed to add item to cart";
        toast.success(errorMessage);
      }
    }
  };

  return (
    <div>
      <h2>Available Products</h2>

      {/* Shopping Mode Toggle */}
      <div className="shopping-mode-toggle">
        <div className="toggle-container">
          <label className="toggle-label">Shopping Mode:</label>
          <div className="toggle-buttons">
            <button
              className={`toggle-btn ${locationBasedShopping ? "active" : ""}`}
              onClick={toggleLocationBasedShopping}
              disabled={!user?.location_string}
              title={
                user?.location_string
                  ? `Show vendors from ${user.location_string}`
                  : "Set your location in profile to filter by area"
              }
            >
              My Area ({user?.location_string || "Not set"})
            </button>
            <button
              className={`toggle-btn ${!locationBasedShopping ? "active" : ""}`}
              onClick={toggleLocationBasedShopping}
            >
              All Shops
            </button>
          </div>
          <p className="toggle-description">
            {locationBasedShopping
              ? user?.location_string
                ? `Showing products from vendors in ${user.location_string}`
                : "Please set your location in your profile to filter products"
              : "Browsing products from all vendors nationwide"}
          </p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="category-filter">
        {getAvailableCategories().map((category) => (
          <button
            key={category}
            className={`category-btn ${
              selectedCategory === category ? "active" : ""
            }`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="products-list">
        {getFilteredProducts().map((product) => (
          <div key={product.id} className="product-item">
            {product.image && (
              <img
                src={product.image}
                alt={product.name}
                className="product-image"
              />
            )}
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <p className="price">KSh {product.price.toLocaleString()}</p>
            <p className="quantity">Available: {product.quantity}</p>
            <p className="category">{product.category}</p>
            <div className="product-actions">
              {user && user.role !== "Vendor" ? (
                <div className="quantity-input-group">
                  <label>Quantity:</label>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      onClick={() => decrementQuantity(product.id)}
                      className="quantity-btn quantity-btn-decrement"
                      disabled={(quantities[product.id] || 1) <= 1}
                    >
                      -
                    </button>
                    <input
                      id={`quantity-${product.id}`}
                      type="number"
                      min="1"
                      max={product.quantity}
                      value={quantities[product.id] || 1}
                      onChange={(e) =>
                        handleQuantityChange(product.id, e.target.value)
                      }
                      className="quantity-input"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        incrementQuantity(product.id, product.quantity)
                      }
                      className="quantity-btn quantity-btn-increment"
                      disabled={
                        (quantities[product.id] || 1) >= product.quantity
                      }
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="add-to-cart-btn"
                  >
                    Add to Cart
                  </button>
                </div>
              ) : (
                <div className="login-required-message">
                  <p>
                    Please{" "}
                    <a
                      href="/auth"
                      style={{
                        color: "#27ae60",
                        textDecoration: "none",
                        fontWeight: "bold",
                      }}
                    >
                      log in
                    </a>{" "}
                    to purchase items
                  </p>
                </div>
              )}
              {user && user.role !== "Vendor" && (
                <button
                  onClick={() => {
                    navigate(`/vendor-profile/${product.vendor_id}`);
                  }}
                  className="view-profile-btn"
                >
                  View Seller Profile
                </button>
              )}
            </div>
          </div>
        ))}
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

export default Products;
