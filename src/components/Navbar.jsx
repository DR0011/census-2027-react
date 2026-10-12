
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

  // Read logged-in user from localStorage
  const user = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("census_user") ||
          localStorage.getItem("user") ||
          "{}"
      );
    } catch {
      return {};
    }
  })();

  // Logout
  const logout = () => {
    localStorage.removeItem("census_token");
    localStorage.removeItem("census_user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  };

  // Format role name
  const formatRole = (role) => {
    if (role === "admin") return "Admin";
    if (role === "nodal_officer") return "Nodal Officer";
    if (role === "incharge_officer") return "Incharge Officer";

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

  return (
    <nav className="navbar">
      {/* BRAND */}
      <div
        className="navbar-brand"
        aria-label="Census 2027"
      >
        <span className="brand-icon">🏛️</span>
        <span>Census 2027</span>
      </div>

      {/* NAVIGATION LINKS */}
      <div className="navbar-links">
        {/* HOME: ADMIN ONLY */}
        {user.role === "admin" && (
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
          >
            Home
          </NavLink>
        )}

        {/* ADMIN + NODAL OFFICER */}
        {(user.role === "admin" ||
          user.role === "nodal_officer") && (
          <NavLink
            to="/admin-units"
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
          >
            Administrative Units
          </NavLink>
        )}

        {/* CORRESPONDENCE: ADMIN ONLY */}
        {user.role === "admin" && (
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
              Correspondence
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

        {/* TRAINING: ADMIN ONLY */}
        {user.role === "admin" && (
          <NavLink
            to="/training"
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
          >
            Training
          </NavLink>
        )}

        {/* DOWNLOAD: ADMIN ONLY */}
        {user.role === "admin" && (
          <NavLink
            to="/download"
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
          >
            Download
          </NavLink>
        )}

        {/* ADMIN + INCHARGE OFFICER */}
        {(user.role === "admin" ||
          user.role === "incharge_officer") && (
          <NavLink
            to="/contacts"
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
          >
            Contact Officers
          </NavLink>
        )}

        {/* USER MANAGEMENT: ADMIN ONLY */}
        {user.role === "admin" && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
          >
            User Management
          </NavLink>
        )}

        {/* PASSWORD RESET REQUESTS: ADMIN ONLY */}
        {user.role === "admin" && (
          <NavLink
            to="/admin/password-reset-requests"
            className={({ isActive }) =>
              isActive
                ? "navbar-link active"
                : "navbar-link"
            }
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
            {user.role === "admin" && (
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
            {user.role === "admin" && (
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
