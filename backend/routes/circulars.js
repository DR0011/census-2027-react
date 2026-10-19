const express = require("express");
const router = express.Router();
const db = require("../db/db");

// GET /api/circulars
router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT
        id,
        sr_no AS srNo,
        document_no AS documentNo,
        reference_no_en AS referenceNoEn,
        reference_no_hi AS referenceNoHi,
        DATE_FORMAT(circular_date, '%d/%m/%Y') AS date,
        description_en AS descriptionEn,
        description_hi AS descriptionHi,
        link_en AS englishPdf,
        link_hi AS hindiPdf,
        doc_type AS docType
      FROM circular_original
      ORDER BY circular_date DESC, id DESC
    `;

    const [rows] = await db.query(sql);

    const data = rows.map((row) => ({
      id: row.id,
      srNo: row.srNo ?? "",
      documentNo: row.documentNo || "",
      referenceNo: row.referenceNoEn || row.referenceNoHi || "",
      referenceNoHi: row.referenceNoHi || "",
      date: row.date || "",
      descriptionEn: row.descriptionEn || "",
      descriptionHi: row.descriptionHi || "",
      englishPdf: row.englishPdf || "",
      hindiPdf: row.hindiPdf || "",
      docType: row.docType || "",
    }));

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Circulars API error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to fetch circulars from database.",
    });
  }
});

module.exports = router;