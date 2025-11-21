import { useState } from "react";
import Resizer from "react-image-file-resizer";
import { useEffect } from "react";

const ImageUploadWithResize = ({
  maxWidth = 800,
  maxHeight = 600,
  onImageResize,
}) => {
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    setError(null); // Clear previous errors
    setLoading(true);

    if (!file) {
      setLoading(false);
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError(
        "Please select a valid image file (PNG, JPG, JPEG, GIF, WebP, etc.)"
      );
      setLoading(false);
      return;
    }

    // Validate file size (limit to 10MB before resize)
    if (file.size > 10 * 1024 * 1024) {
      setError(
        "Image file is too large. Please select an image smaller than 10MB."
      );
      setLoading(false);
      return;
    }

    try {
      // Resize the image
      Resizer.imageFileResizer(
        file, // file to resize
        maxWidth, // maxWidth
        maxHeight, // maxHeight
        "JPEG", // format
        90, // quality
        0, // rotation
        (uri) => {
          // uri is the base64 string
          // Check if the base64 string is too large (2MB limit)
          if (uri && uri.length > 2 * 1024 * 1024) {
            setError(
              "Processed image is too large. Please reduce the max width/height or choose a smaller image."
            );
            setLoading(false);
            return;
          }

          setImagePreview(uri);
          onImageResize(uri);
          setError(null); // Clear any previous errors
          setLoading(false);
        },
        "base64", // output type
        (error) => {
          console.error("Image resize error:", error);
          setError("Failed to process image. Please try a different image.");
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Image processing error:", err);
      setError("Failed to process image. Please try a different image.");
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      setImagePreview(null);
    };
  }, []);

  return (
    <div style={{ marginTop: "10px" }}>
      <div
        style={{
          border: "2px dashed #27ae60",
          borderRadius: "8px",
          padding: "20px",
          textAlign: "center",
          backgroundColor: "#f8f9fa",
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
      >
        <label
          htmlFor="product-image"
          style={{ cursor: "pointer", display: "block" }}
        >
          <input
            id="product-image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: "14px", color: "#555" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>📸</div>
            <p>Click to upload or drag and drop</p>
            <p style={{ fontSize: "12px", color: "#999" }}>
              PNG, JPG, JPEG, GIF or WebP (max 10MB)
            </p>
          </div>
        </label>
      </div>

      {loading && (
        <div style={{ marginTop: "10px", color: "#27ae60", fontSize: "14px" }}>
          ⏳ Processing image...
        </div>
      )}

      {error && (
        <div
          style={{
            color: "#dc3545",
            marginTop: "10px",
            fontSize: "14px",
            padding: "10px",
            backgroundColor: "#f8d7da",
            borderRadius: "4px",
            border: "1px solid #f5c6cb",
          }}
        >
          {error}
        </div>
      )}

      {imagePreview && (
        <div style={{ marginTop: "15px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "8px",
                maxWidth: "250px",
              }}
            >
              <img
                src={imagePreview}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "200px",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div
              style={{
                color: "#27ae60",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              ✓ Image uploaded successfully
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploadWithResize;
