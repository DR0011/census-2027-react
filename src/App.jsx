
import React, { useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import Home from "./pages/Home.jsx";
import AdminUnits from "./pages/AdminUnits.jsx";
import Circulars from "./pages/Circulars.jsx";
import Documents from "./pages/Documents.jsx";
import Notification from "./pages/Notification.jsx";
import Letters from "./pages/Letters.jsx";
import Training from "./pages/Training.jsx";
import Download from "./pages/Download.jsx";
import ContactOfficers from "./pages/ContactOfficers.jsx";
import Login from "./pages/Login.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import Navbar from "./components/Navbar.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import PasswordResetRequests from "./pages/PasswordResetRequests.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import CircularsDocuments from "./components/CircularsDocuments.jsx";
import PdfUpload from "./components/PdfUpload";
import "./App.css";

const API = "http://localhost:5000/api";

/* =========================================
   ROLE PERMISSIONS
========================================= */

const ROLE_PERMISSIONS = {
  admin: [
    "home",
    "administrative_units",
    "correspondence",
    "circulars_documents",
    "training",
    "download",
    "contacts",
    "user_management",
    "change_password",
  ],

  nodal_officer: [
    "administrative_units",
    "change_password",
  ],

  incharge_officer: [
    "contacts",
    "change_password",
  ],
};

/* =========================================
   AUTH HELPERS
========================================= */

function getLoggedInUser() {
  try {
    return JSON.parse(
      sessionStorage.getItem("census_user") ||
        sessionStorage.getItem("user") ||
        "null"
    );
  } catch {
    return null;
  }
}

function getAuthToken() {
  return (
    sessionStorage.getItem("census_token") ||
    sessionStorage.getItem("token")
  );
}

function hasPermission(role, permission) {
  return Boolean(
    ROLE_PERMISSIONS[role]?.includes(permission)
  );
}

function getDefaultRoute(role) {
  if (role === "admin") return "/";
  if (role === "nodal_officer") return "/admin-units";
  if (role === "incharge_officer") return "/contacts";

  return "/login";
}

/* =========================================
   PROTECTED ROUTE
========================================= */

function ProtectedRoute({
  children,
  permission,
  roles,
}) {
  const user = getLoggedInUser();
  const token = getAuthToken();

  if (!token || !user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <Navigate
        to={getDefaultRoute(user.role)}
        replace
      />
    );
  }

  if (
    permission &&
    !hasPermission(user.role, permission)
  ) {
    return (
      <Navigate
        to={getDefaultRoute(user.role)}
        replace
      />
    );
  }

  return children;
}

/* =========================================
   ADMIN-ONLY ROUTE
========================================= */

function AdminOnly({ children }) {
  return (
    <ProtectedRoute roles={["admin"]}>
      {children}
    </ProtectedRoute>
  );
}

/* =========================================
   CHANGE PASSWORD PAGE
========================================= */

function ChangePasswordPage() {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError(
        "New password must be at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        "New password and confirm password do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const token = getAuthToken();

      if (!token) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      const response = await fetch(
        `${API}/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to change password."
        );
      }

      setMessage(
        data.message || "Password changed successfully."
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="change-password-page">
      <div className="change-password-card">
        <h2>Change Password</h2>

        <p>
          Enter your current password and choose a new password.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="currentPassword">
            Current Password
          </label>

          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) =>
              setCurrentPassword(event.target.value)
            }
            required
          />

          <label htmlFor="newPassword">
            New Password
          </label>

          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(event) =>
              setNewPassword(event.target.value)
            }
            required
          />

          <label htmlFor="confirmPassword">
            Confirm New Password
          </label>

          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            required
          />

          {error && (
            <p className="password-error">{error}</p>
          )}

          {message && (
            <p className="password-success">{message}</p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>

          <button
            type="button"
            className="password-cancel"
            onClick={() => navigate(-1)}
          >
            Back
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================
   AUTHENTICATED APP
========================================= */

function AuthenticatedApp() {
  const user = getLoggedInUser();

  if (!user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Navbar />

      <main>
        <Routes>
          {/* HOME: ADMIN ONLY */}
          <Route
            path="/"
            element={
              <AdminOnly>
                <Home />
              </AdminOnly>
            }
          />

          {/* ADMIN + NODAL OFFICER */}
          <Route
            path="/admin-units"
            element={
              <ProtectedRoute permission="administrative_units">
                <AdminUnits />
              </ProtectedRoute>
            }
          />

          {/* NEW: CIRCULARS & DOCUMENTS: ADMIN ONLY */}
          <Route
            path="/circulars-documents"
            element={
              <ProtectedRoute permission="circulars_documents">
                <CircularsDocuments />
              </ProtectedRoute>
            }
          />

          {/* CORRESPONDENCE */}
          <Route
            path="/correspondence"
            element={
              <Navigate
                to="/correspondence/circular-orig"
                replace
              />
            }
          />

          <Route
            path="/correspondence/circular-orig"
            element={
              <AdminOnly>
                <Circulars />
              </AdminOnly>
            }
          />

          <Route
            path="/correspondence/circular-dco"
            element={
              <AdminOnly>
                <Documents />
              </AdminOnly>
            }
          />

          <Route
            path="/correspondence/notification"
            element={
              <AdminOnly>
                <Notification />
              </AdminOnly>
            }
          />

          <Route
            path="/correspondence/letters"
            element={
              <AdminOnly>
                <Letters />
              </AdminOnly>
            }
          />
          <Route
  path="/pdf-upload"
  element={<PdfUpload />}
/>

          {/* TRAINING: ADMIN ONLY */}
          <Route
            path="/training"
            element={
              <AdminOnly>
                <Training />
              </AdminOnly>
            }
          />

          {/* DOWNLOAD: ADMIN ONLY */}
          <Route
            path="/download"
            element={
              <AdminOnly>
                <Download />
              </AdminOnly>
            }
          />

          {/* CONTACT OFFICERS */}
          <Route
            path="/contacts"
            element={
              <ProtectedRoute permission="contacts">
                <ContactOfficers />
              </ProtectedRoute>
            }
          />

          {/* USER MANAGEMENT: ADMIN ONLY */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute
                roles={["admin"]}
                permission="user_management"
              >
                <UserManagement />
              </ProtectedRoute>
            }
          />

          {/* OLD URL REDIRECT */}
          <Route
            path="/user-management"
            element={
              <Navigate to="/admin/users" replace />
            }
          />

          {/* CHANGE PASSWORD */}
          <Route
            path="/change-password"
            element={
              <ProtectedRoute permission="change_password">
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />

          {/* PASSWORD RESET REQUESTS: ADMIN ONLY */}
          <Route
            path="/admin/password-reset-requests"
            element={
              <ProtectedRoute roles={["admin"]}>
                <PasswordResetRequests />
              </ProtectedRoute>
            }
          />

          {/* UNKNOWN ROUTE */}
          <Route
            path="*"
            element={
              <Navigate
                to={getDefaultRoute(user.role)}
                replace
              />
            }
          />
        </Routes>
      </main>
    </>
  );
}

/* =========================================
   MAIN APP
========================================= */

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* PUBLIC LOGIN */}
        <Route
          path="/login"
          element={
            getAuthToken() && getLoggedInUser() ? (
              <Navigate
                to={getDefaultRoute(getLoggedInUser().role)}
                replace
              />
            ) : (
              <Login />
            )
          }
        />

        {/* PUBLIC FORGOT PASSWORD */}
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        {/* ALL OTHER PAGES REQUIRE LOGIN */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AuthenticatedApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
}
