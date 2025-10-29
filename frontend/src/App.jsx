import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import Products from './components/Products';
import Cart from './components/Cart';
import Auth from './components/Auth';
import VendorProfile from './components/VendorProfile';
import VendorDashboard from './components/VendorDashboard';
import AdminDashboard from './components/AdminDashboard';
import { useUser } from './components/UserContext';
import './App.css';

function VendorRoutes() {
  const { user } = useUser();

  // Show VendorDashboard for verified vendors, VendorProfile for others
  return user?.verified ? <VendorDashboard /> : <VendorProfile />;
}

function App() {
  return (
    <Router>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/vendor" element={<VendorRoutes />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
