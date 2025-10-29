import { useState } from 'react';
import Resizer from 'react-image-file-resizer';
import { useEffect } from 'react';

const ImageUploadWithResize = ({ maxWidth = 800, maxHeight = 600, onImageResize }) => {
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    setError(null); // Clear previous errors

    if (!file) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Validate file size (limit to 10MB before resize)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large. Please select an image smaller than 10MB.');
      return;
    }

    try {
      // Resize the image
      Resizer.imageFileResizer(
        file, // file to resize
        maxWidth, // maxWidth
        maxHeight, // maxHeight
        'JPEG', // format
        90, // quality
        0, // rotation
        (uri) => {
          // uri is the base64 string
          // Check if the base64 string is too large (2MB limit)
          if (uri && uri.length > 2 * 1024 * 1024) {
            setError('Processed image is too large. Please reduce the max width/height or choose a smaller image.');
            return;
          }

          setImagePreview(uri);
          onImageResize(uri);
          setError(null); // Clear any previous errors
        },
        'base64', // output type
        (error) => {
          console.error('Image resize error:', error);
          setError('Failed to process image. Please try a different image.');
        }
      );
    } catch (err) {
      console.error('Image processing error:', err);
      setError('Failed to process image. Please try a different image.');
    }
  };

  useEffect(() => {
    return () => {
      setImagePreview(null);
    };
  }, []);

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      {error && (
        <div style={{ color: 'red', marginTop: '5px', fontSize: '14px' }}>
          {error}
        </div>
      )}
      {imagePreview && (
        <img src={imagePreview} alt="Preview" style={{ maxWidth: '200px', maxHeight: '200px' }} />
      )}
    </div>
  );
};

export default ImageUploadWithResize;
