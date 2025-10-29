import { useState, useEffect } from 'react';
import axios from '../api';
import ImageUploadWithResize from './ImageUploadWithResize';
import { useUser } from './UserContext';
import './VendorDashboard.css';

const VendorDashboard = () => {
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [resizedImage, setResizedImage] = useState(null);
  const [maxWidth, setMaxWidth] = useState(800);
  const [maxHeight, setMaxHeight] = useState(600);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [reportCountLoaded, setReportCountLoaded] = useState(false);

  useEffect(() => {
    if (user && user.role === 'Vendor' && user.verified) {
      fetchReportCount();
      fetchProducts();
    }
  }, [user]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchReportCount = async () => {
    try {
      const response = await axios.get('/vendor/reports/count');
      setReportCount(response.data.report_count);
      setReportCountLoaded(true);
    } catch (error) {
      console.error('Error fetching report count:', error);
    }
  };

  const handleImageResize = (uri) => {
    setResizedImage(uri);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if image is required for new products
    if (!editingProduct && !resizedImage) {
      alert('Please upload a product image before submitting.');
      return;
    }

    try {
      if (editingProduct) {
        // Update existing product
        await axios.patch(`/products/${editingProduct.id}`, {
          name,
          price: parseFloat(price),
          category,
          description,
          image: resizedImage,
        });
        alert('Product updated successfully!');
      } else {
        // Create new product
        await axios.post('/products', {
          name,
          price: parseFloat(price),
          category,
          description,
          image: resizedImage,
        });
        alert('Product created successfully!');
      }

      // Reset form
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      let errorMessage = 'Error saving product';

      if (error.response) {
        // Server responded with error status
        if (error.response.status === 413) {
          errorMessage = 'Image file is too large. Please select a smaller image.';
        } else if (error.response.status === 422) {
          errorMessage = 'Invalid product data. Please check your input.';
        } else if (error.response.data && typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else {
          errorMessage = `Server error (${error.response.status}): ${error.response.data}`;
        }
      } else if (error.request) {
        // Network error
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        // Other error
        errorMessage = 'An unexpected error occurred: ' + error.message;
      }

      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setCategory('');
    setDescription('');
    setResizedImage(null);
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setName(product.name);
    setPrice(product.price.toString());
    setCategory(product.category);
    setDescription(product.description);
    setResizedImage(product.image);
    setShowForm(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }
    
    try {
      await axios.delete(`/products/${productId}`);
      alert('Product deleted successfully!');
      fetchProducts();
    } catch (error) {
      alert('Error deleting product: ' + (error.response?.data || error.message));
    }
  };

  // Only allow vendors to access this dashboard
  if (!user) {
    return <div className="access-denied">Please log in to access the Vendor Dashboard.</div>;
  }

  if (user.role !== 'Vendor') {
    return <div className="access-denied">Access denied. Vendor privileges required.</div>;
  }

  // Check if vendor is verified
  if (!user.verified) {
    return (
      <div className="vendor-dashboard">
        <div className="dashboard-header">
          <h2>Vendor Dashboard</h2>
          <p className="verification-status unverified">
            ⚠ Your account is pending verification. Only verified vendors can manage products.
          </p>
          <p>Please contact an administrator to verify your account.</p>
        </div>
      </div>
    );
  }

  // Check if vendor has too many reports
  if (reportCountLoaded && reportCount >= 5) {
    return (
      <div className="vendor-dashboard">
        <div className="dashboard-header">
          <h2>Vendor Dashboard</h2>
          <p className="verification-status verified">
            ✓ Account Status: Verified
          </p>
          <p className="verification-status unverified">
            ⚠ Account suspended due to {reportCount} customer reports. Vendors with 5+ reports cannot manage products.
          </p>
          <p>Please contact an administrator regarding your account status.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-dashboard">
      <div className="dashboard-header">
        <h2>Vendor Dashboard</h2>
        <p className={`verification-status ${user?.verified ? 'verified' : 'unverified'}`}>
          Account Status: {user?.verified ? "✓ Verified" : "⚠ Pending Verification"}
        </p>
      </div>

      <div className="dashboard-actions">
        <button 
          className="btn-primary" 
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Hide Form' : '+ Add New Product'}
        </button>
      </div>

      {showForm && (
        <div className="product-form-container">
          <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
          <form onSubmit={handleSubmit} className="product-form">
            <div className="form-group">
              <label htmlFor="name">Product Name *</label>
              <input
                id="name"
                type="text"
                placeholder="e.g., Fresh Tomatoes"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">Price (KSH) *</label>
              <input
                id="price"
                type="number"
                placeholder="e.g., 150.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <input
                id="category"
                type="text"
                placeholder="e.g., Vegetables, Fruits, Dairy"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                placeholder="Describe your product..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="4"
                required
              />
            </div>

            <div className="image-settings">
              <div className="form-group">
                <label htmlFor="maxWidth">Max Width (px)</label>
                <input
                  id="maxWidth"
                  type="number"
                  value={maxWidth}
                  onChange={(e) => setMaxWidth(e.target.value)}
                  min="100"
                  max="2000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="maxHeight">Max Height (px)</label>
                <input
                  id="maxHeight"
                  type="number"
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(e.target.value)}
                  min="100"
                  max="2000"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Product Image</label>
              <ImageUploadWithResize 
                maxWidth={maxWidth} 
                maxHeight={maxHeight} 
                onImageResize={handleImageResize} 
              />
              {resizedImage && (
                <div className="image-preview">
                  <img src={resizedImage} alt="Preview" />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingProduct ? 'Update Product' : 'Create Product'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="products-list">
        <h3>My Products ({products.length})</h3>
        {products.length === 0 ? (
          <div className="empty-state">
            <p>No products yet. Add your first product to get started!</p>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                {product.image && (
                  <div className="product-image">
                    <img src={product.image} alt={product.name} />
                  </div>
                )}
                <div className="product-details">
                  <h4>{product.name}</h4>
                  <p className="product-price">KSH {product.price.toFixed(2)}</p>
                  <p className="product-category">{product.category}</p>
                  <p className="product-description">{product.description}</p>
                </div>
                <div className="product-actions">
                  <button 
                    className="btn-edit" 
                    onClick={() => handleEdit(product)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn-delete" 
                    onClick={() => handleDelete(product.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorDashboard;
