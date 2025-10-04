import { useState } from 'react';
import Resizer from 'react-image-file-resizer';
import { useEffect } from 'react';

const ImageUploadWithResize = ({ maxWidth = 800, maxHeight = 600, onImageResize }) => {
  const [imagePreview, setImagePreview] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
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
          setImagePreview(uri);
          onImageResize(uri);
        },
        'base64' // output type
      );
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
      {imagePreview && (
        <img src={imagePreview} alt="Preview" style={{ maxWidth: '200px', maxHeight: '200px' }} />
      )}
    </div>
  );
};

export default ImageUploadWithResize;
