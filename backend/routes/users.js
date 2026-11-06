const express = require("express");
const bcrypt = require("bcryptjs");

const router = express.Router();

const db = require("../db/db");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/auth");

const ALLOWED_ROLES = ["admin", "nodal_officer", "incharge_officer"];

const USER_COLUMNS = `
  id,
  username,
  full_name,
  email,
  role,
  created_at,
  updated_at
`;

// ======================================================
// ALL USER MANAGEMENT ROUTES ARE ADMIN ONLY
// ======================================================

router.use(authenticateToken);
router.use(requireAdmin);

// Never let the browser cache user data
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Helper: which database is this server really using?
const logDbInfo = async (label) => {
  try {
    const [rows] = await db.query(
      "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port"
    );
    console.log(`[${label}] DB:`, rows[0]);
  } catch (err) {
    console.error("DB INFO ERROR:", err.message);
  }
};

// ======================================================
// DEBUG: SHOW WHICH DATABASE THE APP USES (admin only)
// GET /api/users/debug/db
// Remove after you finish checking.
// ======================================================

router.get("/debug/db", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port"
    );
    res.json({ success: true, ...rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================================================
// GET ALL USERS
// GET /api/users
// ======================================================

router.get("/", async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT ${USER_COLUMNS} FROM users ORDER BY id ASC`
    );

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch users",
    });
  }
});

// ======================================================
// GET SINGLE USER
// GET /api/users/:id
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error("GET USER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch user",
    });
  }
});

// ======================================================
// ADD USER
// POST /api/users
// ======================================================

router.post("/", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const full_name = String(req.body.full_name || "").trim();
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");
    const role = req.body.role;

    if (!username || !full_name || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Username, full name, password and role are required",
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check username
    const [existingUsername] = await db.query(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    if (existingUsername.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Check email
    if (email) {
      const [existingEmail] = await db.query(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email]
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `
      INSERT INTO users (username, full_name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
      `,
      [username, full_name, email || null, passwordHash, role]
    );

    await logDbInfo("ADD USER");
    console.log("INSERT insertId:", result.insertId);

    const [created] = await db.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      userId: result.insertId,
      user: created[0] || null,
    });
  } catch (error) {
    console.error("ADD USER ERROR:", error);

    // Safety net if two requests race past the duplicate checks
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Unable to create user",
    });
  }
});

// ======================================================
// UPDATE USER
// PUT /api/users/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const username = String(req.body.username || "").trim();
    const full_name = String(req.body.full_name || "").trim();
    const email = String(req.body.email || "").trim();
    const password = req.body.password ? String(req.body.password) : "";
    const role = req.body.role;

    if (!username || !full_name || !role) {
      return res.status(400).json({
        success: false,
        message: "Username, full name and role are required",
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // Check user exists
    const [users] = await db.query(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Do not let admin remove own admin role
    if (userId === Number(req.user.id) && role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove admin role from your own account",
      });
    }

    // Username duplicate check
    const [duplicateUsername] = await db.query(
      "SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1",
      [username, userId]
    );

    if (duplicateUsername.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Email duplicate check
    if (email) {
      const [duplicateEmail] = await db.query(
        "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
        [email, userId]
      );

      if (duplicateEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    let result;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);

      [result] = await db.query(
        `
        UPDATE users
        SET username = ?, full_name = ?, email = ?, password_hash = ?, role = ?
        WHERE id = ?
        `,
        [username, full_name, email || null, passwordHash, role, userId]
      );
    } else {
      [result] = await db.query(
        `
        UPDATE users
        SET username = ?, full_name = ?, email = ?, role = ?
        WHERE id = ?
        `,
        [username, full_name, email || null, role, userId]
      );
    }

    // Prove the change happened, and show which database was written to
    await logDbInfo("UPDATE USER");
    console.log(
      "UPDATE affectedRows:",
      result.affectedRows,
      "changedRows:",
      result.changedRows
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found, nothing was updated",
      });
    }

    // Read the row back from the database and return it
    const [updated] = await db.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    res.json({
      success: true,
      message: "User updated successfully",
      user: updated[0] || null,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Unable to update user",
    });
  }
});

// ======================================================
// DELETE USER
// DELETE /api/users/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (userId === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const [users] = await db.query(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If deleting an admin, make sure another admin exists
    if (users[0].role === "admin") {
      const [admins] = await db.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"
      );

      if (Number(admins[0].count) <= 1) {
        return res.status(400).json({
          success: false,
          message: "At least one admin account must remain",
        });
      }
    }

    const [result] = await db.query("DELETE FROM users WHERE id = ?", [
      userId,
    ]);

    console.log("DELETE affectedRows:", result.affectedRows);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete user",
    });
  }
});

module.exports = router;
