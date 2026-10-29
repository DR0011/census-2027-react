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
  path.join(ROOT, "uploads", "documents"),
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

function makeFileName(documentNo, id) {
  const base = String(documentNo || `document-${id}`)
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || `document-${id}`}.pdf`;
}

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const fileCache = new Map();

// Search a folder tree for a file with this exact name
function searchByName(dir, name, depth = 0) {
  if (depth > 8) return null;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name === name) {
      return path.join(dir, entry.name);
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
      const found = searchByName(path.join(dir, entry.name), name, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Finds a local PDF from the value saved in the DB.
 * Handles: "file.pdf", "uploads/file.pdf", "/circulars/pdf/file.pdf",
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

  const fileName = path.basename(clean);

  const cached = fileCache.get(fileName);
  if (cached && fs.existsSync(cached)) return cached;

  const candidates = [];

  for (const root of PDF_ROOTS) {
    candidates.push(path.join(root, clean)); // full relative path
    candidates.push(path.join(root, fileName)); // filename only
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

  // Last try: search the whole project for this file name
  const found =
    searchByName(ROOT, fileName) ||
    searchByName(process.cwd(), fileName);

  if (found) {
    fileCache.set(fileName, found);
    console.log("PDF found at:", found);
    return found;
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
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT document_no, gujarati_pdf AS link
       FROM circulars_dco
       WHERE sr_no = ?`,
      [id]
    );

    if (!rows.length || !rows[0].link) {
      return res.status(404).json({ error: "PDF not found" });
    }

    const link = String(rows[0].link).trim();
    const fileName = makeFileName(rows[0].document_no, id);
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

/* ================= GET /api/documents ================= */

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

/* ================= PDF ROUTES ================= */

// View in browser:  /api/documents/view/:id
router.get("/view/:id", (req, res) => sendPdf(req, res, "inline"));

// Force download:   /api/documents/download/:id
router.get("/download/:id", (req, res) =>
  sendPdf(req, res, "attachment")
);

module.exports = router;
