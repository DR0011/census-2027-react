const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db/db");

const administrativeUnits =
  require("./routes/administrativeUnits");

const app = express();

app.use(cors());
app.use(express.json());


// MySQL connection test
async function testDatabase() {
  try {
    const [rows] = await db.query("SELECT 1 AS test");

    console.log("================================");
    console.log("MySQL connected successfully");
    console.log(rows);
    console.log("================================");

  } catch (error) {
    console.error("================================");
    console.error("MYSQL CONNECTION ERROR");
    console.error(error);
    console.error("================================");
  }
}

testDatabase();


// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Census 2027 Backend API is running"
  });
});


// Administrative Units
app.use(
  "/api/administrative-units",
  administrativeUnits
);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});