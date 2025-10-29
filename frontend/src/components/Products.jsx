import { useState, useEffect } from 'react';
import axios from '../api';
import { useCart } from './CartContext';
import { useUser } from './UserContext';
import './Products.css';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [showReportForm, setShowReportForm] = useState(null);
  const [reportType, setReportType] = useState('non_delivery');
  const [reportDescription, setReportDescription] = useState('');
  const { addToCart } = useCart();
  const { user } = useUser();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('/products');
        setProducts(response.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = async (product) => {
    try {
      await addToCart(product);
      alert('Item added to cart!');
    } catch {
      alert('Failed to add item to cart');
    }
  };

  const handleSubmitReport = async (product) => {
    if (!user) {
      alert('Please login to submit a report');
      return;
    }

    if (!reportDescription.trim()) {
      alert('Please provide a description for the report');
      return;
    }

    try {
      await axios.post('/reports', {
        vendor_id: product.vendor_id,
        product_id: product.id,
        report_type: reportType,
        description: reportDescription.trim()
      });

      alert('Report submitted successfully. Admin will review it shortly.');
      setShowReportForm(null);
      setReportType('non_delivery');
      setReportDescription('');
    } catch (error) {
      alert('Failed to submit report. Please try again.');
      console.error('Report submission error:', error);
    }
  };

  return (
    <div>
      <h2>Available Products</h2>
      <div className="products-list">
        {products.map(product => (
          <div key={product.id} className="product-item">
            {product.image && <img src={`data:image/jpeg;base64,${product.image}`} alt={product.name} className="product-image" />}
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <p>Price: KSh {product.price.toLocaleString()}</p>
            <p>Category: {product.category}</p>
            <div className="product-actions">
              <button onClick={() => handleAddToCart(product)}>Add to Cart</button>
              {user && user.role === 'Customer' && (
                <button
                  onClick={() => setShowReportForm(showReportForm === product.id ? null : product.id)}
                  className="report-btn"
                >
                  Report Vendor
                </button>
              )}
            </div>

            {showReportForm === product.id && (
              <div className="report-form">
                <h4>Report Issue with this Product/Vendor</h4>
                <div className="form-group">
                  <label>Report Type:</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option value="non_delivery">Non-delivery/Failed Delivery</option>
                    <option value="wrong_product">Wrong Product Sent</option>
                    <option value="damaged_product">Damaged Product</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Description:</label>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Please describe the issue in detail..."
                    rows="3"
                  />
                </div>
                <div className="form-actions">
                  <button onClick={() => handleSubmitReport(product)}>Submit Report</button>
                  <button onClick={() => setShowReportForm(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Products;
