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
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
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

  const downloadPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Sales Report", 14, 20);

    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Sales: KES ${report.total_sales.toFixed(2)}`, 14, 38);
    doc.text(`Total Orders: ${report.total_orders}`, 14, 46);
    doc.text(`Total Profit: KES ${report.total_profit.toFixed(2)}`, 14, 54);

    if (report.sales_by_product && report.sales_by_product.length > 0) {
      doc.text("Product Sales Details", 14, 66);

      const tableData = report.sales_by_product.map((product) => [
        product.product_name,
        product.quantity_sold.toString(),
        `KES ${product.total_revenue.toFixed(2)}`,
      ]);

      doc.autoTable({
        startY: 70,
        head: [["Product Name", "Quantity Sold", "Total Revenue"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [76, 175, 80] },
      });
    }

    doc.save(`sales-report-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF downloaded successfully!");
  };

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ["Sales Report Summary"],
      ["Generated", new Date().toLocaleDateString()],
      [""],
      ["Total Sales", `KES ${report.total_sales.toFixed(2)}`],
      ["Total Orders", report.total_orders],
      ["Total Profit", `KES ${report.total_profit.toFixed(2)}`],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    if (report.sales_by_product && report.sales_by_product.length > 0) {
      const productData = report.sales_by_product.map((product) => ({
        "Product Name": product.product_name,
        "Quantity Sold": product.quantity_sold,
        "Total Revenue (KES)": product.total_revenue.toFixed(2),
      }));
      const productSheet = XLSX.utils.json_to_sheet(productData);
      XLSX.utils.book_append_sheet(wb, productSheet, "Product Sales");
    }

    XLSX.writeFile(
      wb,
      `sales-report-${new Date().toISOString().split("T")[0]}.xlsx`
    );
    toast.success("Excel file downloaded successfully!");
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
      <div className="report-header">
        <h2>Sales Analytics</h2>
        <div className="download-buttons">
          <button onClick={downloadPDF} className="download-btn pdf-btn">
            📄 Download PDF
          </button>
          <button onClick={downloadExcel} className="download-btn excel-btn">
            📊 Download Excel
          </button>
        </div>
      </div>

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
