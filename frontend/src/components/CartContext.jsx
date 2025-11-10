import { createContext, useContext, useState, useEffect } from "react";
import axios from "../api";

// eslint-disable-next-line react-refresh/only-export-components
export const CartContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load cart items when component mounts
  useEffect(() => {
    loadCartItems();
  }, []);

  const loadCartItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/cart");
      setCartItems(response.data);
    } catch (error) {
      console.error("Error loading cart:", error);
      // For now, keep empty cart on error
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (product, quantity = 1) => {
    try {
      const token = localStorage.getItem("token");

      console.log("[CartContext] Adding to cart:", {
        productId: product.id,
        quantity,
        hasToken: !!token,
      });

      // Ensure product_id is a number
      const productId = parseInt(product.id, 10);
      if (isNaN(productId)) {
        throw new Error("Invalid product ID");
      }

      // Validate quantity
      if (quantity <= 0 || !Number.isInteger(quantity)) {
        throw new Error("Quantity must be a positive integer");
      }

      // Check if product is already in cart
      const existingItem = cartItems.find(
        (item) => item.product_id === productId
      );
      if (existingItem) {
        // Check quantity limit
        if (existingItem.quantity + quantity > product.quantity) {
          throw new Error(
            `Cannot add ${quantity} more items. Only ${
              product.quantity - existingItem.quantity
            } available.`
          );
        }
      } else {
        // Check if product has any quantity available
        if (product.quantity <= 0) {
          throw new Error("This product is currently out of stock.");
        }
        // Check if requested quantity exceeds available stock
        if (quantity > product.quantity) {
          throw new Error(
            `Cannot add ${quantity} items. Only ${product.quantity} available.`
          );
        }
      }

      console.log("[CartContext] Sending POST /cart request...");
      const response = await axios.post("/cart", {
        product_id: productId,
        quantity: quantity,
      });
      console.log("[CartContext] Cart response received:", response.data);

      // Update cartItems properly - check if item exists and update, or add new
      setCartItems((prev) => {
        const existingItemIndex = prev.findIndex(
          (item) => item.product_id === productId
        );

        if (existingItemIndex >= 0) {
          // Update existing item
          const updated = [...prev];
          updated[existingItemIndex] = response.data;
          return updated;
        } else {
          // Add new item
          return [...prev, response.data];
        }
      });

      return response.data;
    } catch (error) {
      console.error("[CartContext] Error adding to cart:", error);
      if (error.response) {
        console.error("[CartContext] Error response:", {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
        // Throw a more specific error message
        if (error.response.status === 401) {
          throw new Error("Authentication failed. Please log in again.");
        }
        throw new Error(error.response.data || "Failed to add item to cart");
      }
      throw error;
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      await axios.delete(`/cart/${itemId}`);
      setCartItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error("Error removing from cart:", error);
      throw error;
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    try {
      if (quantity <= 0) {
        await removeFromCart(itemId);
        return;
      }

      // Find the cart item to check quantity limits
      const cartItem = cartItems.find((item) => item.id === itemId);
      if (cartItem) {
        // Check if the new quantity exceeds available stock
        if (quantity > cartItem.product.quantity) {
          throw new Error(
            `Cannot add more items. Only ${cartItem.product.quantity} available in stock.`
          );
        }
      }

      const response = await axios.patch(`/cart/${itemId}`, { quantity });
      setCartItems((prev) =>
        prev.map((item) => (item.id === itemId ? response.data : item))
      );
    } catch (error) {
      console.error("Error updating quantity:", error);
      throw error;
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        loading,
        addToCart,
        removeFromCart,
        updateQuantity,
        getTotalPrice,
        getTotalItems,
        loadCartItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
