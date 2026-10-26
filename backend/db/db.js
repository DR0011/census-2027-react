
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

// Validate required environment variables before creating the pool
const requiredVars = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
];

const missingVars = requiredVars.filter(
  (key) => !process.env[key] || !process.env[key].trim()
);

if (missingVars.length > 0) {
  throw new Error(
    `Missing database environment variables: ${missingVars.join(", ")}`
  );
}

const caPath = path.join(__dirname, "../certs/ca.pem");

if (!fs.existsSync(caPath)) {
  throw new Error(`Aiven CA certificate not found: ${caPath}`);
}

const host = process.env.DB_HOST.trim();
const port = Number(process.env.DB_PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("DB_PORT must be a valid port number");
}

console.log("MySQL configuration:", {
  host,
  port,
  database: process.env.DB_NAME,
  ssl: "enabled",
});

const pool = mysql.createPool({
  host,
  port,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: {
    ca: fs.readFileSync(caPath, "utf8"),
    rejectUnauthorized: true,
  },

  connectTimeout: 15000,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

pool.on("error", (err) => {
  console.error("MySQL pool error:", err.code, err.message);
});

// Test the connection without printing credentials
pool.getConnection()
  .then((connection) => {
    console.log("MySQL connection successful");
    connection.release();
  })
  .catch((err) => {
    console.error(
      "MySQL connection test failed:",
      err.code,
      err.message
    );
  });

module.exports = pool;
