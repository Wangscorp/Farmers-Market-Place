import './Home.css';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="home">
      <h2>Welcome to Farmers Market Place</h2>
      <p>Discover fresh produce from local vendors. Shop sustainably!</p>
      <Link to="/products"><button>Start Shopping</button></Link>
    </div>
  );
};

export default Home;
