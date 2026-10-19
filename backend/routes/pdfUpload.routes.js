
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("../db/db");

const router = express.Router();

const UPLOAD_DIR = path.resolve(
  process.cwd(),
  "uploads",
  "pdfs"
);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, UPLOAD_DIR);
  },

  filename: (req, file, callback) => {
    callback(
      null,
      `${crypto.randomUUID()}.pdf`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname)
      .toLowerCase();

    if (
      extension !== ".pdf" ||
      file.mimetype !== "application/pdf"
    ) {
      return callback(
        new Error("Only PDF files are allowed.")
      );
    }

    callback(null, true);
  },
});

const query = async (sql, params = []) => {
  const [rows] = await db.query(sql, params);
  return rows;
};
const safeUnlink = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// UPLOAD PDF
router.post(
  "/upload",
  (req, res, next) => {
    upload.single("pdf")(req, res, (error) => {
      if (!error) return next();

      const status = error instanceof multer.MulterError
        ? error.code === "LIMIT_FILE_SIZE"
          ? 413
          : 400
        : 400;

      return res.status(status).json({
        message: error.message || "Upload failed.",
      });
    });
  },
  async (req, res) => {
    let uploadedPath;

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select a PDF file.",
        });
      }

      uploadedPath = req.file.path;

      // Verify the actual PDF signature.
      const fd = fs.openSync(uploadedPath, "r");
      const header = Buffer.alloc(5);

      try {
        fs.readSync(fd, header, 0, 5, 0);
      } finally {
        fs.closeSync(fd);
      }

      if (header.toString("ascii") !== "%PDF-") {
        safeUnlink(uploadedPath);

        return res.status(400).json({
          message: "The selected file is not a valid PDF.",
        });
      }

      const title = String(req.body.title || "").trim();

      if (!title || title.length > 255) {
        safeUnlink(uploadedPath);

        return res.status(400).json({
          message: "Title is required (maximum 255 characters).",
        });
      }

      const filePath = `/uploads/pdfs/${req.file.filename}`;

      const result = await query(
        `INSERT INTO uploaded_pdfs
         (title, original_name, stored_name, file_path,
          mime_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          title,
          path.basename(req.file.originalname),
          req.file.filename,
          filePath,
          "application/pdf",
          req.file.size,
        ]
      );

      return res.status(201).json({
        message: "PDF uploaded successfully.",
        pdf: {
          id: result.insertId,
          title,
          original_name: path.basename(req.file.originalname),
          file_path: filePath,
          file_size: req.file.size,
          uploaded_at: new Date(),
        },
      });
    } catch (error) {
      if (uploadedPath) safeUnlink(uploadedPath);

      console.error("PDF upload error:", error);

      return res.status(500).json({
        message: "Unable to upload PDF.",
      });
    }
  }
);

// LIST PDFs
router.get("/", async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, title, original_name, file_path,
              mime_type, file_size, uploaded_at
       FROM uploaded_pdfs
       ORDER BY id DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error("PDF list error:", error);
    res.status(500).json({
      message: "Unable to load PDFs.",
    });
  }
});

// PREVIEW OR DOWNLOAD PDF
router.get("/:id/file", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        message: "Invalid PDF ID.",
      });
    }

    const rows = await query(
      `SELECT original_name, stored_name
       FROM uploaded_pdfs
       WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "PDF not found.",
      });
    }

    const filePath = path.join(
      UPLOAD_DIR,
      rows[0].stored_name
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "PDF file is missing from storage.",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const mode = req.query.download === "1"
      ? "attachment"
      : "inline";

    const safeName = rows[0].original_name
      .replace(/[\r\n"]/g, "_");

    res.setHeader(
      "Content-Disposition",
      `${mode}; filename="${safeName}"`
    );

    return res.sendFile(filePath);
  } catch (error) {
    console.error("PDF serving error:", error);
    res.status(500).json({
      message: "Unable to open PDF.",
    });
  }
});

// DELETE PDF
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        message: "Invalid PDF ID.",
      });
    }

    const rows = await query(
      `SELECT stored_name
       FROM uploaded_pdfs
       WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "PDF not found.",
      });
    }

    await query(
      "DELETE FROM uploaded_pdfs WHERE id = ?",
      [id]
    );

    const filePath = path.join(
      UPLOAD_DIR,
      rows[0].stored_name
    );

    safeUnlink(filePath);

    return res.json({
      message: "PDF deleted successfully.",
    });
  } catch (error) {
    console.error("PDF delete error:", error);
    res.status(500).json({
      message: "Unable to delete PDF.",
    });
  }
});

module.exports = router;
