const express = require("express");
const path = require("path");
const fs = require("fs");
const { Readable } = require("stream");

const router = express.Router();
const db = require("../db/db");

/* ================= LOCAL PDF FOLDERS ================= */

// Project root (parent of the routes folder)
const ROOT = path.join(__dirname, "..");

// Folders where PDFs may be stored. Add your upload folder here if different.
const PDF_ROOTS = [
  path.join(ROOT, "pdfs"),
  path.join(ROOT, "uploads"),
  path.join(ROOT, "uploads", "circulars"),
  path.join(ROOT, "public"),
  path.join(ROOT, "public", "pdfs"),
  path.join(ROOT, "public", "uploads"),
];

/* ================= HELPERS ================= */

function getDriveId(url) {
  const text = String(url || "");
  const m =
    text.match(/drive\.google\.com\/file\/d\/([\w-]+)/i) ||
    text.match(/[?&]id=([\w-]+)/i);
  return m ? m[1] : "";
}

function makeFileName(documentNo, id, lang) {
  const base = String(documentNo || `circular-${id}`)
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || `circular-${id}`}-${lang}.pdf`;
}

/**
 * Finds a local PDF from the value saved in the DB.
 * Handles: "file.pdf", "uploads/file.pdf", "/uploads/circulars/file.pdf",
 * "/api/uploads/file.pdf", Windows paths, URL-encoded names.
 */
function findLocalFile(link) {
  let clean = String(link || "").trim();

  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* keep as is */
  }

  clean = clean
    .replace(/\\/g, "/")
    .replace(/^\/?api\//i, "")
    .replace(/^\/+/, "");

  const candidates = [];

  for (const root of PDF_ROOTS) {
    candidates.push(path.join(root, clean)); // full relative path
    candidates.push(path.join(root, path.basename(clean))); // filename only
  }

  candidates.push(path.join(ROOT, clean)); // relative to project root

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);

    // security: file must stay inside the project folder
    if (!resolved.startsWith(path.resolve(ROOT))) continue;

    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }

  console.error("PDF not found. Link in DB:", link);
  console.error(
    "Tried:",
    candidates.map((c) => path.resolve(c))
  );

  return null;
}

/**
 * Shared handler for view (inline) and download (attachment).
 * mode = "inline" | "attachment"
 */
async function sendPdf(req, res, mode) {
  try {
    const { id, lang } = req.params;

    if (!["en", "hi"].includes(lang)) {
      return res.status(400).json({ error: "Invalid language" });
    }

    const column = lang === "en" ? "link_en" : "link_hi";

    const [rows] = await db.query(
      `SELECT document_no, ${column} AS link FROM circular_original WHERE id = ?`,
      [id]
    );

    if (!rows.length || !rows[0].link) {
      return res.status(404).json({ error: "PDF not found" });
    }

    const link = String(rows[0].link).trim();
    const fileName = makeFileName(rows[0].document_no, id, lang);
    const disposition = `${mode}; filename="${fileName}"`;

    /* ---------- Case 1: http/https link (Google Drive or other site) ---------- */
    if (/^https?:\/\//i.test(link)) {
      const driveId = getDriveId(link);

      const fileUrl = driveId
        ? `https://drive.google.com/uc?export=download&id=${driveId}`
        : link;

      const upstream = await fetch(fileUrl, { redirect: "follow" });

      if (!upstream.ok) {
        return res.status(502).json({ error: "Unable to fetch PDF" });
      }

      const contentType = upstream.headers.get("content-type") || "";

      // Drive returns an HTML page for big files (virus scan warning).
      // In that case send the user to Drive directly.
      if (contentType.includes("text/html")) {
        return res.redirect(fileUrl);
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", disposition);

      const length = upstream.headers.get("content-length");
      if (length) res.setHeader("Content-Length", length);

      return Readable.fromWeb(upstream.body).pipe(res);
    }

    /* ---------- Case 2: local file ---------- */
    const filePath = findLocalFile(link);

    if (!filePath) {
      return res.status(404).json({ error: "File not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", disposition);

    return res.sendFile(filePath);
  } catch (error) {
    console.error("PDF send error:", error);

    if (!res.headersSent) {
      return res.status(500).json({ error: "PDF request failed" });
    }
  }
}

/* ================= GET /api/circulars ================= */

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

/* ================= PDF ROUTES ================= */

// View in browser:  /api/circulars/view/:id/:lang
router.get("/view/:id/:lang", (req, res) =>
  sendPdf(req, res, "inline")
);

// Force download:   /api/circulars/download/:id/:lang
router.get("/download/:id/:lang", (req, res) =>
  sendPdf(req, res, "attachment")
);

module.exports = router;
