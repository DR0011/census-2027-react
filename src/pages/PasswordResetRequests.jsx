import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PasswordResetRequests.css";

const API = "http://localhost:5000/api";

function getToken() {
  return (
    sessionStorage.getItem("census_token") ||
    sessionStorage.getItem("token") ||
    ""
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

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch(
        `${API}/password-reset/requests`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        sessionStorage.removeItem("census_token");
        sessionStorage.removeItem("census_user");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        navigate("/login", { replace: true });

        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "Only an administrator can view reset requests."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load requests."
        );
      }

      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message || "Unable to load requests.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function processRequest(requestId, action) {
    setError("");
    setMessage("");

    const newPassword = passwords[requestId] || "";

    if (action === "reset") {
      if (
        newPassword.length < 6 ||
        newPassword.length > 12 ||
        !/[a-z]/.test(newPassword) ||
        !/[A-Z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword)
      ) {
        setError(
          "Temporary password must be 6–12 characters and include uppercase, lowercase and a number."
        );
        return;
      }

      const confirmed = window.confirm(
        "Reset this user's password? Verify the user's identity first."
      );

      if (!confirmed) return;
    }

    if (action === "reject") {
      const confirmed = window.confirm(
        "Are you sure you want to reject this request?"
      );

      if (!confirmed) return;
    }

    setProcessingId(requestId);

    try {
      const token = getToken();

      if (!token) {
        navigate("/login", { replace: true });
        throw new Error(
          "Login token is not found. Please log in again."
        );
      }

      const response = await fetch(
        `${API}/password-reset/requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body:
            action === "reset"
              ? JSON.stringify({ newPassword })
              : JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        sessionStorage.removeItem("census_token");
        sessionStorage.removeItem("census_user");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        navigate("/login", { replace: true });

        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to process request."
        );
      }

      setMessage(
        data.message ||
          (action === "reset"
            ? "Password reset successfully."
            : "Request rejected.")
      );

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

      await loadRequests();
    } catch (err) {
      setError(
        err.message || "Unable to process request."
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="reset-requests-page">
      <div className="reset-requests-header">
        <div>
          <h2>Password Reset Requests</h2>
          <p>
            Review user requests and reset passwords after
            verifying the user's identity.
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
        <div className="reset-alert reset-alert-error">
          {error}
        </div>
      )}

      {message && (
        <div className="reset-alert reset-alert-success">
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
          <p>
            New password reset requests will appear here.
          </p>
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
              {requests.map((request, index) => (
                <tr key={request.request_id}>
                  <td>{index + 1}</td>
                  <td>{request.username}</td>
                  <td>{request.full_name || "-"}</td>
                  <td>{request.email}</td>
                  <td>{request.role}</td>
                  <td>
                    {request.requested_at
                      ? new Date(
                          request.requested_at
                        ).toLocaleString()
                      : "-"}
                  </td>
                  <td>
                    <div className="reset-password-input">
                      <input
                        type={
                          visiblePasswords[request.request_id]
                            ? "text"
                            : "password"
                        }
                        autoComplete="new-password"
                        placeholder="Set temporary password"
                        value={
                          passwords[request.request_id] || ""
                        }
                        onChange={(event) =>
                          setPasswords((previous) => ({
                            ...previous,
                            [request.request_id]:
                              event.target.value,
                          }))
                        }
                        disabled={
                          processingId === request.request_id
                        }
                      />

                      <button
                        type="button"
                        className="reset-show-password"
                        onClick={() =>
                          setVisiblePasswords((previous) => ({
                            ...previous,
                            [request.request_id]:
                              !previous[request.request_id],
                          }))
                        }
                        aria-label={
                          visiblePasswords[request.request_id]
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {visiblePasswords[request.request_id]
                          ? "Hide"
                          : "Show"}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="reset-action-buttons">
                      <button
                        type="button"
                        className="reset-action-button"
                        onClick={() =>
                          processRequest(
                            request.request_id,
                            "reset"
                          )
                        }
                        disabled={processingId !== null}
                      >
                        {processingId === request.request_id
                          ? "Processing..."
                          : "Reset Password"}
                      </button>

                      <button
                        type="button"
                        className="reject-action-button"
                        onClick={() =>
                          processRequest(
                            request.request_id,
                            "reject"
                          )
                        }
                        disabled={processingId !== null}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="reset-security-note">
        Verify the user's identity before resetting a password.
        Share the temporary password only through a secure channel.
      </p>
    </div>
  );
}
