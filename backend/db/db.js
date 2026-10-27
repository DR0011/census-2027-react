 require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, "..", "certs", "ca.pem")),
    rejectUnauthorized: true,
  },
  connectionLimit: 5,
});

module.exports = pool;



// const pool = mysql.createPool({
//   host: process.env.DB_HOST || "localhost",
//   port: Number(process.env.DB_PORT || 3306),
//   user: process.env.DB_USER || "root",
//   password: process.env.DB_PASSWORD || "",
//   database: process.env.DB_NAME || "census2027",

//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// pool
//   .getConnection()
//   .then((connection) => {
//     console.log("MySQL connected successfully!");
//     connection.release();
//   })
//   .catch((error) => {
//     console.error("MySQL connection failed:", error.message);
//   });

// module.exports = pool;
