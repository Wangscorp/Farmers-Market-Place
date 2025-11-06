import { useState, useEffect } from "react";
import axios from "../api";
import { useUser } from "../hooks/useUser";
import ImageUploadWithResize from "./ImageUploadWithResize";
import "./VendorProfile.css";

const VendorProfile = () => {
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [resizedImage, setResizedImage] = useState(null);
  const [secondaryEmail, setSecondaryEmail] = useState(
    user?.secondary_email || ""
  );
  const [mpesaNumber, setMpesaNumber] = useState(user?.mpesa_number || "");
  const [paymentPreference, setPaymentPreference] = useState(
    user?.payment_preference || "monthly"
  );

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get("/products"); // API already filters to vendor's own products
        setProducts(response.data);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    if (user) {
      fetchProducts();
    }
  }, [user]);

  const handleImageResize = (uri) => {
    setResizedImage(uri);
  };

  const handleUpdateProfileImage = async () => {
    if (!user) {
      alert("You must be logged in to update your profile image");
      return;
    }

    if (!resizedImage) {
      alert("Please select an image first");
      return;
    }
    try {
      await axios.patch("/profile/image", {
        profile_image: resizedImage,
      });
      alert(
        "Profile image updated successfully! Please wait for admin verification."
      );
      setResizedImage(null); // Reset after successful upload
    } catch (error) {
      console.error("Error updating profile image:", error);
      const errorMessage =
        error.response?.data || error.message || "Unknown error";
      alert("Failed to update profile image: " + errorMessage);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) {
      alert("You must be logged in to update your profile");
      return;
    }

    if (!secondaryEmail.trim() && secondaryEmail) {
      alert("Please enter a valid secondary email");
      return;
    }

    if (secondaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secondaryEmail)) {
      alert("Please enter a valid secondary email format");
      return;
    }

    if (!mpesaNumber.trim()) {
      alert("Please enter your M-Pesa number for payment processing");
      return;
    }

    if (!/^(07\d{8}|011\d{7,8}|\+254\d{9})$/.test(mpesaNumber)) {
      alert(
        "Please enter a valid M-Pesa number (07XXXXXXXX, 011XXXXXXXX, or +254XXXXXXXXX)"
      );
      return;
    }

    try {
      const token = localStorage.getItem("token");
      console.log("[VendorProfile] Token exists:", !!token);

      const payload = {
        username: user.username,
        email: user.email,
        mpesa_number: mpesaNumber,
        payment_preference: paymentPreference,
      };

      // Only add secondary_email if it's not empty
      if (secondaryEmail.trim()) {
        payload.secondary_email = secondaryEmail;
      }

      console.log("[VendorProfile] Sending payload:", payload);

      const response = await axios.patch("/profile", payload);
      alert(response.data.message || "Profile updated successfully");
    } catch (error) {
      console.error("[VendorProfile] Update error:", error);
      const errorMessage =
        error.response?.data ||
        (error.message === "Network Error"
          ? "Network error - please check your connection"
          : error.message) ||
        "Unknown error occurred";
      alert("Failed to update profile: " + errorMessage);
    }
  };

  return (
    <div className="vendor-profile">
      <h2>Vendor Dashboard</h2>
      <p>Account Verified: {user?.verified ? "Yes" : "No"}</p>

      {!user?.verified && (
        <>
          <h3>Profile Image Verification</h3>
          <p>Upload your profile image to get verified as a vendor:</p>
          <ImageUploadWithResize onImageResize={handleImageResize} />
          <button onClick={handleUpdateProfileImage}>
            Update Profile Image
          </button>
        </>
      )}

      <h3>Edit Profile Information</h3>
      <p>Update your payment details and add a secondary email:</p>
      <div className="profile-edit-form">
        <div className="form-group-readonly">
          <label>Username:</label>
          <input
            type="text"
            value={user?.username || ""}
            readOnly
            className="readonly-input"
          />
          <p className="info-text">Username cannot be changed</p>
        </div>

        <div className="form-group-readonly">
          <label>Primary Email:</label>
          <input
            type="email"
            value={user?.email || ""}
            readOnly
            className="readonly-input"
          />
          <p className="info-text">Primary email cannot be changed</p>
        </div>

        <input
          type="email"
          placeholder="Secondary Email (optional)"
          value={secondaryEmail}
          onChange={(e) => setSecondaryEmail(e.target.value)}
        />

        <input
          type="tel"
          placeholder="M-Pesa Number (07XXXXXXXX, 011XXXXXXXX, or +254XXXXXXXXX)"
          value={mpesaNumber}
          onChange={(e) => setMpesaNumber(e.target.value)}
          title="Enter a valid M-Pesa number: 07XXXXXXXX, 011XXXXXXXX, or +254XXXXXXXXX"
          required
        />
        <div className="form-group">
          <label>Payment Preference:</label>
          <select
            value={paymentPreference}
            onChange={(e) => setPaymentPreference(e.target.value)}
            required
          >
            <option value="after_order">Pay After Each Order</option>
            <option value="monthly">Monthly Payment</option>
          </select>
        </div>
        <button onClick={handleUpdateProfile}>
          Update Profile Information
        </button>
      </div>

      <h3>Your Listed Products</h3>
      {products.length === 0 ? (
        <p>You haven't listed any products yet.</p>
      ) : (
        <div className="vendor-products-list">
          {products.map((product) => (
            <div key={product.id} className="vendor-product-item">
              {product.image && (
                <img
                  src={product.image}
                  alt={product.name}
                  className="vendor-product-image"
                />
              )}
              <div className="vendor-product-details">
                <h4>{product.name}</h4>
                <p>{product.description}</p>
                <p>Price: KSh {product.price.toLocaleString()}</p>
                <p>Category: {product.category}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorProfile;
