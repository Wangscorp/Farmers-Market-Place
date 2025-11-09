import { useState } from "react";
import { useCart } from "./CartContext";
import "./Cart.css";

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, getTotalPrice, loading } =
    useCart();
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [selectedItems, setSelectedItems] = useState(new Set());

  const handleItemSelect = (itemId, isSelected) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const handleRemoveSelected = async () => {
    if (selectedItems.size === 0) {
      alert("Please select items to remove");
      return;
    }

    try {
      const removePromises = Array.from(selectedItems).map(itemId =>
        removeFromCart(itemId)
      );
      await Promise.all(removePromises);
      setSelectedItems(new Set());
      alert(`${selectedItems.size} item(s) removed from cart`);
    } catch {
      alert("Failed to remove some items from cart");
    }
  };

  const handleRemoveFromCart = async (itemId) => {
    try {
      await removeFromCart(itemId);
      alert("Item removed from cart");
    } catch {
      alert("Failed to remove item from cart");
    }
  };

  const handleQuantityChange = async (itemId, newQuantity) => {
    try {
      if (newQuantity <= 0) {
        await handleRemoveFromCart(itemId);
        return;
      }
      await updateQuantity(itemId, newQuantity);
    } catch (error) {
      // Show specific error message if available, otherwise generic message
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update quantity";
      alert(errorMessage);
    }
  };

  const getSelectedTotal = () => {
    if (selectedItems.size === 0) {
      return getTotalPrice();
    }
    return cartItems
      .filter(item => selectedItems.has(item.id))
      .reduce((total, item) => total + item.product.price * item.quantity, 0);
  };

  const handleCheckout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please log in to checkout");
        return;
      }

      if (!mpesaNumber || !/^07\d{8}$/.test(mpesaNumber)) {
        alert("Please enter a valid M-Pesa phone number (07XXXXXXXX)");
        return;
      }

      if (cartItems.length === 0) {
        alert("Your cart is empty");
        return;
      }

      const selectedItemIds = selectedItems.size > 0 ? Array.from(selectedItems) : null;

      const response = await fetch("http://localhost:8080/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mpesa_number: mpesaNumber,
          total_amount: getSelectedTotal(),
          selected_items: selectedItemIds,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `Payment initiated! Check your phone for M-Pesa prompt. Transaction ID: ${result.transaction_id}`
        );
        // Clear cart after successful payment initiation
        setMpesaNumber("");
        window.location.reload(); // Simple way to refresh and clear cart
      } else {
        const errorData = await response.json();
        alert(`Payment failed: ${errorData.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to process payment. Please try again.");
    }
  };

  if (loading) {
    return <div className="cart">Loading cart...</div>;
  }

  return (
    <div className="cart">
      <h2>Your Cart</h2>
      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div>
          {cartItems.map((item) => (
            <div key={item.id} className="cart-item">
              <input
                type="checkbox"
                checked={selectedItems.has(item.id)}
                onChange={(e) => handleItemSelect(item.id, e.target.checked)}
                className="cart-item-checkbox"
              />
              {item.product.image && (
                <img
                  src={
                    item.product.image.startsWith("data:")
                      ? item.product.image
                      : `data:image/jpeg;base64,${item.product.image}`
                  }
                  alt={item.product.name}
                  className="cart-item-image"
                />
              )}
              <div className="cart-item-info">
                <p>
                  <strong>{item.product.name}</strong>
                </p>
                <p>{item.product.description}</p>
              </div>
              <div className="cart-item-controls">
                <div className="quantity-controls">
                  <button
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity - 1)
                    }
                    title={
                      item.quantity === 1
                        ? "Remove item from cart"
                        : `Decrease quantity (${item.quantity - 1} will remain)`
                    }
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity + 1)
                    }
                    disabled={item.quantity >= item.product.quantity}
                    title={
                      item.quantity >= item.product.quantity
                        ? `Only ${item.product.quantity} available in stock`
                        : `Add more (${
                            item.product.quantity - item.quantity
                          } remaining)`
                    }
                  >
                    +
                  </button>
                </div>
                <p className="item-price">
                  KSh {(item.product.price * item.quantity).toLocaleString()}
                </p>
                <button
                  className="remove-button"
                  onClick={() => handleRemoveFromCart(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {selectedItems.size > 0 && (
            <div className="cart-actions">
              <button
                className="remove-selected-button"
                onClick={handleRemoveSelected}
              >
                Remove Selected ({selectedItems.size})
              </button>
            </div>
          )}
          <div className="cart-total">
            <h3>
              Total: KSh {getSelectedTotal().toLocaleString()}
              {selectedItems.size > 0 && selectedItems.size < cartItems.length && (
                <small> (selected items only)</small>
              )}
            </h3>
          </div>
        </div>
      )}
      <div className="payment-options">
        <h3>M-Pesa Payment</h3>
        <div className="mpesa-input">
          <label htmlFor="mpesa-number">Enter your M-Pesa phone number:</label>
          <input
            id="mpesa-number"
            type="tel"
            placeholder="07XXXXXXXX"
            value={mpesaNumber}
            onChange={(e) => setMpesaNumber(e.target.value)}
            pattern="^07\d{8}$"
            title="Please enter a valid Kenyan phone number starting with 07 (10 digits total)"
            required
          />
          <small>Format: 07XXXXXXXX (10 digits)</small>
        </div>
      </div>
      <button
        className="checkout-button"
        disabled={
          cartItems.length === 0 ||
          !mpesaNumber ||
          !/^07\d{8}$/.test(mpesaNumber)
        }
        onClick={() => handleCheckout()}
      >
        Pay with M-Pesa
      </button>
    </div>
  );
};

export default Cart;
