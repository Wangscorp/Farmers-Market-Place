import { useState } from "react";
import axios from "../api";
import { useUser } from "../hooks/useUser";
import ImageUploadWithResize from "./ImageUploadWithResize";
import "./VerificationUpload.css";

const VerificationUpload = () => {
  const { user } = useUser();
  const [verificationDocument, setVerificationDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  if (!user || user.role !== "Vendor") {
    return null;
  }

  const handleImageResize = (uri) => {
    setVerificationDocument(uri);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!verificationDocument) {
      setErrorMessage("Please select a verification document image");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await axios.post("/vendor/upload-verification", {
        verification_document: verificationDocument,
      });

      setSuccessMessage(response.data.message);
      setVerificationDocument(null);
    } catch (error) {
      console.error("Error uploading verification document:", error);
      const errorMsg =
        error.response?.data ||
        error.message ||
        "Failed to upload verification document";
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verification-upload-container">
      <div className="verification-upload">
        <h3>📋 Vendor Verification</h3>

        {user?.verified ? (
          <div className="verified-badge">
            <span className="verified-checkmark">✓</span>
            <p>Your account has been verified!</p>
          </div>
        ) : (
          <>
            {/* Show verification rejection reason if exists */}
            {user?.verification_rejected_reason && (
              <div className="rejection-notice">
                <div className="rejection-icon">⚠️</div>
                <div className="rejection-message">
                  <h4>Verification Rejected</h4>
                  <p>{user.verification_rejected_reason}</p>
                  <p>
                    <strong>
                      Please upload a new verification document below:
                    </strong>
                  </p>
                </div>
              </div>
            )}

            <p className="verification-description">
              Upload a clear photo of your ID or business license to get
              verified as a vendor. This helps us ensure quality and trustworthy
              vendors on our platform.
            </p>

            <form onSubmit={handleSubmit} className="verification-form">
              <div className="document-upload-section">
                <label>Verification Document *</label>
                <ImageUploadWithResize
                  onImageResize={handleImageResize}
                  maxWidth={1024}
                  maxHeight={1024}
                />

                {verificationDocument && (
                  <div className="document-preview">
                    <img
                      src={verificationDocument}
                      alt="Verification document preview"
                    />
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="error-message">{errorMessage}</div>
              )}

              {successMessage && (
                <div className="success-message">✓ {successMessage}</div>
              )}

              <button
                type="submit"
                className="btn-submit"
                disabled={loading || !verificationDocument}
              >
                {loading ? "Uploading..." : "Submit for Verification"}
              </button>
            </form>

            <div className="verification-guidelines">
              <h4>Requirements for Verification:</h4>
              <ul>
                <li>Clear, readable image of your ID or business license</li>
                <li>Image should be well-lit and in focus</li>
                <li>
                  No sensitive personal information should be visible beyond
                  what's required
                </li>
                <li>File size should be less than 5MB</li>
                <li>Our admin team will review within 24-48 hours</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerificationUpload;
