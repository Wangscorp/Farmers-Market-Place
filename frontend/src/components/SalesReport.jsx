import { useState, useEffect } from "react";
import axios from "../api";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "react-toastify";
import "./SalesReport.css";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF6B9D",
];

const SalesReport = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesReport();
  }, []);

  const fetchSalesReport = async () => {
    try {
      const response = await axios.get("/reports/vendor/sales");
      setReport(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sales report:", error);
      toast.error("Failed to load sales report");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sales-report">
        <h2>Sales Report</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="sales-report">
        <h2>Sales Report</h2>
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="sales-report">
      <h2>Sales Analytics</h2>

      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total Sales</h3>
          <p className="amount">KES {report.total_sales.toFixed(2)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Orders</h3>
          <p className="count">{report.total_orders}</p>
        </div>
        <div className="summary-card">
          <h3>Total Profit</h3>
          <p className="amount">KES {report.total_profit.toFixed(2)}</p>
        </div>
      </div>

      {report.sales_by_product && report.sales_by_product.length > 0 && (
        <>
          <div className="chart-section">
            <h3>Sales by Product (Revenue)</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={report.sales_by_product}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="product_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="total_revenue"
                  fill="#8884d8"
                  name="Revenue (KES)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section">
            <h3>Product Sales Distribution</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={report.sales_by_product}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) =>
                    `${entry.product_name} (${entry.quantity_sold})`
                  }
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="total_revenue"
                >
                  {report.sales_by_product.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="product-list">
            <h3>Detailed Product Sales</h3>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Quantity Sold</th>
                  <th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.sales_by_product.map((product) => (
                  <tr key={product.product_id}>
                    <td>{product.product_name}</td>
                    <td>{product.quantity_sold}</td>
                    <td>KES {product.total_revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(!report.sales_by_product || report.sales_by_product.length === 0) && (
        <div className="no-data">
          <p>
            No sales data available yet. Start selling to see your analytics!
          </p>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
