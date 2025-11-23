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

  // New state for search, filters, and sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc"); // name-asc, name-desc, price-asc, price-desc, newest
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [loading, setLoading] = useState(false);

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
      setLoading(true);
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
      const productsData = response.data;

      // Fetch reviews for each product
      const productsWithReviews = await Promise.all(
        productsData.map(async (product) => {
          try {
            const reviewsResponse = await axios.get(
              `/reviews/product/${product.id}`
            );
            const reviews = reviewsResponse.data;
            const avgRating =
              reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;
            return {
              ...product,
              reviewCount: reviews.length,
              averageRating: avgRating,
            };
          } catch (error) {
            return { ...product, reviewCount: 0, averageRating: 0 };
          }
        })
      );

      setProducts(productsWithReviews);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
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
    let filtered = products;

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (product) => getCategoryFromProduct(product) === selectedCategory
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query) ||
          product.category?.toLowerCase().includes(query)
      );
    }

    // Filter by price range
    if (priceRange.min !== "") {
      filtered = filtered.filter(
        (product) => product.price >= parseFloat(priceRange.min)
      );
    }
    if (priceRange.max !== "") {
      filtered = filtered.filter(
        (product) => product.price <= parseFloat(priceRange.max)
      );
    }

    // Sort products
    const sortedFiltered = [...filtered];
    switch (sortBy) {
      case "name-asc":
        sortedFiltered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sortedFiltered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "price-asc":
        sortedFiltered.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sortedFiltered.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        sortedFiltered.sort((a, b) => b.id - a.id);
        break;
      default:
        break;
    }

    return sortedFiltered;
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

      {/* Search and Filter Controls */}
      <div className="filters-container">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search products by name, category, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls">
          <div className="price-range-filter">
            <label>Price Range:</label>
            <input
              type="number"
              placeholder="Min"
              value={priceRange.min}
              onChange={(e) =>
                setPriceRange({ ...priceRange, min: e.target.value })
              }
              className="price-input"
              min="0"
            />
            <span className="price-separator">-</span>
            <input
              type="number"
              placeholder="Max"
              value={priceRange.max}
              onChange={(e) =>
                setPriceRange({ ...priceRange, max: e.target.value })
              }
              className="price-input"
              min="0"
            />
            {(priceRange.min || priceRange.max) && (
              <button
                className="clear-price-btn"
                onClick={() => setPriceRange({ min: "", max: "" })}
                title="Clear price filter"
              >
                ✕
              </button>
            )}
          </div>

          <div className="sort-control">
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="newest">Newest First</option>
            </select>
          </div>
        </div>

        <div className="results-count">
          Showing {getFilteredProducts().length} of {products.length} products
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
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading products...</p>
        </div>
      ) : getFilteredProducts().length === 0 ? (
        <div className="no-products">
          <p>No products found matching your criteria.</p>
          {(searchQuery ||
            priceRange.min ||
            priceRange.max ||
            selectedCategory !== "All") && (
            <button
              className="reset-filters-btn"
              onClick={() => {
                setSearchQuery("");
                setPriceRange({ min: "", max: "" });
                setSelectedCategory("All");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
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

              {/* Product Rating */}
              {product.reviewCount > 0 && (
                <div className="product-rating">
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={
                          star <= Math.round(product.averageRating)
                            ? "star filled"
                            : "star"
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="rating-text">
                    {product.averageRating.toFixed(1)} ({product.reviewCount}{" "}
                    {product.reviewCount === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}

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
      )}

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
