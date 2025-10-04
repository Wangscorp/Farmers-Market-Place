import { useState } from 'react';
import axios from '../api';
import ImageUploadWithResize from './ImageUploadWithResize';
import { useUser } from './UserContext';

const VendorDashboard = () => {
  const { user } = useUser();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [resizedImage, setResizedImage] = useState(null);
  const [maxWidth, setMaxWidth] = useState(800);
  const [maxHeight, setMaxHeight] = useState(600);

  const handleImageResize = (uri) => {
    setResizedImage(uri);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/products', {
        name,
        price: parseFloat(price),
        category,
        description,
        image: resizedImage,
        vendor_id: 1, // hardcoded for now
      });
      alert('Product created: ' + JSON.stringify(response.data));
      // Reset form
      setName('');
      setPrice('');
      setCategory('');
      setDescription('');
      setResizedImage(null);
    } catch (error) {
      alert('Error creating product: ' + error.message);
    }
  };

  return (
    <div className="vendor-dashboard">
      <h2>Vendor Dashboard</h2>
      <p>Account Verified: {user?.verified ? "Yes" : "No"}</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          step="0.01"
          required
        />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <div>
          <label>Max Width:</label>
          <input
            type="number"
            value={maxWidth}
            onChange={(e) => setMaxWidth(e.target.value)}
          />
        </div>
        <div>
          <label>Max Height:</label>
          <input
            type="number"
            value={maxHeight}
            onChange={(e) => setMaxHeight(e.target.value)}
          />
        </div>
        <ImageUploadWithResize maxWidth={maxWidth} maxHeight={maxHeight} onImageResize={handleImageResize} />
        <button type="submit">Create Product</button>
      </form>
    </div>
  );
};

export default VendorDashboard;
