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

  const addToCart = async (product) => {
    try {
      const response = await axios.post("/cart", {
        product_id: product.id,
        quantity: 1,
      });
      setCartItems((prev) => [...prev, response.data]);
    } catch (error) {
      console.error("Error adding to cart:", error);
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
      const response = await axios.put(`/cart/${itemId}`, { quantity });
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
