import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "../api";
import ImageUploadWithResize from "./ImageUploadWithResize";
import VerificationUpload from "./VerificationUpload";
import SalesReport from "./SalesReport";
import { useUser } from "../hooks/useUser";
import "./VendorDashboard.css";

const VendorDashboard = () => {
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [resizedImage, setResizedImage] = useState(null);
  const [maxWidth, setMaxWidth] = useState(800);
  const [maxHeight, setMaxHeight] = useState(600);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [reportCountLoaded, setReportCountLoaded] = useState(false);
  const [mpesaNumber, setMpesaNumber] = useState(user?.mpesa_number || "");
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [showSalesReport, setShowSalesReport] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");

  useEffect(() => {
    if (user && user.role === "Vendor" && user.verified) {
      fetchReportCount();
      fetchProducts();
      fetchWalletBalance();
    }
  }, [user]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get("/products");
      setProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchReportCount = async () => {
    try {
      const response = await axios.get("/vendor/reports/count");
      setReportCount(response.data.report_count);
      setReportCountLoaded(true);
    } catch (error) {
      console.error("Error fetching report count:", error);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const response = await axios.get("/wallet/balance");
      setWalletBalance(response.data.balance);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 10) {
      toast.error("Minimum withdrawal amount is KSh 10");
      return;
    }

    if (amount > walletBalance) {
      toast.error("Insufficient balance");
      return;
    }

    if (!withdrawPhone.match(/^(254|0)\d{9}$/)) {
      toast.error("Please enter a valid Kenyan phone number");
      return;
    }

    try {
      const response = await axios.post("/wallet/withdraw", {
        amount,
        mpesa_number: withdrawPhone.startsWith("0")
          ? "254" + withdrawPhone.slice(1)
          : withdrawPhone,
      });

      toast.success(response.data.message);
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setWithdrawPhone("");
      fetchWalletBalance();
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      toast.error(error.response?.data?.error || "Failed to withdraw funds");
    }
  };

  const handleImageResize = (uri) => {
    setResizedImage(uri);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if image is required for new products
    if (!editingProduct && !resizedImage) {
      toast.error("Please upload a product image before submitting.");
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
          quantity: parseInt(quantity),
          image: resizedImage,
        });
        toast.success("Product updated successfully!");
      } else {
        // Create new product
        await axios.post("/products", {
          name,
          price: parseFloat(price),
          category,
          description,
          quantity: parseInt(quantity),
          image: resizedImage,
        });
        toast.success("Product created successfully!");
      }

      // Reset form
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      let errorMessage = "Error saving product";

      if (error.response) {
        // Server responded with error status
        if (error.response.status === 413) {
          errorMessage =
            "Image file is too large. Please select a smaller image.";
        } else if (error.response.status === 422) {
          errorMessage = "Invalid product data. Please check your input.";
        } else if (
          error.response.data &&
          typeof error.response.data === "string"
        ) {
          errorMessage = error.response.data;
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else {
          errorMessage = `Server error (${error.response.status}): ${error.response.data}`;
        }
      } else if (error.request) {
        // Network error
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else {
        // Other error
        errorMessage = "An unexpected error occurred: " + error.message;
      }

      toast.success(errorMessage);
    }
  };

  const resetForm = () => {
    setName("");
    setPrice("");
    setCategory("");
    setDescription("");
    setQuantity("");
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
    setQuantity(product.quantity.toString());
    setResizedImage(product.image);
    setShowForm(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await axios.delete(`/products/${productId}`);
      toast.success("Product deleted successfully!");
      fetchProducts();
    } catch (error) {
      toast.success(
        "Error deleting product: " + (error.response?.data || error.message)
      );
    }
  };

  const handleUpdatePhoneNumber = async () => {
    if (!user) {
      toast.error("You must be logged in to update your phone number");
      return;
    }

    if (!mpesaNumber.trim()) {
      toast.error("Please enter your M-Pesa number for payment processing");
      return;
    }

    if (!/^(07\d{8}|011\d{7,8}|\+254\d{9})$/.test(mpesaNumber)) {
      toast.success(
        "Please enter a valid M-Pesa number (07XXXXXXXX, 011XXXXXXXX, or +254XXXXXXXXX)"
      );
      return;
    }

    try {
      await axios.patch("/profile", {
        username: user.username,
        email: user.email,
        mpesa_number: mpesaNumber,
      });
      toast.success("Phone number updated successfully!");
      setShowPhoneForm(false);
    } catch (error) {
      console.error("Error updating phone number:", error);
      const errorMessage =
        error.response?.data ||
        (error.message === "Network Error"
          ? "Network error - please check your connection"
          : error.message) ||
        "Unknown error occurred";
      toast.error("Failed to update phone number: " + errorMessage);
    }
  };

  // Only allow vendors to access this dashboard
  if (!user) {
    return (
      <div className="access-denied">
        Please log in to access the Vendor Dashboard.
      </div>
    );
  }

  if (user.role !== "Vendor") {
    return (
      <div className="access-denied">
        Access denied. Vendor privileges required.
      </div>
    );
  }

  // Check if vendor is verified
  if (!user.verified) {
    return (
      <div className="vendor-dashboard">
        <div className="dashboard-header">
          <h2>Vendor Dashboard</h2>
          <p className="verification-status unverified">
            ⚠ Your account is pending verification. Only verified vendors can
            manage products.
          </p>
          <p>
            <strong>Verification Process:</strong> Admin must verify your
            profile image to ensure it's a genuine human photo. This helps
            maintain trust and security in the marketplace. You'll be notified
            once your account is verified.
          </p>
          {user.profile_image && (
            <div style={{ marginTop: "1rem" }}>
              <p>Your submitted profile image is under review:</p>
              <img
                src={user.profile_image}
                alt="Profile under review"
                style={{
                  maxWidth: "150px",
                  maxHeight: "150px",
                  borderRadius: "50%",
                  border: "3px solid orange",
                  marginTop: "0.5rem",
                }}
              />
            </div>
          )}
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
            ⚠ Account suspended due to {reportCount} customer reports. Vendors
            with 5+ reports cannot manage products.
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

        {/* Wallet Section */}
        <div className="wallet-card">
          <div className="wallet-header">
            <h3>💰 Wallet Balance</h3>
            <div className="wallet-balance">
              KSh{" "}
              {walletBalance.toLocaleString("en-KE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <button
            className="withdraw-btn"
            onClick={() => {
              setWithdrawPhone(mpesaNumber || "");
              setShowWithdrawModal(true);
            }}
            disabled={walletBalance < 10}
          >
            Withdraw to M-Pesa
          </button>
          {walletBalance < 10 && (
            <p className="wallet-note">Minimum withdrawal: KSh 10</p>
          )}
        </div>

        <p
          className={`verification-status ${
            user?.verified ? "verified" : "unverified"
          }`}
        >
          Account Status:{" "}
          {user?.verified ? "✓ Verified" : "⚠ Pending Verification"}
        </p>
      </div>

      {/* Verification Upload Section - Only show if not verified */}
      {!user?.verified && <VerificationUpload />}

      <div className="dashboard-actions">
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Hide Form" : "+ Add New Product"}
        </button>
        <button
          className="btn-analytics"
          onClick={() => setShowSalesReport(!showSalesReport)}
        >
          {showSalesReport ? "Hide Sales Report" : "View Sales Report"}
        </button>
        <button
          className="btn-secondary"
          onClick={() => setShowPhoneForm(!showPhoneForm)}
        >
          {showPhoneForm ? "Hide Phone Settings" : "Update Phone Number"}
        </button>
      </div>

      {showSalesReport && <SalesReport />}

      {showPhoneForm && (
        <div className="phone-form-container">
          <h3>Update Phone Number</h3>
          <p>Update your M-Pesa number for payment processing:</p>
          <div className="form-group">
            <label htmlFor="mpesaNumber">M-Pesa Number *</label>
            <input
              id="mpesaNumber"
              type="tel"
              placeholder="07XXXXXXXX or +254XXXXXXXXX"
              value={mpesaNumber}
              onChange={(e) => setMpesaNumber(e.target.value)}
              title="Enter a valid M-Pesa number: 07XXXXXXXX, 011XXXXXXXX, or +254XXXXXXXXX"
              required
            />
            <p className="info-text">
              Current: {user?.mpesa_number || "Not set"}
            </p>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleUpdatePhoneNumber}
            >
              Update Phone Number
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowPhoneForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="product-form-container">
          <h3>{editingProduct ? "Edit Product" : "Add New Product"}</h3>
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
              <label htmlFor="quantity">Quantity Available *</label>
              <input
                id="quantity"
                type="number"
                placeholder="e.g., 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
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
              <label>Product Image *</label>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#666",
                  marginBottom: "10px",
                }}
              >
                Upload a high-quality image of your product. It will be
                automatically resized and optimized.
              </p>
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
                {editingProduct ? "Update Product" : "Create Product"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
              >
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
                  <p className="product-price">
                    KSH {product.price.toFixed(2)}
                  </p>
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

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowWithdrawModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Withdraw to M-Pesa</h3>
            <form onSubmit={handleWithdrawSubmit}>
              <div className="form-group">
                <label>Available Balance:</label>
                <div className="balance-display">
                  KSh{" "}
                  {walletBalance.toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="withdraw-amount">
                  Amount to Withdraw (KSh):
                </label>
                <input
                  id="withdraw-amount"
                  type="number"
                  min="10"
                  max={walletBalance}
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount (minimum KSh 10)"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="withdraw-phone">M-Pesa Phone Number:</label>
                <input
                  id="withdraw-phone"
                  type="text"
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  placeholder="254712345678 or 0712345678"
                  pattern="(254|0)\d{9}"
                  required
                />
                <small>Enter your M-Pesa registered phone number</small>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  Confirm Withdrawal
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowWithdrawModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDashboard;
