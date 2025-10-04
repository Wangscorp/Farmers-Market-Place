import { Link } from 'react-router-dom';
import './Header.css'; // Assume we add some CSS

const Header = () => {
  return (
    <header>
      <h1>Farmers Market Place</h1>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/products">Products</Link>
        <Link to="/cart">Cart</Link>
        <Link to="/auth">Login</Link>
        <Link to="/vendor">Vendor</Link>
      </nav>
    </header>
  );
};

export default Header;
