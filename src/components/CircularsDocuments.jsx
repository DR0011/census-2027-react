import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import "./CircularsDocuments.css";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const ENDPOINTS = {
  orgi: `${API_BASE}/circulars`,
  dco: `${API_BASE}/documents`,
};

const EMPTY_FORM = {
  sr_no: "",
  document_no: "",
  reference_no: "",
  reference_no_en: "",
  reference_no_hi: "",
  circular_date: "",
  description_en: "",
  description_hi: "",
  description_gu: "",
  link_en: "",
  link_hi: "",
  gujarati_pdf: "",
  doc_type: "ORGI",
  circular_type: "DCO",
};

function getToken() {
  return (
    sessionStorage.getItem("census_token") ||
    localStorage.getItem("census_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function apiRequest(url, options = {}) {
  const token = getToken();
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData && options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Request failed: ${response.status}`
    );
  }

  return data;
}

function getRecords(response) {
  if (Array.isArray(response)) return response;

  for (const key of ["data", "records", "rows", "circulars", "documents"]) {
    if (Array.isArray(response?.[key])) return response[key];
  }

  for (const key of ["data", "result"]) {
    const nested = response?.[key];

    if (Array.isArray(nested)) return nested;

    for (const child of ["records", "rows", "circulars", "documents"]) {
      if (Array.isArray(nested?.[child])) return nested[child];
    }
  }

  return [];
}

function getId(record) {
  const value =
    record?.id ??
    record?.record_id ??
    record?.recordId ??
    record?.ID;

  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function firstValue(record, keys, fallback = "") {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null) {
      return record[key];
    }
  }
  return fallback;
}

function toInputDate(value) {
  if (!value) return "";

  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (local) {
    return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  }

  return "";
}

function displayDate(value) {
  const date = toInputDate(value);
  if (!date) return value || "-";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function cleanPdfValue(value) {
  let text = String(value ?? "").trim();
  if (!text) return "";

  const markdown = text.match(/^\[.*?\]\((https?:\/\/[^)]+)\)$/);
  if (markdown) text = markdown[1].trim();

  if (text.startsWith("<") && text.endsWith(">")) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

/*
 * Supports:
 * 1. Existing external PDF URLs
 * 2. New server paths, e.g. /circulars/pdf/file.pdf
 * 3. Paths saved with /api at the beginning
 */
function resolvePdfUrl(value) {
  const path = cleanPdfValue(value);
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) return path;

  if (path.startsWith("/api/")) {
    return `${API_BASE.replace(/\/api$/i, "")}${path}`;
  }

  if (path.startsWith("/")) {
    return `${API_BASE}${path}`;
  }

  return `${API_BASE}/${path}`;
}

function normalizeRecord(record, section) {
  const common = {
    ...record,
    id: getId(record),
    sr_no: firstValue(record, ["sr_no", "srNo", "serial_no", "serialNo"]),
    document_no: firstValue(record, ["document_no", "documentNo"]),
    circular_date: toInputDate(
      firstValue(record, ["circular_date", "date", "circularDate"])
    ),
  };

  if (section === "orgi") {
    return {
      ...common,
      reference_no_en: firstValue(record, [
        "reference_no_en",
        "referenceNoEn",
        "reference_no",
        "referenceNo",
      ]),
      reference_no_hi: firstValue(record, [
        "reference_no_hi",
        "referenceNoHi",
      ]),
      description_en: firstValue(record, [
        "description_en",
        "descriptionEn",
      ]),
      description_hi: firstValue(record, [
        "description_hi",
        "descriptionHi",
      ]),
      link_en: cleanPdfValue(
        firstValue(record, [
          "link_en",
          "linkEn",
          "english_pdf",
          "englishPdf",
        ])
      ),
      link_hi: cleanPdfValue(
        firstValue(record, [
          "link_hi",
          "linkHi",
          "hindi_pdf",
          "hindiPdf",
        ])
      ),
      doc_type: firstValue(
        record,
        ["doc_type", "docType", "circular_type", "circularType", "type"],
        "ORGI"
      ),
    };
  }

  return {
    ...common,
    reference_no: firstValue(record, ["reference_no", "referenceNo"]),
    description_gu: firstValue(record, [
      "description_gu",
      "descriptionGu",
      "DESCRIPTION_GU",
      "description_gujarati",
      "descriptionGujarati",
      "description",
    ]),
    gujarati_pdf: cleanPdfValue(
      firstValue(record, [
        "gujarati_pdf",
        "gujaratiPdf",
        "GUJARATI_PDF",
        "gujarati_pdf_url",
        "gujaratiPdfUrl",
        "pdf_link",
        "pdfLink",
        "pdf",
      ])
    ),
    circular_type: firstValue(
      record,
      ["circular_type", "circularType", "doc_type", "docType", "type"],
      "DCO"
    ),
  };
}

function typeLabel(value, fallback) {
  const text = String(value ?? "").trim() || fallback;

  if (text.toUpperCase() === "ORGI") return "Circular(ORGI)";
  if (text.toUpperCase() === "DCO") return "Circular(DCO)";

  return text;
}

export default function CircularsDocuments() {
  const [section, setSection] = useState("orgi");
  const [circulars, setCirculars] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [englishPdfFile, setEnglishPdfFile] = useState(null);
  const [hindiPdfFile, setHindiPdfFile] = useState(null);
  const [gujaratiPdfFile, setGujaratiPdfFile] = useState(null);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isOrgi = section === "orgi";
  const endpoint = ENDPOINTS[section];
  const records = isOrgi ? circulars : documents;

  const loadRecords = useCallback(async (targetSection = section) => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest(ENDPOINTS[targetSection]);
      const result = getRecords(response).map((row) =>
        normalizeRecord(row, targetSection)
      );

      if (targetSection === "orgi") {
        setCirculars(result);
      } else {
        setDocuments(result);
      }
    } catch (err) {
      setError(`Unable to load records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    loadRecords(section);
  }, [section, loadRecords]);

  const clearSelectedFiles = () => {
    setEnglishPdfFile(null);
    setHindiPdfFile(null);
    setGujaratiPdfFile(null);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    clearSelectedFiles();
    setEditingId(null);
    setFormOpen(false);
  };

  const changeSection = (nextSection) => {
    setSection(nextSection);
    setSearch("");
    setError("");
    setSuccess("");
    setForm(EMPTY_FORM);
    clearSelectedFiles();
    setEditingId(null);
    setFormOpen(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleAddClick = () => {
    setError("");
    setSuccess("");
    clearSelectedFiles();
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen((open) => !open);
  };

  const handleEdit = (record) => {
    const id = getId(record);

    if (!id) {
      setError("Record ID is missing. Check the backend SELECT query.");
      return;
    }

    setError("");
    setSuccess("");
    clearSelectedFiles();
    setEditingId(id);
    setFormOpen(true);

    if (isOrgi) {
      setForm({
        ...EMPTY_FORM,
        sr_no: record.sr_no ?? "",
        document_no: record.document_no ?? "",
        reference_no_en: record.reference_no_en ?? "",
        reference_no_hi: record.reference_no_hi ?? "",
        circular_date: record.circular_date ?? "",
        description_en: record.description_en ?? "",
        description_hi: record.description_hi ?? "",
        link_en: record.link_en ?? "",
        link_hi: record.link_hi ?? "",
        doc_type: record.doc_type || "ORGI",
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        sr_no: record.sr_no ?? "",
        document_no: record.document_no ?? "",
        reference_no: record.reference_no ?? "",
        circular_date: record.circular_date ?? "",
        description_gu: record.description_gu ?? "",
        gujarati_pdf: record.gujarati_pdf ?? "",
        circular_type: record.circular_type || "DCO",
      });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validatePdfFile = (file, label) => {
    if (!file) return "";

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return `${label} must be a PDF file.`;
    }

    if (file.type && file.type !== "application/pdf") {
      return `${label} must be a valid PDF file.`;
    }

    if (file.size > 10 * 1024 * 1024) {
      return `${label} must be 10 MB or smaller.`;
    }

    return "";
  };

  const validateForm = () => {
    if (!String(form.document_no).trim()) {
      return "Document number is required.";
    }

    if (!form.circular_date) {
      return "Date is required.";
    }

    if (isOrgi) {
      if (
        !String(form.description_en).trim() &&
        !String(form.description_hi).trim()
      ) {
        return "Enter an English or Hindi description.";
      }

      const englishError = validatePdfFile(englishPdfFile, "English PDF");
      if (englishError) return englishError;

      const hindiError = validatePdfFile(hindiPdfFile, "Hindi PDF");
      if (hindiError) return hindiError;
    } else {
      if (!String(form.description_gu).trim()) {
        return "Gujarati description is required.";
      }

      const gujaratiError = validatePdfFile(
        gujaratiPdfFile,
        "Gujarati PDF"
      );
      if (gujaratiError) return gujaratiError;
    }

    return "";
  };

  const buildFormData = () => {
    const body = new FormData();
    const serial = form.sr_no === "" ? "" : String(form.sr_no);

    body.append("sr_no", serial);
    body.append("document_no", form.document_no.trim());
    body.append("circular_date", form.circular_date);

    if (isOrgi) {
      body.append("reference_no_en", form.reference_no_en.trim());
      body.append("reference_no_hi", form.reference_no_hi.trim());
      body.append("description_en", form.description_en.trim());
      body.append("description_hi", form.description_hi.trim());
      body.append("link_en", form.link_en || "");
      body.append("link_hi", form.link_hi || "");
      body.append("doc_type", form.doc_type || "ORGI");

      if (englishPdfFile) body.append("english_pdf", englishPdfFile);
      if (hindiPdfFile) body.append("hindi_pdf", hindiPdfFile);
    } else {
      body.append("reference_no", form.reference_no.trim());
      body.append("description_gu", form.description_gu.trim());
      body.append("gujarati_pdf", form.gujarati_pdf || "");
      body.append("circular_type", form.circular_type || "DCO");

      if (gujaratiPdfFile) {
        body.append("gujarati_pdf_file", gujaratiPdfFile);
      }
    }

    return body;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (editingId && !getId({ id: editingId })) {
      setError("Invalid record ID. Refresh the list and try again.");
      return;
    }

    setSaving(true);

    try {
      const url = editingId
        ? `${endpoint}/${encodeURIComponent(editingId)}`
        : endpoint;

      const response = await apiRequest(url, {
        method: editingId ? "PUT" : "POST",
        body: buildFormData(),
      });

      setSuccess(
        response.message ||
          (editingId
            ? "Record updated successfully."
            : "Record added successfully.")
      );

      resetForm();
      await loadRecords(section);
    } catch (err) {
      setError(`Unable to save record: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    const id = getId(record);

    if (!id) {
      setError("Record ID is missing. Check the backend SELECT query.");
      return;
    }

    const label = record.document_no || `ID ${id}`;
    if (!window.confirm(`Delete record ${label}?`)) return;

    setError("");
    setSuccess("");
    setDeletingId(id);

    try {
      const response = await apiRequest(
        `${endpoint}/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      setSuccess(response.message || "Record deleted successfully.");

      if (Number(editingId) === id) resetForm();
      await loadRecords(section);
    } catch (err) {
      setError(`Unable to delete record: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const openPdf = (value) => {
    const url = resolvePdfUrl(value);

    if (!url) {
      setError("No PDF is available for this record.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = [...records].sort(
      (a, b) => (Number(b.sr_no) || 0) - (Number(a.sr_no) || 0)
    );

    if (!query) return result;

    return result.filter((record) => {
      const values = isOrgi
        ? [
            record.sr_no,
            record.document_no,
            record.reference_no_en,
            record.reference_no_hi,
            record.description_en,
            record.description_hi,
            record.doc_type,
          ]
        : [
            record.sr_no,
            record.document_no,
            record.reference_no,
            record.description_gu,
            record.circular_type,
          ];

      return values.some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });
  }, [records, search, isOrgi]);

  const existingPdf = (value) =>
    value ? (
      <button
        type="button"
        className="cd-link-btn"
        onClick={() => openPdf(value)}
      >
        View current PDF
      </button>
    ) : (
      <span className="cd-muted">No PDF uploaded</span>
    );

  return (
    <div className="cd-page">
      <div className="cd-page-header">
        <div>
          <h1>Census 2027 - Circulars &amp; Documents</h1>
          <p>Manage ORGI circulars and DCO Gujarati documents.</p>
        </div>

        <button
          type="button"
          className="cd-btn cd-btn-secondary"
          onClick={() => loadRecords(section)}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="cd-tabs" role="tablist" aria-label="Circular category">
        <button
          type="button"
          role="tab"
          aria-selected={isOrgi}
          className={`cd-tab ${isOrgi ? "active" : ""}`}
          onClick={() => changeSection("orgi")}
        >
          Circular ORGI
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={!isOrgi}
          className={`cd-tab ${!isOrgi ? "active" : ""}`}
          onClick={() => changeSection("dco")}
        >
          Circular DCO
        </button>
      </div>

      {error && (
        <div className="cd-alert cd-alert-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Close">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="cd-alert cd-alert-success" role="status">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} aria-label="Close">
            ×
          </button>
        </div>
      )}

      <div className="cd-toolbar">
        <h2>{isOrgi ? "ORGI Circulars" : "DCO Circulars"}</h2>
        <button
          type="button"
          className="cd-btn cd-btn-primary"
          onClick={handleAddClick}
        >
          {formOpen && !editingId ? "Close Form −" : "+ Add Record"}
        </button>
      </div>

      {formOpen && (
        <section className="cd-panel">
          <div className="cd-panel-header">
            <h2>
              {editingId
                ? `Edit Record (ID: ${editingId})`
                : `Add ${isOrgi ? "ORGI Circular" : "DCO Circular"}`}
            </h2>

            <button
              type="button"
              className="cd-btn cd-btn-secondary"
              onClick={resetForm}
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} encType="multipart/form-data">
            <div className="cd-form-grid">
              <div className="cd-field">
                <label htmlFor="cd-sr-no">Serial No.</label>
                <input
                  id="cd-sr-no"
                  name="sr_no"
                  type="number"
                  min="0"
                  value={form.sr_no}
                  onChange={handleChange}
                />
              </div>

              <div className="cd-field">
                <label htmlFor="cd-document-no">
                  Document No. <span className="cd-required">*</span>
                </label>
                <input
                  id="cd-document-no"
                  name="document_no"
                  value={form.document_no}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="cd-field">
                <label htmlFor="cd-date">
                  Date <span className="cd-required">*</span>
                </label>
                <input
                  id="cd-date"
                  type="date"
                  name="circular_date"
                  value={form.circular_date}
                  onChange={handleChange}
                  required
                />
              </div>

              {isOrgi ? (
                <>
                  <div className="cd-field">
                    <label htmlFor="cd-ref-en">Reference No. (English)</label>
                    <input
                      id="cd-ref-en"
                      name="reference_no_en"
                      value={form.reference_no_en}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="cd-field">
                    <label htmlFor="cd-ref-hi">Reference No. (Hindi)</label>
                    <input
                      id="cd-ref-hi"
                      name="reference_no_hi"
                      value={form.reference_no_hi}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="cd-field">
                    <label htmlFor="cd-type-orgi">Circular Type</label>
                    <select
                      id="cd-type-orgi"
                      name="doc_type"
                      value={form.doc_type}
                      onChange={handleChange}
                    >
                      <option value="ORGI">Circular(ORGI)</option>
                      <option value="Circular">Circular</option>
                      <option value="Notification">Notification</option>
                      <option value="Letter">Letter</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="cd-field cd-field-full">
                    <label htmlFor="cd-desc-en">Description (English)</label>
                    <textarea
                      id="cd-desc-en"
                      name="description_en"
                      rows="3"
                      value={form.description_en}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="cd-field cd-field-full">
                    <label htmlFor="cd-desc-hi">Description (Hindi)</label>
                    <textarea
                      id="cd-desc-hi"
                      name="description_hi"
                      rows="3"
                      value={form.description_hi}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="cd-field cd-field-full">
                    <label htmlFor="cd-pdf-en">Upload English PDF (max 10 MB)</label>
                    <input
                      id="cd-pdf-en"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) =>
                        setEnglishPdfFile(event.target.files?.[0] || null)
                      }
                    />
                    {editingId && existingPdf(form.link_en)}
                    {englishPdfFile && (
                      <small>Selected: {englishPdfFile.name}</small>
                    )}
                  </div>

                  <div className="cd-field cd-field-full">
                    <label htmlFor="cd-pdf-hi">Upload Hindi PDF (max 10 MB)</label>
                    <input
                      id="cd-pdf-hi"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) =>
                        setHindiPdfFile(event.target.files?.[0] || null)
                      }
                    />
                    {editingId && existingPdf(form.link_hi)}
                    {hindiPdfFile && (
                      <small>Selected: {hindiPdfFile.name}</small>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="cd-field">
                    <label htmlFor="cd-ref-dco">Reference No.</label>
                    <input
                      id="cd-ref-dco"
                      name="reference_no"
                      value={form.reference_no}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="cd-field">
                    <label htmlFor="cd-type-dco">Circular Type</label>
                    <select
                      id="cd-type-dco"
                      name="circular_type"
                      value={form.circular_type}
                      onChange={handleChange}
                    >
                      <option value="DCO">Circular(DCO)</option>
                      <option value="Circular">Circular</option>
                      <option value="Notification">Notification</option>
                      <option value="Letter">Letter</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="cd-field cd-field-full">
                    <label htmlFor="cd-desc-gu">
                      Description (Gujarati) <span className="cd-required">*</span>
                    </label>
                    <textarea
                      id="cd-desc-gu"
                      name="description_gu"
                      rows="5"
                      value={form.description_gu}
                      onChange={handleChange}
                      placeholder="ગુજરાતીમાં વિગતો દાખલ કરો"
                      required
                    />
                  </div>

                  <div className="cd-field cd-field-full">
                    <label htmlFor="cd-pdf-gu">Upload Gujarati PDF (max 10 MB)</label>
                    <input
                      id="cd-pdf-gu"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) =>
                        setGujaratiPdfFile(event.target.files?.[0] || null)
                      }
                    />
                    {editingId && existingPdf(form.gujarati_pdf)}
                    {gujaratiPdfFile && (
                      <small>Selected: {gujaratiPdfFile.name}</small>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="cd-form-actions">
              <button
                type="submit"
                className="cd-btn cd-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Uploading and Saving..."
                  : editingId
                  ? "Update Record"
                  : "Add Record"}
              </button>

              <button
                type="button"
                className="cd-btn cd-btn-secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="cd-panel cd-records-panel">
        <div className="cd-panel-header cd-records-heading">
          <div>
            <h2>{isOrgi ? "ORGI Circular List" : "DCO Circular List"}</h2>
            <p className="cd-record-count">{filteredRecords.length} record(s)</p>
          </div>

          <div className="cd-search">
            <label className="cd-sr-only" htmlFor="cd-search">
              Search records
            </label>
            <input
              id="cd-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search records..."
            />
          </div>
        </div>

        {loading ? (
          <div className="cd-loading">Loading records...</div>
        ) : (
          <div className="cd-table-wrapper">
            <table className="cd-table">
              <thead>
                {isOrgi ? (
                  <tr>
                    <th>Sr. No.</th>
                    <th>Document No.</th>
                    <th>Reference No. (EN)</th>
                    <th>Reference No. (HI)</th>
                    <th>Date</th>
                    <th>Description (EN)</th>
                    <th>Description (HI)</th>
                    <th>English PDF</th>
                    <th>Hindi PDF</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Sr. No.</th>
                    <th>Document No.</th>
                    <th>Reference No.</th>
                    <th>Date</th>
                    <th>Description (Gujarati)</th>
                    <th>Gujarati PDF</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                )}
              </thead>

              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={isOrgi ? 11 : 8} className="cd-empty">
                      {search ? "No matching records." : "No records found."}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => {
                    const id = getId(record);

                    return (
                      <tr key={id ?? `record-${index}`}>
                        <td>{record.sr_no || index + 1}</td>
                        <td>{record.document_no || "-"}</td>

                        {isOrgi ? (
                          <>
                            <td>{record.reference_no_en || "-"}</td>
                            <td>{record.reference_no_hi || "-"}</td>
                            <td>{displayDate(record.circular_date)}</td>
                            <td className="cd-description">
                              {record.description_en || "-"}
                            </td>
                            <td className="cd-description">
                              {record.description_hi || "-"}
                            </td>
                            <td>
                              {record.link_en ? (
                                <button
                                  type="button"
                                  className="cd-link-btn"
                                  onClick={() => openPdf(record.link_en)}
                                >
                                  View PDF
                                </button>
                              ) : "-"}
                            </td>
                            <td>
                              {record.link_hi ? (
                                <button
                                  type="button"
                                  className="cd-link-btn"
                                  onClick={() => openPdf(record.link_hi)}
                                >
                                  View PDF
                                </button>
                              ) : "-"}
                            </td>
                            <td>{typeLabel(record.doc_type, "ORGI")}</td>
                          </>
                        ) : (
                          <>
                            <td>{record.reference_no || "-"}</td>
                            <td>{displayDate(record.circular_date)}</td>
                            <td className="cd-description">
                              {String(record.description_gu ?? "").trim() || "-"}
                            </td>
                            <td>
                              {record.gujarati_pdf ? (
                                <button
                                  type="button"
                                  className="cd-link-btn"
                                  onClick={() => openPdf(record.gujarati_pdf)}
                                >
                                  View PDF
                                </button>
                              ) : "-"}
                            </td>
                            <td>{typeLabel(record.circular_type, "DCO")}</td>
                          </>
                        )}

                        <td className="cd-actions">
                          <button
                            type="button"
                            className="cd-btn cd-btn-edit"
                            disabled={!id || deletingId === id}
                            onClick={() => handleEdit(record)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="cd-btn cd-btn-delete"
                            disabled={!id || deletingId === id}
                            onClick={() => handleDelete(record)}
                          >
                            {deletingId === id ? "Deleting..." : "Delete"}
                          </button>

                          {!id && (
                            <small className="cd-id-warning">Missing ID</small>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}