import { useState } from 'react';
import './Cart.css';

const Cart = () => {
  const [cartItems] = useState([]); // In real app, get from global state or context
  const [paymentMethod, setPaymentMethod] = useState('');

  return (
    <div className="cart">
      <h2>Your Cart</h2>
      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        cartItems.map(item => (
          <div key={item.id} className="cart-item">
            <p>{item.name} - ${item.price}</p>
            <button>Remove</button>
          </div>
        ))
      )}
      <div className="payment-options">
        <label>Select Payment Method:</label>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="">Select...</option>
          <option value="Mpesa">Mpesa</option>
          <option value="PayPal">PayPal</option>
          <option value="Binance">Binance</option>
        </select>
      </div>
      <button className="checkout-button" disabled={cartItems.length === 0 || !paymentMethod} onClick={() => alert(`Checkout with ${paymentMethod}`)}>Checkout</button>
    </div>
  );
};

export default Cart;
