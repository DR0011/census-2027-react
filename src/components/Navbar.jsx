import React, { useEffect, useState } from "react";
import {
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [correspondenceOpen, setCorrespondenceOpen] =
    useState(false);

  const [userMenuOpen, setUserMenuOpen] =
    useState(false);

  // Read logged-in user from sessionStorage/localStorage
  const user = (() => {
    try {
      return (
        JSON.parse(
          sessionStorage.getItem("census_user") ||
            localStorage.getItem("census_user") ||
            sessionStorage.getItem("user") ||
            localStorage.getItem("user") ||
            "null"
        ) || {}
      );
    } catch {
      return {};
    }
  })();

  const isAdmin = user.role === "admin";
  const isOfficer =
    user.role === "nodal_officer" ||
    user.role === "incharge_officer";

  // Home route for the brand click
  const homeRoute = isAdmin ? "/" : "/admin-units";

  // LOGOUT
  const logout = () => {
    [
      "census_token",
      "census_user",
      "token",
      "user",
    ].forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });

    setUserMenuOpen(false);
    setCorrespondenceOpen(false);

    navigate("/login", { replace: true });
  };

  // Format role name
  const formatRole = (role) => {
    if (role === "admin") return "Admin";
    if (role === "nodal_officer") return "Nodal Officer";

    if (role === "incharge_officer") {
      return "Incharge Officer";
    }

    return "User";
  };

  // Correspondence submenu links
  const correspondenceLinks = [
    {
      label: "Circular (ORGI)",
      path: "/correspondence/circular-orig",
    },
    {
      label: "Circular (DCO)",
      path: "/correspondence/circular-dco",
    },
    {
      label: "Notification",
      path: "/correspondence/notification",
    },
    {
      label: "Letter",
      path: "/correspondence/letters",
    },
  ];

  // Close dropdowns when route changes
  useEffect(() => {
    setCorrespondenceOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }) =>
    isActive ? "navbar-link active" : "navbar-link";

  return (
    <nav className="navbar">
      {/* BRAND: CLICK TO OPEN ROLE'S HOME PAGE */}
      <div
        className="navbar-brand"
        onClick={() => navigate(homeRoute)}
        role="button"
        tabIndex={0}
        aria-label="Census 2027 Home"
        style={{ cursor: "pointer" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(homeRoute);
          }
        }}
      >
        <span className="brand-icon">🏛️</span>
        <span>Census 2027</span>
      </div>

      {/* NAVIGATION LINKS */}
      <div className="navbar-links">
        {/* HOME: ADMIN ONLY */}
        {isAdmin && (
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
        )}

        {/* ADMINISTRATIVE UNITS: ADMIN + OFFICERS */}
        {(isAdmin || isOfficer) && (
          <NavLink
            to="/admin-units"
            className={navLinkClass}
          >
            Administrative Units
          </NavLink>
        )}

        {/* CIRCULARS & DOCUMENTS: ADMIN ONLY */}
        {isAdmin && (
          <NavLink
            to="/circulars-documents"
            className={navLinkClass}
          >
            Circulars &amp; Documents
          </NavLink>
        )}

        {/* PDF UPLOAD: ADMIN ONLY */}
        {isAdmin && (
          <NavLink
            to="/pdf-upload"
            className={navLinkClass}
          >
            📄 PDF Upload
          </NavLink>
        )}

        {/* CORRESPONDENCE: ADMIN + OFFICERS */}
        {(isAdmin || isOfficer) && (
          <div className="navbar-dropdown">
            <button
              type="button"
              className={`navbar-link dropdown-toggle ${
                correspondenceOpen ? "active" : ""
              }`}
              onClick={() =>
                setCorrespondenceOpen((open) => !open)
              }
              aria-expanded={correspondenceOpen}
            >
              Correspondence{" "}
              <span className="arrow">▾</span>
            </button>

            {correspondenceOpen && (
              <div className="navbar-dropdown-menu">
                {correspondenceLinks.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      isActive
                        ? "dropdown-link active"
                        : "dropdown-link"
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRAINING: ADMIN + OFFICERS */}
        {(isAdmin || isOfficer) && (
          <NavLink
            to="/training"
            className={navLinkClass}
          >
            Training
          </NavLink>
        )}

        {/* DOWNLOAD: ADMIN + OFFICERS */}
        {(isAdmin || isOfficer) && (
          <NavLink
            to="/download"
            className={navLinkClass}
          >
            Download
          </NavLink>
        )}

        {/* CONTACT OFFICERS: ADMIN + OFFICERS */}
        {(isAdmin || isOfficer) && (
          <NavLink
            to="/contacts"
            className={navLinkClass}
          >
            Contact Officers
          </NavLink>
        )}

        {/* USER MANAGEMENT: ADMIN ONLY */}
        {isAdmin && (
          <NavLink
            to="/admin/users"
            className={navLinkClass}
          >
            User Management
          </NavLink>
        )}

        {/* PASSWORD RESET REQUESTS: ADMIN ONLY */}
        {isAdmin && (
          <NavLink
            to="/admin/password-reset-requests"
            className={navLinkClass}
          >
            Password Reset Requests
          </NavLink>
        )}
      </div>

      {/* USER MENU */}
      <div className="user-menu">
        <button
          type="button"
          className="user-menu-toggle"
          onClick={() =>
            setUserMenuOpen((open) => !open)
          }
          aria-expanded={userMenuOpen}
        >
          <span className="user-icon">👤</span>

          <span>
            {user.full_name || user.username || "User"}
          </span>

          <span className="role-label">
            ({formatRole(user.role)})
          </span>

          <span>▾</span>
        </button>

        {userMenuOpen && (
          <div className="user-dropdown">
            <div className="user-dropdown-info">
              <strong>
                {user.full_name || user.username || "User"}
              </strong>

              <span>{formatRole(user.role)}</span>
            </div>

            {/* CHANGE PASSWORD */}
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                navigate("/change-password");
              }}
            >
              🔑 Change Password
            </button>

            {/* USER MANAGEMENT */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate("/admin/users");
                }}
              >
                👥 User Management
              </button>
            )}

            {/* PASSWORD RESET REQUESTS */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate("/admin/password-reset-requests");
                }}
              >
                🔐 Password Reset Requests
              </button>
            )}

            {/* LOGOUT */}
            <button
              type="button"
              className="logout-button"
              onClick={logout}
            >
              ↪ Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
