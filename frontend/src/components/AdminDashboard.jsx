import React, { useState, useEffect } from 'react';
import { useUser } from './UserContext';
import { useNavigate } from 'react-router-dom';
import axios from '../api';

const AdminDashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reports, setReports] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableColumns, setTableColumns] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    if (!user || user.role !== 'Admin') {
      navigate('/auth');
      return;
    }
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'transactions') {
      fetchTransactions();
    } else if (activeTab === 'reports') {
      fetchReports();
    } else if (activeTab === 'database') {
      fetchDatabases();
    }
  }, [user, navigate, activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/admin/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/admin/cart');
      setTransactions(response.data);
    } catch (err) {
      setError(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/admin/reports');
      setReports(response.data);
    } catch (err) {
      setError(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDatabases = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/admin/databases');
      setDatabases(response.data);
    } catch (err) {
      setError(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const response = await axios.get('/api/admin/tables');
      setTables(response.data);
    } catch (err) {
      setError(err.response?.data || err.message);
    }
  };

  const fetchTableColumns = async (tableName) => {
    try {
      const response = await axios.get(`/api/admin/tables/${tableName}/columns`);
      setTableColumns(response.data);
    } catch (err) {
      setError(err.response?.data || err.message);
    }
  };

  const fetchTableData = async (tableName) => {
    try {
      const response = await axios.get(`/api/admin/tables/${tableName}/data`);
      setTableData(response.data);
    } catch (err) {
      setError(err.response?.data || err.message);
    }
  };

  const handleTableClick = async (table) => {
    setSelectedTable(table);
    await fetchTableColumns(table.name);
    await fetchTableData(table.name);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.patch(`/api/admin/users/${userId}`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? {...u, role: newRole} : u));
    } catch (err) {
      setError(err.response?.data || err.message);
    }
  };

  const handleVerificationToggle = async (userId, verified) => {
    try {
      await axios.patch(`/api/admin/users/${userId}/verify`, { verified });
      setUsers(users.map(u => u.id === userId ? {...u, verified} : u));
    } catch (err) {
      setError(err.response?.data || err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await axios.delete(`/api/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setError(err.response?.data || err.message);
    }
  };

  const handleBanToggle = async (userId, banned) => {
    try {
      await axios.patch(`/api/admin/users/${userId}/ban`, { banned });
      setUsers(users.map(u => u.id === userId ? {...u, banned} : u));
    } catch (err) {
      setError(err.response?.data || err.message);
    }
  };

  const handleReportAction = async (reportId, status, adminNotes) => {
    try {
      await axios.patch(`/api/admin/reports/${reportId}`, {
        status,
        admin_notes: adminNotes
      });
      // Refresh reports after action
      fetchReports();
    } catch (err) {
      setError(err.response?.data || err.message);
    }
  };

  const handleResetPassword = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to reset the password for "${username}"?\n\nThis will generate a new temporary password and send it to their email.`)) {
      return;
    }

    try {
      const response = await axios.patch(`/api/admin/users/${userId}/reset-password`);
      alert(response.data.message || 'Password reset successfully. User has been emailed their new password.');
    } catch (err) {
      alert('Failed to reset password: ' + (err.response?.data || err.message));
    }
  };

  if (!user || user.role !== 'Admin') {
    return <div>Access denied. Admin privileges required.</div>;
  }

  if (loading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>

      <div className="tab-buttons">
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Management ({users.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions ({transactions.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Vendor Reports ({reports.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveTab('database')}
        >
          Database Management
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="user-table-container">
          <h2>User Management</h2>
          <table className="user-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Verified</th>
                <th>Banned</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === user.id} // Can't change own role
                    >
                      <option value="Admin">Admin</option>
                      <option value="Vendor">Vendor</option>
                      <option value="Customer">Customer</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.verified}
                      onChange={(e) => handleVerificationToggle(u.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.banned}
                      onChange={(e) => handleBanToggle(u.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleResetPassword(u.id, u.username)}
                        disabled={u.id === user.id} // Can't reset own password
                        className="reset-btn"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={u.id === user.id} // Can't delete self
                        className="delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="transaction-table-container">
          <h2>Transaction Overview</h2>
          {transactions.length === 0 ? (
            <p>No transactions yet.</p>
          ) : (
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Vendor</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>User {t.user_id}</td>
                    <td>{t.product.name}</td>
                    <td>Vendor {t.product.vendor_id}</td>
                    <td>{t.quantity}</td>
                    <td>KSH {t.product.price?.toFixed(2)}</td>
                    <td>KSH {(t.product.price * t.quantity)?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="reports-table-container">
          <h2>Vendor Reports Management</h2>
          {reports.length === 0 ? (
            <p>No reports yet.</p>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Vendor</th>
                  <th>Product</th>
                  <th>Report Type</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Admin Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.customer_username}</td>
                    <td>{r.vendor_username}</td>
                    <td>{r.product_name || 'N/A'}</td>
                    <td>{r.report_type}</td>
                    <td>{r.description || 'N/A'}</td>
                    <td>
                      <span className={`status ${r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{r.created_at}</td>
                    <td>{r.admin_notes || 'N/A'}</td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="report-actions">
                          <button
                            onClick={() => handleReportAction(r.id, 'investigating', 'Under investigation')}
                            className="btn-investigate"
                          >
                            Investigate
                          </button>
                          <button
                            onClick={() => handleReportAction(r.id, 'resolved', 'Issue resolved')}
                            className="btn-resolve"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleReportAction(r.id, 'dismissed', 'Report dismissed')}
                            className="btn-dismiss"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'database' && (
        <div className="database-container">
          <h2>Database Management</h2>

          <div className="database-section">
            <h3>Databases</h3>
            <div className="database-list">
              {databases.map(db => (
                <div key={db.name} className="database-item">
                  <h4>{db.name}</h4>
                  <p>Owner: {db.owner}</p>
                  <p>Encoding: {db.encoding}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="database-section">
            <h3>Tables</h3>
            <button onClick={fetchTables} className="btn-primary">Load Tables</button>
            <div className="table-list">
              {tables.map(table => (
                <div
                  key={table.name}
                  className={`table-item ${selectedTable?.name === table.name ? 'selected' : ''}`}
                  onClick={() => handleTableClick(table)}
                >
                  <h4>{table.name}</h4>
                  <p>Schema: {table.schema}</p>
                  <p>Type: {table.table_type}</p>
                  <p>Owner: {table.owner}</p>
                </div>
              ))}
            </div>
          </div>

          {selectedTable && (
            <div className="database-section">
              <h3>Table: {selectedTable.name}</h3>

              <div className="table-details">
                <div className="columns-section">
                  <h4>Columns</h4>
                  <table className="columns-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Nullable</th>
                        <th>Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableColumns.map(col => (
                        <tr key={col.name}>
                          <td>{col.name}</td>
                          <td>{col.data_type}</td>
                          <td>{col.is_nullable}</td>
                          <td>{col.default_value || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="data-section">
                  <h4>Data (First 100 rows)</h4>
                  {tableData.columns && tableData.rows ? (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {tableData.columns.map(col => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.rows.map((row, index) => (
                            <tr key={index}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>
                                  {cell === null ? 'NULL' : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No data available or loading...</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .admin-dashboard {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        h1 {
          color: #333;
          margin-bottom: 20px;
        }
        .tab-buttons {
          display: flex;
          gap: 10px;
          margin-bottom: 30px;
        }
        .tab-btn {
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
        }
        .tab-btn.active {
          background-color: #007bff;
          color: white;
          border-color: #007bff;
        }
        .user-table-container,
        .transaction-table-container,
        .reports-table-container {
          overflow-x: auto;
        }
        .user-table,
        .transaction-table,
        .reports-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .user-table th,
        .user-table td,
        .transaction-table th,
        .transaction-table td,
        .reports-table th,
        .reports-table td {
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .user-table th,
        .transaction-table th,
        .reports-table th {
          background-color: #f8f9fa;
          font-weight: 600;
        }
        .user-table tr:hover,
        .transaction-table tr:hover,
        .reports-table tr:hover {
          background-color: #f5f5f5;
        }
        .action-buttons {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .reset-btn {
          background-color: #ffc107;
          color: #212529;
          border: 1px solid #ffc107;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .reset-btn:hover:not(:disabled) {
          background-color: #e0a800;
          border-color: #d39e00;
        }
        .reset-btn:disabled {
          background-color: #6c757d;
          border-color: #6c757d;
          color: white;
          cursor: not-allowed;
        }
        .delete-btn {
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        .delete-btn:hover:not(:disabled) {
          background-color: #c82333;
        }
        .delete-btn:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }
        .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status.pending {
          background-color: #fff3cd;
          color: #856404;
        }
        .status.investigating {
          background-color: #cce5ff;
          color: #004085;
        }
        .status.resolved {
          background-color: #d4edda;
          color: #155724;
        }
        .status.dismissed {
          background-color: #f8d7da;
          color: #721c24;
        }
        .report-actions {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }
        .report-actions button {
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          border: 1px solid #ddd;
        }
        .btn-investigate {
          background-color: #cce5ff;
          color: #004085;
        }
        .btn-resolve {
          background-color: #d4edda;
          color: #155724;
        }
        .btn-dismiss {
          background-color: #f8d7da;
          color: #721c24;
        }
        .database-container {
          max-width: 100%;
        }
        .database-section {
          margin-bottom: 30px;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background-color: #f9f9f9;
        }
        .database-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
        }
        .database-item {
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background-color: white;
        }
        .database-item h4 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .database-item p {
          margin: 5px 0;
          font-size: 14px;
          color: #666;
        }
        .table-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        .table-item {
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background-color: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        .table-item:hover {
          border-color: #007bff;
          box-shadow: 0 2px 4px rgba(0,123,255,0.1);
        }
        .table-item.selected {
          border-color: #007bff;
          background-color: #e7f3ff;
        }
        .table-item h4 {
          margin: 0 0 8px 0;
          color: #333;
        }
        .table-item p {
          margin: 4px 0;
          font-size: 13px;
          color: #666;
        }
        .table-details {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        .columns-section,
        .data-section {
          background-color: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }
        .columns-table,
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        .columns-table th,
        .columns-table td,
        .data-table th,
        .data-table td {
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .columns-table th,
        .data-table th {
          background-color: #f8f9fa;
          font-weight: 600;
        }
        .data-table-container {
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
        }
        .btn-primary {
          background-color: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-primary:hover {
          background-color: #0056b3;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
