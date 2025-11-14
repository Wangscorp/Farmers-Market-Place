import { useState } from "react";
import { toast } from "react-toastify";
import { useCart } from "./CartContext";
import "./Cart.css";

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, getTotalPrice, loading } =
    useCart();
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [selectedItems, setSelectedItems] = useState(new Set());

  const handleItemSelect = (itemId, isSelected) => {
    setSelectedItems((prev) => {
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
      toast.error("Please select items to remove");
      return;
    }

    try {
      const removePromises = Array.from(selectedItems).map((itemId) =>
        removeFromCart(itemId)
      );
      await Promise.all(removePromises);
      setSelectedItems(new Set());
      toast.success(`${selectedItems.size} item(s) removed from cart`);
    } catch {
      toast.error("Failed to remove some items from cart");
    }
  };

  const handleRemoveFromCart = async (itemId) => {
    try {
      await removeFromCart(itemId);
      toast.success("Item removed from cart");
    } catch {
      toast.error("Failed to remove item from cart");
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
      toast.error(errorMessage);
    }
  };

  const getSelectedTotal = () => {
    if (selectedItems.size === 0) {
      return getTotalPrice();
    }
    return cartItems
      .filter((item) => selectedItems.has(item.id))
      .reduce((total, item) => total + item.product.price * item.quantity, 0);
  };

  const handleCheckout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in to checkout");
        return;
      }

      // Enhanced phone number validation for multiple formats
      const phoneRegex = /^(07\d{8}|254\d{9}|\+254\d{9})$/;
      if (!mpesaNumber || !phoneRegex.test(mpesaNumber.replace(/[\s-]/g, ""))) {
        toast.error(
          "Please enter a valid Kenyan M-Pesa number:\n• 07XXXXXXXX\n• 254XXXXXXXXX\n• +254XXXXXXXXX"
        );
        return;
      }

      if (cartItems.length === 0) {
        toast.success("Your cart is empty");
        return;
      }

      const selectedItemIds =
        selectedItems.size > 0 ? Array.from(selectedItems) : null;

      // Round to 2 decimal places to match backend calculation
      const totalAmount = Math.round(getSelectedTotal() * 100) / 100;

      if (totalAmount < 1) {
        toast.error("Minimum payment amount is KSh 1");
        return;
      }

      console.log("💰 Checkout details:", {
        selectedItems: selectedItemIds,
        totalAmount: totalAmount,
        cartItems: cartItems.length,
      });

      // Show loading state
      const checkoutBtn = document.querySelector(".checkout-button");
      checkoutBtn.textContent = "Processing...";
      checkoutBtn.disabled = true;

      const requestPayload = {
        mpesa_number: mpesaNumber.replace(/[\s-]/g, ""), // Clean phone number
        total_amount: totalAmount,
        selected_items: selectedItemIds,
      };

      console.log("🔄 Initiating M-Pesa payment...", requestPayload);

      const response = await fetch("http://localhost:8080/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("✅ Payment initiated:", result);

        // Show success message with clear instructions
        toast.success(
          `🎉 M-Pesa Payment Initiated!\n\n` +
            `📱 Check your phone (${mpesaNumber}) for the M-Pesa prompt\n` +
            `💰 Amount: KSh ${totalAmount.toLocaleString()}\n` +
            `🆔 Transaction ID: ${result.transaction_id}\n\n` +
            `⏰ You have 60 seconds to complete the payment`
        );

        // Clear form after successful initiation
        setMpesaNumber("");

        // Refresh cart after a delay to allow for callback processing
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        console.error("❌ Payment failed:", result);

        // Show specific error message from backend
        const errorMsg = result.message || result.error || "Payment failed";
        toast.error(`❌ Payment Failed\n\n${errorMsg}\n\nPlease try again.`);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(
        "❌ Network Error\n\nUnable to connect to payment service.\nPlease check your internet connection and try again."
      );
    } finally {
      // Reset button state
      const checkoutBtn = document.querySelector(".checkout-button");
      if (checkoutBtn) {
        checkoutBtn.textContent = "Pay with M-Pesa";
        checkoutBtn.disabled = false;
      }
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
              {selectedItems.size > 0 &&
                selectedItems.size < cartItems.length && (
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
            placeholder="07XXXXXXXX or 254XXXXXXXXX"
            value={mpesaNumber}
            onChange={(e) => setMpesaNumber(e.target.value)}
            pattern="^(07\d{8}|254\d{9}|\+254\d{9})$"
            title="Please enter a valid Kenyan M-Pesa number"
            required
          />
          <small>
            Supported formats:
            <br />
            • 07XXXXXXXX
            <br />
            • 254XXXXXXXXX
            <br />• +254XXXXXXXXX
          </small>
        </div>
      </div>
      <button
        className="checkout-button"
        disabled={
          cartItems.length === 0 ||
          !mpesaNumber ||
          !/^(07\d{8}|254\d{9}|\+254\d{9})$/.test(
            mpesaNumber.replace(/[\s-]/g, "")
          ) ||
          getSelectedTotal() < 1
        }
        onClick={() => handleCheckout()}
      >
        Pay with M-Pesa (KSh {getSelectedTotal().toLocaleString()})
      </button>
    </div>
  );
};

export default Cart;
