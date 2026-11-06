import React, { useEffect, useState } from "react";
import "./UserManagement.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "").replace(/\/api$/, "");

const emptyForm = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  role: "incharge_officer",
};

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = sessionStorage.getItem("census_token");

  let currentUser = {};

  try {
    currentUser = JSON.parse(sessionStorage.getItem("census_user") || "{}");
  } catch {
    currentUser = {};
  }

  // ======================================================
  // COMMON API REQUEST
  // ======================================================

  const apiRequest = async (url, options = {}) => {
    const currentToken = sessionStorage.getItem("census_token");

    if (!currentToken) {
      sessionStorage.removeItem("census_user");
      window.location.hash = "#/login";
      throw new Error("Please login again. Authentication token not found.");
    }

    const response = await fetch(url, {
      cache: "no-store", // never use a cached response
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
        Authorization: `Bearer ${currentToken}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      sessionStorage.removeItem("census_token");
      sessionStorage.removeItem("census_user");
      window.location.hash = "#/login";
      throw new Error("Session expired or invalid. Please login again.");
    }

    if (response.status === 403) {
      throw new Error(
        data.message || "You do not have permission to perform this action."
      );
    }

    if (!response.ok || data.success === false) {
      // 409 etc: show the real server message (e.g. "Username already exists")
      throw new Error(data.message || "Request failed. Please try again.");
    }

    return data;
  };

  // ======================================================
  // LOAD USERS
  // ======================================================

  const loadUsers = async () => {
    try {
      setLoading(true);

      const data = await apiRequest(`${API_URL}/api/users`);

      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !currentUser.id) {
      window.location.hash = "#/login";
      return;
    }

    if (currentUser.role !== "admin") {
      setLoading(false);
      setError("Access denied. Only admin can manage users.");
      return;
    }

    loadUsers();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======================================================
  // FORM CHANGE
  // ======================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ======================================================
  // OPEN ADD / EDIT
  // ======================================================

  const openAddUser = () => {
    setEditingUser(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);

    setForm({
      username: user.username || "",
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role: user.role || "incharge_officer",
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setError("");
  };

  // ======================================================
  // SAVE USER: CREATE / UPDATE
  // ======================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.username.trim() || !form.full_name.trim() || !form.role) {
      setError("Username, full name and role are required.");
      return;
    }

    if (!editingUser && !form.password) {
      setError("Password is required for a new user.");
      return;
    }

    if (form.password && form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);

      const url = editingUser
        ? `${API_URL}/api/users/${editingUser.id}`
        : `${API_URL}/api/users`;

      const method = editingUser ? "PUT" : "POST";

      const payload = {
        username: form.username.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        role: form.role,
      };

      if (form.password) {
        payload.password = form.password;
      }

      const data = await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      });

      // Close modal only on success
      setShowModal(false);
      setForm({ ...emptyForm });
      setEditingUser(null);

      setSuccess(
        data.message ||
          (method === "POST"
            ? "User created successfully."
            : "User updated successfully.")
      );

      // Always reload from the server so the table shows real database data
      await loadUsers();
    } catch (err) {
      // Modal stays open and the error is shown inside it
      setError(err.message || "Unable to save user.");
    } finally {
      setSaving(false);
    }
  };

  // ======================================================
  // DELETE USER
  // ======================================================

  const handleDelete = async (user) => {
    if (Number(user.id) === Number(currentUser.id)) {
      setError("You cannot delete your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${user.username}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const data = await apiRequest(`${API_URL}/api/users/${user.id}`, {
        method: "DELETE",
      });

      setSuccess(data.message || "User deleted successfully.");

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to delete user.");
    }
  };

  // ======================================================
  // HELPERS
  // ======================================================

  const formatRole = (role) => {
    if (role === "admin") return "Admin";
    if (role === "nodal_officer") return "Nodal Officer";
    if (role === "incharge_officer") return "Incharge Officer";

    return role || "-";
  };

  const formatDate = (date) => {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "-";

  const day = String(parsedDate.getDate()).padStart(2, "0");
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const year = parsedDate.getFullYear();

  return `${day}/${month}/${year}`;
};
  // ======================================================
  // PAGE
  // ======================================================

  return (
    <div className="user-management">
      <div className="user-page-header">
        <div>
          <h1>User Management</h1>
          <p>Admin can add, update and delete users.</p>
        </div>

        <button
          type="button"
          className="add-user-btn"
          onClick={openAddUser}
          disabled={!token}
        >
          + Add User
        </button>
      </div>

      {/* Page-level alerts: hidden while modal is open (modal shows its own) */}
      {error && !showModal && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="alert success" role="status">
          {success}
        </div>
      )}

      <div className="user-table-container">
        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="7">No users found</td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id}>
                    <td>{index + 1}</td>

                    <td>
                      <strong>{user.username}</strong>
                    </td>

                    <td>{user.full_name || "-"}</td>

                    <td>{user.email || "-"}</td>

                    <td>
                      <span className={`role-badge ${user.role}`}>
                        {formatRole(user.role)}
                      </span>
                    </td>

                    <td>{formatDate(user.created_at)}</td>

                    <td>
                      <button
                        type="button"
                        className="edit-btn"
                        onClick={() => openEditUser(user)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="delete-btn"
                        disabled={Number(user.id) === Number(currentUser.id)}
                        onClick={() => handleDelete(user)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div
            className="user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
          >
            <div className="modal-header">
              <h2 id="user-modal-title">
                {editingUser ? "Update User" : "Add User"}
              </h2>

              <button
                type="button"
                className="close-btn"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Error shown INSIDE the modal so you can see 409 messages */}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="username">Username *</label>

                  <input
                    id="username"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="Enter username"
                    autoComplete="off"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="full_name">Full Name *</label>

                  <input
                    id="full_name"
                    name="full_name"
                    value={form.full_name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    autoComplete="off"
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email</label>

                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter email"
                    autoComplete="off"
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="role">Role *</label>

                  <select
                    id="role"
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    required
                    disabled={saving}
                  >
                    <option value="admin">Admin</option>
                    <option value="nodal_officer">Nodal Officer</option>
                    <option value="incharge_officer">Incharge Officer</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  Password{" "}
                  {editingUser
                    ? "(leave blank to keep current password)"
                    : "*"}
                </label>

                <input
                  id="password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={
                    editingUser
                      ? "Leave blank to keep current password"
                      : "Enter password (minimum 6 characters)"
                  }
                  minLength={6}
                  required={!editingUser}
                  autoComplete="new-password"
                  disabled={saving}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button type="submit" className="save-btn" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editingUser
                    ? "Update User"
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
