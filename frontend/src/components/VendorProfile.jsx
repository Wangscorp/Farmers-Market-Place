import { useState, useEffect } from 'react';
import axios from '../api';
import { useUser } from './UserContext';
import ImageUploadWithResize from './ImageUploadWithResize';
import './VendorProfile.css';

const VendorProfile = () => {
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [resizedImage, setResizedImage] = useState(null);
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [newEmail, setNewEmail] = useState(user?.email || '');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('/products'); // API already filters to vendor's own products
        setProducts(response.data);
      } catch (error) {
        console.error('Error fetching products:', error);
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
    if (!resizedImage) {
      alert('Please select an image first');
      return;
    }
    try {
      await axios.patch('/profile/image', {
        profile_image: resizedImage,
      });
      alert('Profile image updated successfully! Please wait for admin verification.');
      setResizedImage(null); // Reset after successful upload
    } catch (error) {
      alert('Failed to update profile image: ' + error.response?.data);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newUsername.trim() || !newEmail.trim()) {
      alert('Please fill in both username and email');
      return;
    }
    try {
      const response = await axios.patch('/profile', {
        username: newUsername,
        email: newEmail,
      });
      alert(response.data.message + ' - You may need to log in again with your new username.');
    } catch (error) {
      const errorMessage = error.response?.data ||
                          (error.message === 'Network Error' ? 'Network error - please check your connection' : error.message) ||
                          'Unknown error occurred';
      alert('Failed to update profile: ' + errorMessage);
    }
  };

  return (
    <div className="vendor-profile">
      <h2>Vendor Dashboard</h2>
      <p>Account Verified: {user?.verified ? "Yes" : "No"}</p>

      <h3>Profile Image Verification</h3>
      <p>Upload your profile image to get verified as a vendor:</p>
      <ImageUploadWithResize onImageResize={handleImageResize} />
      <button onClick={handleUpdateProfileImage}>Update Profile Image</button>

      <h3>Edit Profile Information</h3>
      <p>Update your username and email:</p>
      <div className="profile-edit-form">
        <input
          type="text"
          placeholder="New Username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="New Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
        />
        <button onClick={handleUpdateProfile}>Update Profile Information</button>
      </div>

      <h3>Your Listed Products</h3>
      {products.length === 0 ? (
        <p>You haven't listed any products yet.</p>
      ) : (
        <div className="vendor-products-list">
          {products.map(product => (
            <div key={product.id} className="vendor-product-item">
              {product.image && <img src={`data:image/jpeg;base64,${product.image}`} alt={product.name} className="vendor-product-image" />}
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
