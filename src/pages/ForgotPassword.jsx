
import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./ForgotPassword.css";
const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "").replace(/\/api$/, "");

export default function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/password-reset/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      setMessage(data.message);
      setUsername("");
      setEmail("");
    } catch (err) {
      setError(err.message || "Unable to submit request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="forgot-page">
      <section className="forgot-card">
        <div className="forgot-icon">🔐</div>

        <h2>Forgot Password?</h2>
        <p>
          Enter your Census 2027 username and registered email.
          An administrator will review your request.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={100}
            required
          />

          <label htmlFor="email">Registered Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
          />

          {message && (
            <div className="forgot-success" role="status">
              {message}
            </div>
          )}

          {error && (
            <div className="forgot-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </form>

        <Link to="/login" className="forgot-back">
          Back to Login
        </Link>
      </section>
    </main>
  );
}
