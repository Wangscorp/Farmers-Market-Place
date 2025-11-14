import { useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import axios from "../api";
import { useUser } from "../hooks/useUser";
import ImageUploadWithResize from "./ImageUploadWithResize";
import "./VendorSetup.css";

const VendorSetup = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [resizedImage, setResizedImage] = useState(null);
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [paymentPreference, setPaymentPreference] = useState("monthly");
  const [loading, setLoading] = useState(false);

  // Redirect non-vendors
  if (user && user.role !== "Vendor") {
    navigate("/");
    return null;
  }

  const handleImageResize = (uri) => {
    setResizedImage(uri);
  };

  const handleComplete = async () => {
    // Validate M-Pesa number
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

    if (!resizedImage) {
      toast.error("Please upload a profile image for verification");
      return;
    }

    setLoading(true);

    try {
      // Update profile image first
      await axios.patch("/profile/image", {
        profile_image: resizedImage,
      });

      // Then update profile with M-Pesa and payment preference
      await axios.patch("/profile", {
        username: user.username,
        email: user.email,
        mpesa_number: mpesaNumber,
        payment_preference: paymentPreference,
      });

      toast.success(
        "Setup complete! Your profile has been updated. Please wait for admin verification."
      );
      navigate("/vendor");
    } catch (error) {
      const errorMessage =
        error.response?.data || error.message || "Unknown error";
      toast.error("Failed to complete setup: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/vendor");
  };

  return (
    <div className="vendor-setup">
      <div className="setup-container">
        <h2>Welcome to Farmers Market Place! 🎉</h2>
        <p className="setup-intro">
          Complete your vendor profile to get started. These details are
          required for:
        </p>
        <ul className="setup-benefits">
          <li>✓ Verification by admin team</li>
          <li>✓ Payment processing through M-Pesa</li>
          <li>✓ Building trust with customers</li>
        </ul>

        <div className="setup-form">
          <div className="form-section">
            <h3>Profile Image</h3>
            <p className="section-description">
              Upload a clear profile image. This will be used for verification.
            </p>
            <ImageUploadWithResize onImageResize={handleImageResize} />
            {resizedImage && (
              <div className="image-preview">
                <p>✓ Image selected</p>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3>M-Pesa Number</h3>
            <p className="section-description">
              Enter your M-Pesa number for payment processing (format:
              07XXXXXXXX, 011XXXXXXXX, or +254XXXXXXXXX)
            </p>
            <input
              type="tel"
              placeholder="07XXXXXXXX or +254XXXXXXXXX"
              value={mpesaNumber}
              onChange={(e) => setMpesaNumber(e.target.value)}
              title="Enter a valid M-Pesa number: 07XXXXXXXX, 011XXXXXXXX, or +254XXXXXXXXX"
            />
          </div>

          <div className="form-section">
            <h3>Payment Preference</h3>
            <p className="section-description">
              Choose when you'd like to receive payments
            </p>
            <select
              value={paymentPreference}
              onChange={(e) => setPaymentPreference(e.target.value)}
            >
              <option value="after_order">After Each Order</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="setup-actions">
            <button
              onClick={handleComplete}
              disabled={loading}
              className="btn-complete"
            >
              {loading ? "Completing..." : "Complete Setup"}
            </button>
            <button
              onClick={handleSkip}
              disabled={loading}
              className="btn-skip"
            >
              Skip for Now
            </button>
          </div>

          <p className="setup-note">
            Note: You can update these details later in your vendor dashboard.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorSetup;
