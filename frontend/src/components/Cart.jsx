import { useState } from 'react';
import { useCart } from './CartContext';
import './Cart.css';

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, getTotalPrice, loading } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('');

  const handleRemoveFromCart = async (itemId) => {
    try {
      await removeFromCart(itemId);
      alert('Item removed from cart');
    } catch {
      alert('Failed to remove item from cart');
    }
  };

  const handleQuantityChange = async (itemId, newQuantity) => {
    try {
      await updateQuantity(itemId, newQuantity);
    } catch {
      alert('Failed to update quantity');
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
          {cartItems.map(item => (
            <div key={item.id} className="cart-item">
              {item.product.image && <img src={`data:image/jpeg;base64,${item.product.image}`} alt={item.product.name} className="cart-item-image" />}
              <div className="cart-item-info">
                <p><strong>{item.product.name}</strong></p>
                <p>{item.product.description}</p>
              </div>
              <div className="cart-item-controls">
                <div className="quantity-controls">
                  <button onClick={() => handleQuantityChange(item.id, item.quantity - 1)}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)}>+</button>
                </div>
                <p className="item-price">KSh {(item.product.price * item.quantity).toLocaleString()}</p>
                <button className="remove-button" onClick={() => handleRemoveFromCart(item.id)}>Remove</button>
              </div>
            </div>
          ))}
          <div className="cart-total">
            <h3>Total: KSh {getTotalPrice().toLocaleString()}</h3>
          </div>
        </div>
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
