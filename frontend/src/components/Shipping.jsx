import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "../api";
import { useUser } from "../hooks/useUser";
import "./Shipping.css";

const Shipping = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("orders");
  const [shippingOrders, setShippingOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: "",
  });
  const [showReportForm, setShowReportForm] = useState(null);
  const [reportType, setReportType] = useState("non_delivery");
  const [reportDescription, setReportDescription] = useState("");

  useEffect(() => {
    if (user) {
      loadShippingOrders();
      loadReviews();
    }
  }, [user]);

  const loadShippingOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/shipping");
      setShippingOrders(response.data);
    } catch (error) {
      console.error("Error loading shipping orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await axios.get("/reviews");
      setReviews(response.data);
    } catch (error) {
      console.error("Error loading reviews:", error);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      await axios.post("/reviews", {
        product_id: selectedOrder.product_id,
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || null,
      });

      toast.success("Review submitted successfully!");
      setSelectedOrder(null);
      setReviewForm({ rating: 5, comment: "" });
      loadReviews();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.success("Failed to submit review. Please try again.");
    }
  };

  const handleVerifyDelivery = async (orderId, verified) => {
    try {
      await axios.post(`/shipping/${orderId}/verify`, { verified });

      if (verified) {
        toast.success(
          "Delivery verified! Payment has been released to the vendor."
        );
      } else {
        toast.info(
          "Delivery issue reported. Our support team will contact you shortly."
        );
      }

      loadShippingOrders();
    } catch (error) {
      console.error("Error verifying delivery:", error);
      toast.error("Failed to verify delivery. Please try again.");
    }
  };

  const handleReportSubmit = async (order) => {
    if (!user) {
      toast.error("Please login to submit a report");
      return;
    }

    if (!reportDescription.trim()) {
      toast.error("Please provide a description for the report");
      return;
    }

    try {
      await axios.post("/reports", {
        vendor_id: order.vendor_id,
        product_id: order.product_id,
        report_type: reportType,
        description: reportDescription.trim(),
      });

      toast.success(
        "Report submitted successfully. Admin will review it shortly."
      );
      setShowReportForm(null);
      setReportType("non_delivery");
      setReportDescription("");
    } catch (error) {
      toast.error("Failed to submit report. Please try again.");
      console.error("Report submission error:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "#ffc107";
      case "shipped":
        return "#17a2b8";
      case "delivered":
        return "#28a745";
      case "cancelled":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? "star filled" : "star"}>
        ★
      </span>
    ));
  };

  if (!user) {
    return <div>Please log in to access your shipping information.</div>;
  }

  return (
    <div className="shipping-page">
      <h1>Shipping & Reviews</h1>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          My Orders
        </button>
        <button
          className={`tab-button ${activeTab === "reviews" ? "active" : ""}`}
          onClick={() => setActiveTab("reviews")}
        >
          My Reviews
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "orders" && (
          <div className="orders-section">
            <h2>My Shipping Orders</h2>
            {loading ? (
              <p>Loading orders...</p>
            ) : shippingOrders.length === 0 ? (
              <p>You haven't placed any orders yet.</p>
            ) : (
              <div className="orders-list">
                {shippingOrders.map((order) => (
                  <div key={order.id} className="order-card">
                    <div className="order-header">
                      <h3>{order.product_name}</h3>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: getStatusColor(
                            order.shipping_status
                          ),
                        }}
                      >
                        {order.shipping_status}
                      </span>
                    </div>

                    <div className="order-details">
                      <p>
                        <strong>Vendor:</strong> {order.vendor_username}
                      </p>
                      <p>
                        <strong>Quantity:</strong> {order.quantity}
                      </p>
                      <p>
                        <strong>Total:</strong> KSh{" "}
                        {order.total_amount.toLocaleString()}
                      </p>
                      <p>
                        <strong>Address:</strong> {order.shipping_address}
                      </p>
                      {order.tracking_number && (
                        <p>
                          <strong>Tracking:</strong> {order.tracking_number}
                        </p>
                      )}
                      <p>
                        <strong>Ordered:</strong>{" "}
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Delivery Verification Alert */}
                    {order.shipping_status === "delivered" &&
                      order.verification_requested_at &&
                      !order.customer_verified && (
                        <div className="verification-alert">
                          <p>
                            ⚠️ Please verify if you have received this order.
                            Payment will be released to the vendor once you
                            confirm.
                          </p>
                          <div className="verification-actions">
                            <button
                              className="verify-yes-btn"
                              onClick={() =>
                                handleVerifyDelivery(order.id, true)
                              }
                            >
                              ✓ Yes, I received it
                            </button>
                            <button
                              className="verify-no-btn"
                              onClick={() =>
                                handleVerifyDelivery(order.id, false)
                              }
                            >
                              ✗ No, I didn't receive it
                            </button>
                          </div>
                        </div>
                      )}

                    {order.customer_verified && order.payment_released && (
                      <div className="verification-confirmed">
                        ✓ Delivery verified. Payment released to vendor.
                      </div>
                    )}

                    <div className="order-actions">
                      {order.shipping_status === "delivered" && (
                        <button
                          className="review-btn"
                          onClick={() => setSelectedOrder(order)}
                        >
                          Leave Review
                        </button>
                      )}

                      <button
                        className="report-btn"
                        onClick={() =>
                          setShowReportForm(
                            showReportForm === order.id ? null : order.id
                          )
                        }
                      >
                        Report Vendor
                      </button>
                    </div>

                    {showReportForm === order.id && (
                      <div className="report-form">
                        <h4>Report Issue with this Order/Vendor</h4>
                        <div className="form-group">
                          <label>Report Type:</label>
                          <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                          >
                            <option value="non_delivery">
                              Non-delivery/Failed Delivery
                            </option>
                            <option value="wrong_product">
                              Wrong Product Sent
                            </option>
                            <option value="damaged_product">
                              Damaged Product
                            </option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Description:</label>
                          <textarea
                            value={reportDescription}
                            onChange={(e) =>
                              setReportDescription(e.target.value)
                            }
                            placeholder="Please describe the issue in detail..."
                            rows="3"
                          />
                        </div>
                        <div className="form-actions">
                          <button onClick={() => handleReportSubmit(order)}>
                            Submit Report
                          </button>
                          <button onClick={() => setShowReportForm(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="reviews-section">
            <h2>My Reviews</h2>
            {reviews.length === 0 ? (
              <p>You haven't written any reviews yet.</p>
            ) : (
              <div className="reviews-list">
                {reviews.map((review) => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <h3>{review.product_name}</h3>
                      <div className="rating">{renderStars(review.rating)}</div>
                    </div>
                    {review.comment && (
                      <p className="review-comment">"{review.comment}"</p>
                    )}
                    <p className="review-date">
                      Reviewed on{" "}
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Leave a Review</h2>
            <p>
              <strong>Product:</strong> {selectedOrder.product_name}
            </p>
            <p>
              <strong>Vendor:</strong> {selectedOrder.vendor_username}
            </p>

            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label>Rating:</label>
                <div className="rating-input">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${
                        reviewForm.rating >= star ? "filled" : ""
                      }`}
                      onClick={() =>
                        setReviewForm({ ...reviewForm, rating: star })
                      }
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Comment (optional):</label>
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, comment: e.target.value })
                  }
                  placeholder="Share your experience with this product..."
                  rows="4"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setSelectedOrder(null)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipping;
