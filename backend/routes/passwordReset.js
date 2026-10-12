
const express = require("express");
const bcrypt = require("bcryptjs");

const router = express.Router();

const db = require("../db/db");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/auth");

// ======================================================
// DATABASE HELPER
// Works with mysql2/promise pool
// ======================================================

async function query(sql, params = []) {
  const [result] = await db.execute(sql, params);
  return result;
}

// ======================================================
// PUBLIC: REQUEST PASSWORD RESET
// POST /api/password-reset/request
// ======================================================

router.post("/request", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (
      !username ||
      !email ||
      username.length > 100 ||
      email.length > 254
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid username and registered email.",
      });
    }

    const users = await query(
      `SELECT id
       FROM users
       WHERE username = ?
         AND LOWER(email) = ?
       LIMIT 1`,
      [username, email]
    );

    if (users.length > 0) {
      const userId = users[0].id;

      const existingRequests = await query(
        `SELECT id
         FROM password_reset_requests
         WHERE user_id = ?
           AND status = 'pending'
         LIMIT 1`,
        [userId]
      );

      if (existingRequests.length === 0) {
        await query(
          `INSERT INTO password_reset_requests
             (user_id, status)
           VALUES (?, 'pending')`,
          [userId]
        );
      }
    }

    // Same response whether the account matches or not.
    return res.status(200).json({
      success: true,
      message:
        "If the details match an account, your request has been recorded. Contact your Census 2027 administrator for assistance.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process the request. Try again later.",
    });
  }
});

// ======================================================
// ADMIN: LIST PENDING REQUESTS
// GET /api/password-reset/requests
// ======================================================

router.get(
  "/requests",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const requests = await query(
        `SELECT
           pr.id AS request_id,
           pr.status,
           pr.requested_at,
           u.id AS user_id,
           u.username,
           u.full_name,
           u.email,
           u.role
         FROM password_reset_requests pr
         INNER JOIN users u ON u.id = pr.user_id
         WHERE pr.status = 'pending'
         ORDER BY pr.requested_at ASC`
      );

      return res.status(200).json({
        success: true,
        requests,
      });
    } catch (error) {
      console.error("Loading reset requests error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load reset requests.",
      });
    }
  }
);

// ======================================================
// ADMIN: SET NEW PASSWORD
// POST /api/password-reset/requests/:id/reset
// Body: { "newPassword": "..." }
// ======================================================

router.post(
  "/requests/:id/reset",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const requestId = Number(req.params.id);
    const newPassword = String(req.body.newPassword || "");

    if (
      !Number.isSafeInteger(requestId) ||
      requestId < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    if (
      newPassword.length < 12 ||
      newPassword.length > 128 ||
      !/[a-z]/.test(newPassword) ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Use 12–128 characters with uppercase, lowercase and a number.",
      });
    }

    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [requests] = await connection.execute(
        `SELECT id, user_id
         FROM password_reset_requests
         WHERE id = ?
           AND status = 'pending'
         FOR UPDATE`,
        [requestId]
      );

      if (requests.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "Request not found or already processed.",
        });
      }

      const userId = requests[0].user_id;
      const passwordHash = await bcrypt.hash(newPassword, 12);

      const [userResult] = await connection.execute(
        `UPDATE users
         SET password_hash = ?
         WHERE id = ?`,
        [passwordHash, userId]
      );

      if (userResult.affectedRows === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "User account was not found.",
        });
      }

      await connection.execute(
        `UPDATE password_reset_requests
         SET status = 'completed',
             reviewed_at = CURRENT_TIMESTAMP,
             reviewed_by = ?
         WHERE id = ?
           AND status = 'pending'`,
        [req.user.id, requestId]
      );

      await connection.commit();

      return res.status(200).json({
        success: true,
        message:
          "Password reset successfully. Give the temporary password to the verified user through a secure channel.",
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      console.error("Admin password reset error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to reset the password.",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

// ======================================================
// ADMIN: REJECT REQUEST
// POST /api/password-reset/requests/:id/reject
// ======================================================

router.post(
  "/requests/:id/reject",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const requestId = Number(req.params.id);

    if (
      !Number.isSafeInteger(requestId) ||
      requestId < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    try {
      const result = await query(
        `UPDATE password_reset_requests
         SET status = 'rejected',
             reviewed_at = CURRENT_TIMESTAMP,
             reviewed_by = ?
         WHERE id = ?
           AND status = 'pending'`,
        [req.user.id, requestId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Request not found or already processed.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Password reset request rejected.",
      });
    } catch (error) {
      console.error("Reject request error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to reject the request.",
      });
    }
  }
);

module.exports = router;
