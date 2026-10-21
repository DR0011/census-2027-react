import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./Login.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "").replace(/\/api$/, "");

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!username.trim() || !password) {
      setError("Please enter username and password");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }

      // IMPORTANT:
      // App.jsx uses these exact localStorage keys
     sessionStorage.setItem("census_token", data.token);
sessionStorage.setItem("census_user", JSON.stringify(data.user));

      // Role comes from database/JWT
      // No role selection is required on Login page.
      let destination = "/";

      if (data.user.role === "admin") {
        destination = "/";
      } else if (data.user.role === "nodal_officer") {
        destination = "/admin-units";
      } else if (data.user.role === "incharge_officer") {
        destination = "/contacts";
      } else {
        throw new Error("Invalid user role");
      }

      navigate(destination, { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      setError(error.message || "Unable to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-header">
          <h1>Census 2027</h1>

          <p>
            Government of India
          </p>
        </div>

        <form onSubmit={handleLogin}>

          <div className="form-group">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="Enter username"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-button"
          >
            {loading ? "Logging in..." : "Login"}
          </button>


        </form>

        <button
          type="button"
          className="forgot-button"
          onClick={() => navigate("/forgot-password")}
          disabled={loading}
        >
          Forgot Password?
        </button>

      </div>
    </div>
  );
}

export default Login;