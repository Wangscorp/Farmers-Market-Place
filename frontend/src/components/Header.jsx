import { Link } from 'react-router-dom';
import { useUser } from '../hooks/useUserHook';
import './Header.css';

const Header = () => {
  const { user, logout } = useUser();

  const handleLogout = () => {
    logout();
    alert('Logged out successfully');
  };

  return (
    <header>
      <h1>Farmers Market Place</h1>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/products">Products</Link>
        {user?.role !== 'Vendor' && <Link to="/cart">Cart</Link>}
        {user ? (
          <>
            <span>Welcome, {user.username}!</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
            {user.role === 'Vendor' && <Link to="/vendor">Vendor Dashboard</Link>}
            {user.role === 'Admin' && <Link to="/admin">Admin Dashboard</Link>}
          </>
        ) : (
          <Link to="/auth">Login</Link>
        )}
      </nav>
    </header>
  );
};

export default Header;
