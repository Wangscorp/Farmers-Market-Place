import React, { useState, useEffect } from 'react';
import { useUser } from './UserContext';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'Admin') {
      navigate('/auth');
      return;
    }
    fetchUsers();
  }, [user, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const usersData = await response.json();
      setUsers(usersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error('Failed to update role');

      setUsers(users.map(u => u.id === userId ? {...u, role: newRole} : u));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVerificationToggle = async (userId, verified) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ verified }),
      });

      if (!response.ok) throw new Error('Failed to update verification');

      setUsers(users.map(u => u.id === userId ? {...u, verified} : u));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete user');

      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user || user.role !== 'Admin') {
    return <div>Access denied. Admin privileges required.</div>;
  }

  if (loading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard - User Management</h1>
      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Verified</th>
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
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    disabled={u.id === user.id} // Can't delete self
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
        .user-table-container {
          overflow-x: auto;
        }
        .user-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .user-table th,
        .user-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        .user-table th {
          background-color: #f8f9fa;
          font-weight: 600;
        }
        .user-table tr:hover {
          background-color: #f5f5f5;
        }
        .delete-btn {
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }
        .delete-btn:hover:not(:disabled) {
          background-color: #c82333;
        }
        .delete-btn:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
