import { useState, useEffect } from 'react';
import axios from '../api';
import { useCart } from './CartContext';
import './Products.css';

const Products = () => {
  const [products, setProducts] = useState([]);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('/products');
        setProducts(response.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = async (product) => {
    try {
      await addToCart(product);
      alert('Item added to cart!');
    } catch {
      alert('Failed to add item to cart');
    }
  };

  return (
    <div>
      <h2>Available Products</h2>
      <div className="products-list">
        {products.map(product => (
          <div key={product.id} className="product-item">
            {product.image && <img src={`data:image/jpeg;base64,${product.image}`} alt={product.name} className="product-image" />}
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <p>Price: KSh {product.price.toLocaleString()}</p>
            <p>Category: {product.category}</p>
            <button onClick={() => handleAddToCart(product)}>Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Products;
