
const express = require("express");
const router = express.Router();
const db = require("../db/db");

// GET: All documents
router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT
        sr_no AS id,
        document_no AS documentNo,
        reference_no AS referenceNo,
        DATE_FORMAT(circular_date, '%d/%m/%Y') AS date,
        description_gu AS description,
        circular_type AS type,
        gujarati_pdf AS pdf
      FROM circulars_dco
      ORDER BY sr_no ASC
    `;

    const [rows] = await db.query(sql);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Documents API error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to fetch documents from database.",
    });
  }
});

module.exports = router;
