import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PasswordResetRequests.css";

const ROOT = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const API = `${ROOT}/api`;

const TOKEN_KEYS = ["census_token", "token"];
const SESSION_KEYS = ["census_token", "census_user", "token", "user"];

function getToken() {
  for (const store of [sessionStorage, localStorage]) {
    for (const key of TOKEN_KEYS) {
      const value = store.getItem(key);
      if (value) return value;
    }
  }
  return "";
}

function clearSession() {
  for (const store of [sessionStorage, localStorage]) {
    SESSION_KEYS.forEach((key) => store.removeItem(key));
  }
}

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

function isValidPassword(value) {
  return (
    value.length >= 6 &&
    value.length <= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

export default function PasswordResetRequests() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [passwords, setPasswords] = useState({});
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const goToLogin = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  /* ---------- load requests ---------- */

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        goToLogin();
        return;
      }

      const response = await fetch(`${API}/password-reset/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readJson(response);

      if (response.status === 401) {
        goToLogin();
        throw new Error("Your session has expired. Please log in again.");
      }

      if (response.status === 403) {
        throw new Error("Only an administrator can view reset requests.");
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Unable to load requests (${response.status}).`
        );
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (err) {
      setError(err.message || "Unable to load requests.");
    } finally {
      setLoading(false);
    }
  }, [goToLogin]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  /* ---------- reset / reject ---------- */

  const clearRowState = (requestId) => {
    setPasswords((previous) => {
      const updated = { ...previous };
      delete updated[requestId];
      return updated;
    });

    setVisiblePasswords((previous) => {
      const updated = { ...previous };
      delete updated[requestId];
      return updated;
    });
  };

  async function processRequest(requestId, action) {
    setError("");
    setMessage("");

    const newPassword = passwords[requestId] || "";

    if (action === "reset") {
      if (!isValidPassword(newPassword)) {
        setError(
          "Temporary password must be 6–12 characters and include uppercase, lowercase and a number."
        );
        return;
      }

      if (
        !window.confirm(
          "Reset this user's password? Verify the user's identity first."
        )
      ) {
        return;
      }
    }

    if (
      action === "reject" &&
      !window.confirm("Are you sure you want to reject this request?")
    ) {
      return;
    }

    setProcessingId(requestId);

    try {
      const token = getToken();

      if (!token) {
        goToLogin();
        throw new Error("Login token is not found. Please log in again.");
      }

      const response = await fetch(
        `${API}/password-reset/requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            action === "reset" ? { newPassword } : {}
          ),
        }
      );

      const data = await readJson(response);

      if (response.status === 401) {
        goToLogin();
        throw new Error("Your session has expired. Please log in again.");
      }

      if (response.status === 403) {
        throw new Error("Only an administrator can process requests.");
      }

      if (!response.ok) {
        throw new Error(
          data.message || `Unable to process request (${response.status}).`
        );
      }

      setMessage(
        data.message ||
          (action === "reset"
            ? "Password reset successfully."
            : "Request rejected.")
      );

      clearRowState(requestId);
      await loadRequests();
    } catch (err) {
      setError(err.message || "Unable to process request.");
    } finally {
      setProcessingId(null);
    }
  }

  const togglePasswordVisibility = (requestId) =>
    setVisiblePasswords((previous) => ({
      ...previous,
      [requestId]: !previous[requestId],
    }));

  const changePassword = (requestId, value) =>
    setPasswords((previous) => ({ ...previous, [requestId]: value }));

  /* ---------- render ---------- */

  return (
    <div className="reset-requests-page">
      <div className="reset-requests-header">
        <div>
          <h2>Password Reset Requests</h2>
          <p>
            Review user requests and reset passwords after verifying the
            user's identity.
          </p>
        </div>

        <div className="reset-header-actions">
          <button
            type="button"
            className="reset-back-button"
            onClick={() => navigate(-1)}
          >
            Back
          </button>

          <button
            type="button"
            className="reset-refresh-button"
            onClick={loadRequests}
            disabled={loading || processingId !== null}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="reset-alert reset-alert-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="reset-alert reset-alert-success" role="status">
          {message}
        </div>
      )}

      <div className="reset-requests-summary">
        Pending requests: {requests.length}
      </div>

      {loading ? (
        <div className="reset-empty-state">
          Loading password reset requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="reset-empty-state">
          <h3>No pending requests</h3>
          <p>New password reset requests will appear here.</p>
        </div>
      ) : (
        <div className="reset-table-wrapper">
          <table className="reset-requests-table">
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Requested At</th>
                <th>Temporary Password</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request, index) => {
                const id = request.request_id;
                const busy = processingId === id;

                return (
                  <tr key={id}>
                    <td>{index + 1}</td>
                    <td>{request.username}</td>
                    <td>{request.full_name || "-"}</td>
                    <td>{request.email || "-"}</td>
                    <td>{request.role || "-"}</td>
                    <td>
                      {request.requested_at
                        ? new Date(request.requested_at).toLocaleString()
                        : "-"}
                    </td>

                    <td>
                      <div className="reset-password-input">
                        <input
                          type={visiblePasswords[id] ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Set temporary password"
                          maxLength={12}
                          value={passwords[id] || ""}
                          onChange={(event) =>
                            changePassword(id, event.target.value)
                          }
                          disabled={busy}
                        />

                        <button
                          type="button"
                          className="reset-show-password"
                          onClick={() => togglePasswordVisibility(id)}
                          aria-label={
                            visiblePasswords[id]
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {visiblePasswords[id] ? "Hide" : "Show"}
                        </button>
                      </div>
                    </td>

                    <td>
                      <div className="reset-action-buttons">
                        <button
                          type="button"
                          className="reset-action-button"
                          onClick={() => processRequest(id, "reset")}
                          disabled={processingId !== null}
                        >
                          {busy ? "Processing..." : "Reset Password"}
                        </button>

                        <button
                          type="button"
                          className="reject-action-button"
                          onClick={() => processRequest(id, "reject")}
                          disabled={processingId !== null}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="reset-security-note">
        Verify the user's identity before resetting a password. Share the
        temporary password only through a secure channel.
      </p>
    </div>
  );
}
