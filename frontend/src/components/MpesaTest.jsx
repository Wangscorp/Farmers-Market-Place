// M-Pesa STK Push demo: initiates payment request to user's phone.

import { useState } from "react";
import { toast } from "react-toastify";
import "./MpesaTest.css";

const MpesaTest = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);

  const handleStkPush = async () => {
    // Validate phone number
    const phoneRegex = /^(07\d{8}|254\d{9}|\+254\d{9})$/;
    if (!phoneRegex.test(phoneNumber.replace(/[\s-]/g, ""))) {
      toast.error(
        "Please enter a valid Kenyan M-Pesa number:\n• 07XXXXXXXX\n• 254XXXXXXXXX\n• +254XXXXXXXXX"
      );
      return;
    }

    // Validate amount
    if (amount < 1) {
      toast.error("Minimum amount is KSh 1");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in first");
        setLoading(false);
        return;
      }

      console.log("🔄 Initiating M-Pesa STK Push...", {
        phone: phoneNumber,
        amount: amount,
      });

      // Create a test cart item for demonstration
      const response = await fetch("http://localhost:8080/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mpesa_number: phoneNumber.replace(/[\s-]/g, ""),
          total_amount: amount,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("STK Push initiated:", result);

        setLastTransaction({
          id: result.transaction_id,
          phone: phoneNumber,
          amount: amount,
          status: result.status,
          message: result.message,
          timestamp: new Date().toLocaleString(),
        });

        // Show success message
        toast.success(
          `M-Pesa STK Push Sent!\n\n` +
            `Check your phone (${phoneNumber}) for the M-Pesa prompt\n` +
            `Amount: KSh ${amount}\n` +
            `Transaction ID: ${result.transaction_id}\n\n` +
            `You have 60 seconds to enter your M-Pesa PIN`
        );
      } else {
        console.error("STK Push failed:", result);
        toast.error(
          `Payment Failed\n\n${
            result.message || result.error
          }\n\nPlease try again.`
        );
      }
    } catch (error) {
      console.error("STK Push error:", error);
      toast.error(
        "Network Error\n\nUnable to connect to payment service.\nPlease check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");

    // Format based on length and starting digits
    if (digits.startsWith("254") && digits.length <= 12) {
      return digits;
    } else if (digits.startsWith("07") && digits.length <= 10) {
      return digits;
    } else if (digits.length <= 9) {
      return "07" + digits;
    }

    return digits.slice(0, 12);
  };

  return (
    <div className="mpesa-test">
      <div className="test-header">
        <h2>🇰🇪 M-Pesa STK Push Test</h2>
        <p>
          Test the M-Pesa Daraja API integration by sending an STK Push to your
          phone
        </p>
      </div>

      <div className="test-form">
        <div className="form-group">
          <label htmlFor="phone">Phone Number:</label>
          <input
            id="phone"
            type="tel"
            placeholder="07XXXXXXXX or 254XXXXXXXXX"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
            disabled={loading}
          />
          <small>Enter your M-Pesa registered phone number</small>
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (KSh):</label>
          <input
            id="amount"
            type="number"
            min="1"
            max="70000"
            value={amount}
            onChange={(e) =>
              setAmount(Math.max(1, parseInt(e.target.value) || 1))
            }
            disabled={loading}
          />
          <small>Minimum: KSh 1, Maximum: KSh 70,000</small>
        </div>

        <button
          className={`stk-button ${loading ? "loading" : ""}`}
          onClick={handleStkPush}
          disabled={loading || !phoneNumber || amount < 1}
        >
          {loading ? (
            <>
              <span className="spinner">⏳</span>
              Sending STK Push...
            </>
          ) : (
            <>Send STK Push (KSh {amount})</>
          )}
        </button>
      </div>

      {lastTransaction && (
        <div className="transaction-info">
          <h3>Last Transaction</h3>
          <div className="transaction-details">
            <p>
              <strong>Transaction ID:</strong> {lastTransaction.id}
            </p>
            <p>
              <strong>Phone:</strong> {lastTransaction.phone}
            </p>
            <p>
              <strong>Amount:</strong> KSh {lastTransaction.amount}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              <span className={`status ${lastTransaction.status}`}>
                {lastTransaction.status}
              </span>
            </p>
            <p>
              <strong>Time:</strong> {lastTransaction.timestamp}
            </p>
            <p>
              <strong>Message:</strong> {lastTransaction.message}
            </p>
          </div>
        </div>
      )}

      <div className="test-instructions">
        <h3>How it works:</h3>
        <ol>
          <li>Enter your M-Pesa registered phone number</li>
          <li>Set the amount you want to pay (minimum KSh 1)</li>
          <li>Click "Send STK Push"</li>
          <li>Check your phone for the M-Pesa payment prompt</li>
          <li>Enter your M-Pesa PIN to complete the payment</li>
        </ol>

        <div className="note">
          <p>
            <strong>Note:</strong> This is a test environment. In sandbox mode,
            no real money is transferred.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MpesaTest;
