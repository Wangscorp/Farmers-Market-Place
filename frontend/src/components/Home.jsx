import './Home.css';
import { Link } from 'react-router-dom';
import { useUser } from './UserContext';

const Home = () => {
  const { user } = useUser();

  return (
    <div className="home">
      <h2>Welcome to Farmers Market Place</h2>
      {user?.role === 'Vendor' ? (
        <>
          <p>Welcome back! Ready to start selling your fresh produce to customers?</p>
          <Link to="/vendor"><button>Start Selling Now</button></Link>
        </>
      ) : (
        <>
          <p>Discover fresh produce from local vendors. Shop sustainably!</p>
          <Link to="/products"><button>Start Shopping</button></Link>
        </>
      )}
    </div>
  );
};

export default Home;
