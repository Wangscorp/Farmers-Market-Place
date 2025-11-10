import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./components/Home";
import Products from "./components/Products";
import Cart from "./components/Cart";
import Auth from "./components/Auth";
import VendorProfile from "./components/VendorProfile";
import VendorProfileView from "./components/VendorProfileView";
import VendorDashboard from "./components/VendorDashboard";
import VendorSetup from "./components/VendorSetup";
import AdminDashboard from "./components/AdminDashboard";
import Shipping from "./components/Shipping";
import Conversations from "./components/Conversations";
import Chatbot from "./components/Chatbot";
import MpesaTest from "./components/MpesaTest";
import AuthDebug from "./components/AuthDebug";
import { FollowProvider } from "./components/FollowContext";
import { useUser } from "./hooks/useUser";
import "./App.css";

function VendorRoutes() {
  const { user } = useUser();

  // Show VendorDashboard for verified vendors, VendorProfile for others
  return user?.verified ? <VendorDashboard /> : <VendorProfile />;
}

function App() {
  return (
    <FollowProvider>
      <Router>
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/messages" element={<Conversations />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/vendor-setup" element={<VendorSetup />} />
            <Route path="/vendor" element={<VendorRoutes />} />
            <Route
              path="/vendor-profile/:vendorId"
              element={<VendorProfileView />}
            />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/mpesa-test" element={<MpesaTest />} />
            <Route path="/auth-debug" element={<AuthDebug />} />
          </Routes>
        </main>
        <Chatbot />
      </Router>
    </FollowProvider>
  );
}

export default App;
