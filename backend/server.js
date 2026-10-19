
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const compression = require("compression");

const app = express();

const PORT = process.env.PORT || 5000;

// ======================================================
// CORS
// ======================================================

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// ======================================================
// MIDDLEWARE
// ======================================================

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
// AUTH ROUTES
// POST /api/auth/login
// ======================================================

const authRoutes = require("./routes/auth");

app.use("/api/auth", authRoutes);

// ======================================================
// USER MANAGEMENT ROUTES
// ======================================================

const userRoutes = require("./routes/users");

app.use("/api/users", userRoutes);

// ======================================================
// ADMINISTRATIVE UNITS ROUTES
// ======================================================

const administrativeUnitsRoutes = require(
  "./routes/administrativeUnits"
);

app.use(
  "/api/administrative-units",
  administrativeUnitsRoutes
);
const circularsRouter = require("./routes/circulars");

app.use("/api/circulars", circularsRouter);

const documentsRoutes = require("./routes/documents");
app.use("/api/documents", documentsRoutes);
const pdfUploadRoutes = require("./routes/pdfUpload.routes");

app.use("/api/pdfs", pdfUploadRoutes);
// ======================================================
// PASSWORD RESET ROUTES
// POST /api/password-reset/request
// GET  /api/password-reset/requests
// POST /api/password-reset/requests/:id/reset
// POST /api/password-reset/requests/:id/reject
// ======================================================

const passwordResetRoutes = require(
  "./routes/passwordReset"
);

app.use(
  "/api/password-reset",
  passwordResetRoutes
);

const circularsDocumentsRoutes = require(
  "./routes/circularsDocuments"
);

app.use("/api", circularsDocumentsRoutes);

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

app.listen(PORT, () => {
  console.log(
    `Census 2027 Backend running on http://localhost:${PORT}`
  );
});
