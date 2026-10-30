const express = require("express");
const router = express.Router();
const db = require("../db/db");

const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { v2: cloudinary } = require("cloudinary");

const TYPE_ORGI = "Circular(ORGI)";
const TYPE_DCO = "Circular(DCO)";

/* ================= CLOUDINARY ================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function cloudinaryReady() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/*
 * Old PDFs (uploaded before Cloudinary) were saved on local disk here.
 * This folder is only used to serve / delete those old files.
 */
const UPLOAD_DIR = path.resolve(
  process.cwd(),
  "uploads",
  "circular-pdfs"
);

const configs = {
  circulars: {
    table: "circular_original",
    key: "id",
    defaultType: TYPE_ORGI,
    fields: [
      "document_no",
      "reference_no_en",
      "reference_no_hi",
      "circular_date",
      "description_en",
      "description_hi",
      "link_en",
      "link_hi",
      "doc_type",
    ],
    pdfFields: ["link_en", "link_hi"],
  },

  documents: {
    table: "circulars_dco",
    key: "sr_no",
    defaultType: TYPE_DCO,
    fields: [
      "document_no",
      "reference_no",
      "circular_date",
      "description_gu",
      "gujarati_pdf",
      "circular_type",
    ],
    pdfFields: ["gujarati_pdf"],
  },
};

// Files are kept in memory, then sent to Cloudinary.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 3,
  },
  fileFilter: (_req, file, callback) => {
    const isPdfExtension = /\.pdf$/i.test(file.originalname);
    const isPdfMime =
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/octet-stream";

    if (!isPdfExtension || !isPdfMime) {
      const error = new Error("Only PDF files are allowed.");
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  },
});

function getConfig(section) {
  return Object.prototype.hasOwnProperty.call(configs, section)
    ? configs[section]
    : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  return text || null;
}

function normalizeType(value, fallback) {
  const text = normalizeText(value);

  if (!text) return fallback;
  if (text.toUpperCase() === "ORGI") return TYPE_ORGI;
  if (text.toUpperCase() === "DCO") return TYPE_DCO;

  return text;
}

function isValidDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDate(value) {
  const text = normalizeText(value);
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return isValidDate(text) ? text : null;
  }

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];
  const date = `${year}-${month}-${day}`;

  return isValidDate(date) ? date : null;
}

function formatDate(value) {
  if (!value) return "";

  if (value instanceof Date) {
    const day = String(value.getUTCDate()).padStart(2, "0");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");

    return `${day}/${month}/${value.getUTCFullYear()}`;
  }

  const text = String(value).slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

function validateId(id) {
  const text = String(id ?? "").trim();

  return (
    /^[1-9]\d*$/.test(text) &&
    Number.isSafeInteger(Number(text))
  );
}

function getRowId(row, key = "id") {
  if (!row) return null;

  if (row[key] !== undefined && row[key] !== null) {
    return row[key];
  }

  const wanted = String(key).toLowerCase();
  const actualKey = Object.keys(row).find(
    (item) => item.toLowerCase() === wanted
  );

  return actualKey ? row[actualKey] ?? null : null;
}

function fileList(req) {
  return Object.values(req.files || {}).flat();
}

/* ================= CLOUDINARY FILE HELPERS ================= */

function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "census-2027/circulars",
        public_id: crypto.randomUUID(),
        resource_type: "image", // Cloudinary stores PDFs as the image type
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );

    stream.end(file.buffer);
  });
}

// Upload every selected file and remember its public link
async function attachCloudUrls(req) {
  try {
    for (const file of fileList(req)) {
      const result = await uploadToCloudinary(file);
      file.cloudUrl = result.secure_url;
      file.cloudId = result.public_id;
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error);

    const wrapped = new Error("PDF upload failed.");
    wrapped.userMessage = `PDF upload failed: ${
      error?.message || "Cloudinary error"
    }`;
    throw wrapped;
  }
}

function cloudPublicId(url) {
  const match = String(url || "").match(
    /res\.cloudinary\.com\/.+?\/image\/upload\/(?:v\d+\/)?(.+?)\.pdf$/i
  );

  return match ? match[1] : null;
}

// Used when saving fails after files were already uploaded to Cloudinary
async function removeFiles(files = []) {
  await Promise.all(
    files.map(async (file) => {
      if (!file?.cloudId) return;

      try {
        await cloudinary.uploader.destroy(file.cloudId, {
          resource_type: "image",
        });
      } catch (error) {
        console.error("Could not remove cloud file:", error.message);
      }
    })
  );
}

function localStoredFilename(value) {
  const text = String(value ?? "").trim();

  // Old files generated by the previous local-disk upload.
  const match = text.match(
    /^\/circulars\/pdf\/([A-Za-z0-9-]+\.pdf)$/i
  );

  return match ? match[1] : null;
}

async function removeStoredPdf(value) {
  // New files: delete from Cloudinary
  const publicId = cloudPublicId(value);

  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      });
    } catch (error) {
      console.error("Could not delete stored PDF:", error.message);
    }

    return;
  }

  // Old files: delete from local disk
  const filename = localStoredFilename(value);
  if (!filename) return;

  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, filename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not delete stored PDF:", error.message);
    }
  }
}

function validatePdfSignatures(req) {
  for (const file of fileList(req)) {
    const header = file.buffer
      ? file.buffer.subarray(0, 5).toString("ascii")
      : "";

    if (header !== "%PDF-") {
      return `The selected file "${file.originalname}" is not a valid PDF.`;
    }
  }

  return null;
}

function validate(data) {
  if (!data.document_no) {
    return "Document number is required.";
  }

  if (!data.circular_date) {
    return "Date is required.";
  }

  if (!isValidDate(data.circular_date)) {
    return "Enter a valid date.";
  }

  return null;
}

function uploadedPath(file) {
  return file?.cloudUrl || null;
}

function normalizeBody(section, body = {}, files = {}) {
  const circularDate = parseDate(
    body.circular_date ??
      body.circularDate ??
      body.date ??
      body.document_date
  );

  if (section === "circulars") {
    return {
      document_no: normalizeText(body.document_no ?? body.documentNo),

      reference_no_en: normalizeText(
        body.reference_no_en ??
          body.referenceNoEn ??
          body.referenceNo ??
          body.reference_no
      ),

      reference_no_hi: normalizeText(
        body.reference_no_hi ?? body.referenceNoHi
      ),

      circular_date: circularDate,

      description_en: normalizeText(
        body.description_en ?? body.descriptionEn
      ),

      description_hi: normalizeText(
        body.description_hi ?? body.descriptionHi
      ),

      link_en:
        uploadedPath(files.english_pdf) ??
        normalizeText(body.link_en ?? body.englishPdf ?? body.pdf_url),

      link_hi:
        uploadedPath(files.hindi_pdf) ??
        normalizeText(body.link_hi ?? body.hindiPdf),

      doc_type: normalizeType(
        body.doc_type ??
          body.docType ??
          body.circular_type ??
          body.type,
        TYPE_ORGI
      ),
    };
  }

  return {
    document_no: normalizeText(body.document_no ?? body.documentNo),

    reference_no: normalizeText(
      body.reference_no ?? body.referenceNo
    ),

    circular_date: circularDate,

    description_gu: normalizeText(
      body.description_gu ??
        body.descriptionGu ??
        body.gujarati_description ??
        body.gujaratiDescription ??
        body.description ??
        body.Description
    ),

    gujarati_pdf:
      uploadedPath(files.gujarati_pdf_file) ??
      normalizeText(
        body.gujarati_pdf ??
          body.gujaratiPdf ??
          body.gujaratiPDF ??
          body.gujarati_pdf_url ??
          body.pdf_url_gu ??
          body.pdfUrl ??
          body.pdf_url ??
          body["Gujarati PDF"] ??
          body["Gujarati Pdf"] ??
          body["PDF Link"]
      ),

    circular_type: normalizeType(
      body.circular_type ??
        body.circularType ??
        body.docType ??
        body.document_type ??
        body.type,
      TYPE_DCO
    ),
  };
}

function mapRecord(section, row, key = "id") {
  const recordId = getRowId(row, key);

  if (section === "circulars") {
    return {
      id: recordId,
      sr_no: row.sr_no ?? "",
      srNo: row.sr_no ?? "",
      document_no: row.document_no ?? "",
      documentNo: row.document_no ?? "",
      reference_no_en: row.reference_no_en ?? "",
      referenceNoEn: row.reference_no_en ?? "",
      reference_no_hi: row.reference_no_hi ?? "",
      referenceNoHi: row.reference_no_hi ?? "",
      circular_date: row.circular_date,
      date: formatDate(row.circular_date),
      description_en: row.description_en ?? "",
      descriptionEn: row.description_en ?? "",
      description_hi: row.description_hi ?? "",
      descriptionHi: row.description_hi ?? "",
      link_en: row.link_en ?? "",
      englishPdf: row.link_en ?? "",
      link_hi: row.link_hi ?? "",
      hindiPdf: row.link_hi ?? "",
      doc_type: normalizeType(row.doc_type, TYPE_ORGI),
      docType: normalizeType(row.doc_type, TYPE_ORGI),
    };
  }

  const circularType = normalizeType(row.circular_type, TYPE_DCO);

  return {
    id: recordId,
    sr_no: row.sr_no ?? "",
    srNo: row.sr_no ?? "",
    document_no: row.document_no ?? "",
    documentNo: row.document_no ?? "",
    reference_no: row.reference_no ?? "",
    referenceNo: row.reference_no ?? "",
    circular_date: row.circular_date,
    date: formatDate(row.circular_date),
    description_gu: row.description_gu ?? "",
    descriptionGu: row.description_gu ?? "",
    gujarati_pdf: row.gujarati_pdf ?? "",
    gujaratiPdf: row.gujarati_pdf ?? "",
    circular_type: circularType,
    circularType,
    docType: circularType,
  };
}

function sendServerError(res, message) {
  return res.status(500).json({ message });
}

/*
 * Upload fields:
 * ORGI: english_pdf, hindi_pdf
 * DCO:  gujarati_pdf_file
 */
const uploadFields = upload.fields([
  { name: "english_pdf", maxCount: 1 },
  { name: "hindi_pdf", maxCount: 1 },
  { name: "gujarati_pdf_file", maxCount: 1 },
]);

/*
 * Serve an OLD uploaded PDF (saved on local disk before Cloudinary).
 * Example:
 * GET /api/circulars/pdf/filename.pdf
 *
 * This route must be before the generic GET /:section/:id route.
 */
router.get("/:section/pdf/:filename", async (req, res) => {
  const { section, filename } = req.params;

  if (!["circulars", "documents"].includes(section)) {
    return res.status(404).json({ message: "PDF not found." });
  }

  if (!/^[A-Za-z0-9-]+\.pdf$/i.test(filename)) {
    return res.status(400).json({ message: "Invalid PDF filename." });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    await fs.promises.access(filePath, fs.constants.R_OK);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.sendFile(filePath);
  } catch {
    return res.status(404).json({ message: "PDF file not found." });
  }
});

// GET /api/circulars and GET /api/documents
router.get("/:section", async (req, res) => {
  const { section } = req.params;
  const config = getConfig(section);

  if (!config) {
    return res.status(404).json({ message: "Section not found." });
  }

  try {
    const [rows] = await db.execute(
      `SELECT *
       FROM \`${config.table}\`
       ORDER BY \`${config.key}\` DESC`
    );

    res.set("Cache-Control", "no-store");
    return res.json(
      rows.map((row) => mapRecord(section, row, config.key))
    );
  } catch (error) {
    console.error(`List ${section} records error:`, error);
    return sendServerError(res, "Unable to load records.");
  }
});

// GET /api/circulars/:id and GET /api/documents/:id
router.get("/:section/:id", async (req, res) => {
  const { section, id } = req.params;
  const config = getConfig(section);

  if (!config) {
    return res.status(404).json({ message: "Section not found." });
  }

  if (!validateId(id)) {
    return res.status(400).json({ message: "Invalid record ID." });
  }

  try {
    const [rows] = await db.execute(
      `SELECT *
       FROM \`${config.table}\`
       WHERE \`${config.key}\` = ?`,
      [Number(id)]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Record not found." });
    }

    return res.json(mapRecord(section, rows[0], config.key));
  } catch (error) {
    console.error(`Get ${section} record error:`, error);
    return sendServerError(res, "Unable to load record.");
  }
});

// POST /api/circulars and POST /api/documents
router.post("/:section", uploadFields, async (req, res) => {
  const { section } = req.params;
  const config = getConfig(section);
  const files = req.files || {};

  if (!config) {
    return res.status(404).json({ message: "Section not found." });
  }

  try {
    const signatureError = validatePdfSignatures(req);

    if (signatureError) {
      return res.status(400).json({ message: signatureError });
    }

    // Validate the text fields before uploading anything to Cloudinary.
    const validationError = validate(normalizeBody(section, req.body, {}));

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    if (fileList(req).length) {
      if (!cloudinaryReady()) {
        return res.status(500).json({
          message:
            "Cloudinary is not configured on the server. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
        });
      }

      await attachCloudUrls(req);
    }

    const data = normalizeBody(section, req.body, {
      english_pdf: files.english_pdf?.[0],
      hindi_pdf: files.hindi_pdf?.[0],
      gujarati_pdf_file: files.gujarati_pdf_file?.[0],
    });

    const [[serialRow]] = await db.execute(
      `SELECT COALESCE(MAX(sr_no), 0) + 1 AS nextSrNo
       FROM \`${config.table}\``
    );

    const nextSrNo = Number(serialRow.nextSrNo);
    const columns = ["sr_no", ...config.fields];
    const values = [nextSrNo, ...config.fields.map((field) => data[field])];

    const columnNames = columns.map((field) => `\`${field}\``).join(", ");
    const placeholders = columns.map(() => "?").join(", ");

    const [result] = await db.execute(
      `INSERT INTO \`${config.table}\` (${columnNames})
       VALUES (${placeholders})`,
      values
    );

    const recordKey =
      section === "circulars" ? result.insertId : nextSrNo;

    const [rows] = await db.execute(
      `SELECT *
       FROM \`${config.table}\`
       WHERE \`${config.key}\` = ?`,
      [recordKey]
    );

    return res.status(201).json({
      message: "Record added successfully.",
      id: recordKey,
      record: rows.length
        ? mapRecord(section, rows[0], config.key)
        : null,
    });
  } catch (error) {
    await removeFiles(fileList(req));
    console.error(`Create ${section} record error:`, error);

    if (error.userMessage) {
      return res.status(502).json({ message: error.userMessage });
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "A duplicate document number or serial number already exists.",
      });
    }

    return sendServerError(res, "Unable to create record.");
  }
});

// PUT /api/circulars/:id and PUT /api/documents/:id
router.put("/:section/:id", uploadFields, async (req, res) => {
  const { section, id } = req.params;
  const config = getConfig(section);

  if (!config) {
    return res.status(404).json({ message: "Section not found." });
  }

  if (!validateId(id)) {
    return res.status(400).json({
      message: "Invalid record ID. Refresh the list and try again.",
    });
  }

  try {
    const signatureError = validatePdfSignatures(req);

    if (signatureError) {
      return res.status(400).json({ message: signatureError });
    }

    const [oldRows] = await db.execute(
      `SELECT *
       FROM \`${config.table}\`
       WHERE \`${config.key}\` = ?`,
      [Number(id)]
    );

    if (!oldRows.length) {
      return res.status(404).json({ message: "Record not found." });
    }

    const oldRecord = oldRows[0];
    const files = req.files || {};

    // Validate the text fields before uploading anything to Cloudinary.
    const validationError = validate(normalizeBody(section, req.body, {}));

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    if (fileList(req).length) {
      if (!cloudinaryReady()) {
        return res.status(500).json({
          message:
            "Cloudinary is not configured on the server. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
        });
      }

      await attachCloudUrls(req);
    }

    const data = normalizeBody(section, req.body, {
      english_pdf: files.english_pdf?.[0],
      hindi_pdf: files.hindi_pdf?.[0],
      gujarati_pdf_file: files.gujarati_pdf_file?.[0],
    });

    const assignments = config.fields
      .map((field) => `\`${field}\` = ?`)
      .join(", ");

    const [result] = await db.execute(
      `UPDATE \`${config.table}\`
       SET ${assignments}
       WHERE \`${config.key}\` = ?`,
      [...config.fields.map((field) => data[field]), Number(id)]
    );

    if (result.affectedRows === 0) {
      const [checkRows] = await db.execute(
        `SELECT 1 FROM \`${config.table}\`
         WHERE \`${config.key}\` = ?`,
        [Number(id)]
      );

      if (!checkRows.length) {
        await removeFiles(fileList(req));
        return res.status(404).json({ message: "Record not found." });
      }
    }

    // Delete replaced PDFs only after the database update succeeds.
    for (const field of config.pdfFields) {
      if (oldRecord[field] && oldRecord[field] !== data[field]) {
        await removeStoredPdf(oldRecord[field]);
      }
    }

    return res.json({ message: "Record updated successfully." });
  } catch (error) {
    await removeFiles(fileList(req));
    console.error(`Update ${section} record error:`, error);

    if (error.userMessage) {
      return res.status(502).json({ message: error.userMessage });
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "A duplicate document number already exists.",
      });
    }

    return sendServerError(res, "Unable to update record.");
  }
});

// DELETE /api/circulars/:id and DELETE /api/documents/:id
router.delete("/:section/:id", async (req, res) => {
  const { section, id } = req.params;
  const config = getConfig(section);

  if (!config) {
    return res.status(404).json({ message: "Section not found." });
  }

  if (!validateId(id)) {
    return res.status(400).json({
      message: "Invalid record ID. Refresh the list and try again.",
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT *
       FROM \`${config.table}\`
       WHERE \`${config.key}\` = ?`,
      [Number(id)]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Record not found. Refresh the list and try again.",
      });
    }

    const [result] = await db.execute(
      `DELETE FROM \`${config.table}\`
       WHERE \`${config.key}\` = ?`,
      [Number(id)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Record not found." });
    }

    for (const field of config.pdfFields) {
      await removeStoredPdf(rows[0][field]);
    }

    return res.json({ message: "Record deleted successfully." });
  } catch (error) {
    console.error(`Delete ${section} record error:`, error);
    return sendServerError(res, "Unable to delete record.");
  }
});

module.exports = router;
