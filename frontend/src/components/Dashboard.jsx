import CustomerDashboard from './CustomerDashboard';
import VendorDashboard from './VendorDashboard';
import AdminDashboard from './AdminDashboard';
import { useUser } from './UserContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  if (!user) {
    return <div>Please log in.</div>;
  }

  switch (user.role) {
    case 'Customer':
      return <CustomerDashboard />;
    case 'Vendor':
      return <VendorDashboard />;
    case 'Admin':
      return <AdminDashboard />;
    default:
      return <div>Unknown role.</div>;
  }
};

export default Dashboard;
