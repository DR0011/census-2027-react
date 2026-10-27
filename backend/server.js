require("dotenv").config();

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const pool = require("./db/db");

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://dcoofguj.netlify.app",
    ],
    credentials: true,
  })
);

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Census 2027 Backend API is running",
  });
});

// ======================================================
// TEMPORARY DB TEST (test pachi delete karo)
// ======================================================

app.get("/api/db-test", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ connected: true, rows });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// ======================================================
// ROUTES
// ======================================================

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use(
  "/api/administrative-units",
  require("./routes/administrativeUnits")
);
app.use("/api/circulars", require("./routes/circulars"));
app.use("/api/documents", require("./routes/documents"));
app.use("/api/pdfs", require("./routes/pdfUpload.routes"));
app.use("/api/password-reset", require("./routes/passwordReset"));

// Generic /:section router (sauthi chhelle)
app.use("/api", require("./routes/circularsDocuments"));

// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.error("Backend error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Census 2027 Backend running on port ${PORT}`);
});