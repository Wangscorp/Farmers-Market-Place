import { useState, useEffect } from "react";
import axios from "../api";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "react-toastify";
import "./PurchaseReport.css";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF6B9D",
  "#A28BD4",
  "#F67280",
];

const PurchaseReport = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchaseReport();
  }, []);

  const fetchPurchaseReport = async () => {
    try {
      const response = await axios.get("/reports/customer/purchases");
      setReport(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching purchase report:", error);
      toast.error("Failed to load purchase report");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="purchase-report">
        <h2>Purchase Report</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="purchase-report">
        <h2>Purchase Report</h2>
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="purchase-report">
      <h2>Purchase Analytics</h2>

      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Spent</h3>
          <p className="amount">KES {report.total_spent.toFixed(2)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Orders</h3>
          <p className="count">{report.total_orders}</p>
        </div>
        <div className="summary-card">
          <h3>Categories</h3>
          <p className="count">{report.purchases_by_category?.length || 0}</p>
        </div>
      </div>

      {report.purchases_by_category &&
        report.purchases_by_category.length > 0 && (
          <>
            <div className="chart-section">
              <h3>Spending by Category</h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={report.purchases_by_category}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={(entry) =>
                      `${entry.category}: KES ${entry.total_spent.toFixed(0)}`
                    }
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="total_spent"
                  >
                    {report.purchases_by_category.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-section">
              <h3>Quantity Purchased by Category</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={report.purchases_by_category}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="quantity"
                    fill="#00C49F"
                    name="Items Purchased"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="category-list">
              <h3>Category Breakdown</h3>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Items Purchased</th>
                    <th>Total Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {report.purchases_by_category.map((category, index) => (
                    <tr key={index}>
                      <td>
                        <span
                          className="color-indicator"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        ></span>
                        {category.category}
                      </td>
                      <td>{category.quantity}</td>
                      <td>KES {category.total_spent.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      {report.purchases_by_vendor && report.purchases_by_vendor.length > 0 && (
        <>
          <div className="chart-section">
            <h3>Spending by Vendor</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={report.purchases_by_vendor}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="vendor_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="total_spent"
                  fill="#8884d8"
                  name="Amount Spent (KES)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="vendor-list">
            <h3>Vendor Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Orders</th>
                  <th>Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {report.purchases_by_vendor.map((vendor) => (
                  <tr key={vendor.vendor_id}>
                    <td>{vendor.vendor_name}</td>
                    <td>{vendor.order_count}</td>
                    <td>KES {vendor.total_spent.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(!report.purchases_by_category ||
        report.purchases_by_category.length === 0) &&
        (!report.purchases_by_vendor ||
          report.purchases_by_vendor.length === 0) && (
          <div className="no-data">
            <p>
              No purchase data available yet. Start shopping to see your
              analytics!
            </p>
          </div>
        )}
    </div>
  );
};

export default PurchaseReport;
