import { useState } from "react";
import { useCart } from "./CartContext";
import "./Cart.css";

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, getTotalPrice, loading } =
    useCart();
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mpesa"); // "mpesa" or "delivery"

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
      await updateQuantity(itemId, newQuantity);
    } catch {
      alert("Failed to update quantity");
    }
  };

  const handleCheckout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please log in to checkout");
        return;
      }

      const response = await fetch("http://localhost:8080/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mpesa_number: mpesaNumber,
          total_amount: getTotalPrice(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `Payment initiated! Check your phone for M-Pesa prompt. Transaction ID: ${result.transaction_id}`
        );
        // Clear cart after successful payment initiation
        // Note: In a real app, you'd wait for payment confirmation
        window.location.reload(); // Simple way to refresh and clear cart
      } else {
        const error = await response.json();
        alert(`Payment failed: ${error.message || "Unknown error"}`);
      }
    } catch {
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
              {item.product.image && (
                <img
                  src={`data:image/jpeg;base64,${item.product.image}`}
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
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity + 1)
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
          <div className="cart-total">
            <h3>Total: KSh {getTotalPrice().toLocaleString()}</h3>
          </div>
        </div>
      )}
      <div className="payment-options">
        <h3>Choose Payment Method</h3>
        <div className="payment-methods">
          <div
            className={`payment-method ${paymentMethod === "mpesa" ? "selected" : ""}`}
            onClick={() => setPaymentMethod("mpesa")}
          >
            <div className="payment-icon">💳</div>
            <div className="payment-details">
              <h4>Pay Now</h4>
              <p>M-Pesa</p>
            </div>
          </div>
          <div
            className={`payment-method ${paymentMethod === "delivery" ? "selected" : ""}`}
            onClick={() => setPaymentMethod("delivery")}
          >
            <div className="payment-icon">🚚</div>
            <div className="payment-details">
              <h4>Pay on Delivery</h4>
              <p>Cash on delivery</p>
            </div>
          </div>
        </div>
        {paymentMethod === "mpesa" && (
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
        )}
      </div>
      {paymentMethod === "mpesa" ? (
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
      ) : (
        <button
          className="checkout-button"
          disabled={cartItems.length === 0}
          onClick={() => alert("Order placed! Please pay on delivery.")}
        >
          Pay on Delivery
        </button>
      )}
    </div>
  );
};

export default Cart;
