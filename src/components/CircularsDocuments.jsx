import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./CircularsDocuments.css";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const MAX_PDF_SIZE = 10 * 1024 * 1024;

const TYPE_OPTIONS = ["Circular", "Notification", "Letter", "Other"];

/**
 * Everything that differs between ORGI and DCO lives here.
 * The UI (form, table, search, validation, FormData) is generated from it.
 */
const SECTIONS = {
  orgi: {
    tabLabel: "Circular ORGI",
    listTitle: "ORGI Circulars",
    singular: "ORGI Circular",
    endpoint: `${API_BASE}/circulars`,
    typeField: "doc_type",
    defaultType: "ORGI",
    typeBadge: "Circular(ORGI)",
    emptyForm: {
      sr_no: "",
      document_no: "",
      circular_date: "",
      reference_no_en: "",
      reference_no_hi: "",
      doc_type: "ORGI",
      description_en: "",
      description_hi: "",
      link_en: "",
      link_hi: "",
    },
    // hidden values sent back to the server (existing PDF paths)
    keepFields: ["link_en", "link_hi"],
    fields: [
      { name: "sr_no", label: "Serial No.", type: "number" },
      { name: "document_no", label: "Document No.", required: true },
      { name: "circular_date", label: "Date", type: "date", required: true },
      { name: "reference_no_en", label: "Reference No. (English)" },
      { name: "reference_no_hi", label: "Reference No. (Hindi)" },
      { name: "doc_type", label: "Circular Type", type: "select" },
      { name: "description_en", label: "Description (English)", type: "textarea", rows: 3 },
      { name: "description_hi", label: "Description (Hindi)", type: "textarea", rows: 3 },
    ],
    uploads: [
      { key: "english_pdf", label: "English PDF", linkField: "link_en" },
      { key: "hindi_pdf", label: "Hindi PDF", linkField: "link_hi" },
    ],
    columns: [
      { label: "Sr. No.", kind: "sr" },
      { label: "Document No.", field: "document_no" },
      { label: "Reference No. (EN)", field: "reference_no_en" },
      { label: "Reference No. (HI)", field: "reference_no_hi" },
      { label: "Date", kind: "date", field: "circular_date" },
      { label: "Description (EN)", kind: "desc", field: "description_en" },
      { label: "Description (HI)", kind: "desc", field: "description_hi" },
      { label: "English PDF", kind: "pdf", field: "link_en" },
      { label: "Hindi PDF", kind: "pdf", field: "link_hi" },
      { label: "Type", kind: "type", field: "doc_type" },
    ],
    searchFields: [
      "sr_no",
      "document_no",
      "reference_no_en",
      "reference_no_hi",
      "description_en",
      "description_hi",
      "doc_type",
    ],
    // field aliases accepted from the backend
    aliases: {
      sr_no: ["sr_no", "srNo", "serial_no", "serialNo"],
      document_no: ["document_no", "documentNo"],
      circular_date: ["circular_date", "date", "circularDate"],
      reference_no_en: ["reference_no_en", "referenceNoEn", "reference_no", "referenceNo"],
      reference_no_hi: ["reference_no_hi", "referenceNoHi"],
      description_en: ["description_en", "descriptionEn"],
      description_hi: ["description_hi", "descriptionHi"],
      link_en: ["link_en", "linkEn", "english_pdf", "englishPdf"],
      link_hi: ["link_hi", "linkHi", "hindi_pdf", "hindiPdf"],
      doc_type: ["doc_type", "docType", "circular_type", "circularType", "type"],
    },
    validate: (form) =>
      !form.description_en.trim() && !form.description_hi.trim()
        ? "Enter an English or Hindi description."
        : "",
  },

  dco: {
    tabLabel: "Circular DCO",
    listTitle: "DCO Circulars",
    singular: "DCO Circular",
    endpoint: `${API_BASE}/documents`,
    typeField: "circular_type",
    defaultType: "DCO",
    typeBadge: "Circular(DCO)",
    emptyForm: {
      sr_no: "",
      document_no: "",
      circular_date: "",
      reference_no: "",
      circular_type: "DCO",
      description_gu: "",
      gujarati_pdf: "",
    },
    keepFields: ["gujarati_pdf"],
    fields: [
      { name: "sr_no", label: "Serial No.", type: "number" },
      { name: "document_no", label: "Document No.", required: true },
      { name: "circular_date", label: "Date", type: "date", required: true },
      { name: "reference_no", label: "Reference No." },
      { name: "circular_type", label: "Circular Type", type: "select" },
      {
        name: "description_gu",
        label: "Description (Gujarati)",
        type: "textarea",
        rows: 5,
        required: true,
        placeholder: "ગુજરાતીમાં વિગતો દાખલ કરો",
      },
    ],
    uploads: [
      { key: "gujarati_pdf_file", label: "Gujarati PDF", linkField: "gujarati_pdf" },
    ],
    columns: [
      { label: "Sr. No.", kind: "sr" },
      { label: "Document No.", field: "document_no" },
      { label: "Reference No.", field: "reference_no" },
      { label: "Date", kind: "date", field: "circular_date" },
      { label: "Description (Gujarati)", kind: "desc", field: "description_gu" },
      { label: "Gujarati PDF", kind: "pdf", field: "gujarati_pdf" },
      { label: "Type", kind: "type", field: "circular_type" },
    ],
    searchFields: [
      "sr_no",
      "document_no",
      "reference_no",
      "description_gu",
      "circular_type",
    ],
    aliases: {
      sr_no: ["sr_no", "srNo", "serial_no", "serialNo"],
      document_no: ["document_no", "documentNo"],
      circular_date: ["circular_date", "date", "circularDate"],
      reference_no: ["reference_no", "referenceNo"],
      description_gu: [
        "description_gu",
        "descriptionGu",
        "DESCRIPTION_GU",
        "description_gujarati",
        "descriptionGujarati",
        "description",
      ],
      gujarati_pdf: [
        "gujarati_pdf",
        "gujaratiPdf",
        "GUJARATI_PDF",
        "gujarati_pdf_url",
        "gujaratiPdfUrl",
        "pdf_link",
        "pdfLink",
        "pdf",
      ],
      circular_type: ["circular_type", "circularType", "doc_type", "docType", "type"],
    },
    validate: () => "",
  },
};

const RECORD_LIST_KEYS = ["records", "rows", "circulars", "documents"];

/* ------------------------------------------------------------------ */
/* Helpers (pure, defined once)                                        */
/* ------------------------------------------------------------------ */

function getToken() {
  for (const store of [sessionStorage, localStorage]) {
    for (const key of ["census_token", "token"]) {
      const value = store.getItem(key);
      if (value) return value;
    }
  }
  return "";
}

async function apiRequest(url, { headers, body, ...options } = {}) {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    body,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(!isFormData && body && { "Content-Type": "application/json" }),
      ...headers,
    },
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

function extractRecords(response) {
  if (Array.isArray(response)) return response;

  const containers = [response, response?.data, response?.result];
  for (const box of containers) {
    if (Array.isArray(box)) return box;
    for (const key of ["data", ...RECORD_LIST_KEYS]) {
      if (Array.isArray(box?.[key])) return box[key];
    }
  }
  return [];
}

function getId(record) {
  const value = record?.id ?? record?.record_id ?? record?.recordId ?? record?.ID;
  if (value == null || String(value).trim() === "") return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function pick(record, keys, fallback = "") {
  for (const key of keys) {
    if (record?.[key] != null) return record[key];
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

/** Supports external URLs, server paths (/circulars/pdf/x.pdf) and /api/... paths */
function resolvePdfUrl(value) {
  const path = cleanPdfValue(value);
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/")) return `${API_BASE.replace(/\/api$/i, "")}${path}`;
  return path.startsWith("/") ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
}

function normalizeRecord(record, config) {
  const out = { ...record, id: getId(record) };

  for (const [field, keys] of Object.entries(config.aliases)) {
    out[field] = pick(record, keys, field === config.typeField ? config.defaultType : "");
  }

  out.circular_date = toInputDate(out.circular_date);
  for (const { linkField } of config.uploads) {
    out[linkField] = cleanPdfValue(out[linkField]);
  }
  return out;
}

function recordToForm(record, config) {
  const form = { ...config.emptyForm };
  for (const key of Object.keys(form)) {
    form[key] = record[key] ?? "";
  }
  form[config.typeField] = record[config.typeField] || config.defaultType;
  return form;
}

function typeLabel(value, fallback) {
  const text = String(value ?? "").trim() || fallback;
  const upper = text.toUpperCase();
  if (upper === "ORGI" || upper === "DCO") return `Circular(${upper})`;
  return text;
}

function validatePdf(file, label) {
  if (!file) return "";
  if (!file.name.toLowerCase().endsWith(".pdf")) return `${label} must be a PDF file.`;
  if (file.type && file.type !== "application/pdf") return `${label} must be a valid PDF file.`;
  if (file.size > MAX_PDF_SIZE) return `${label} must be 10 MB or smaller.`;
  return "";
}

function validateForm(form, files, config) {
  for (const field of config.fields) {
    if (field.required && !String(form[field.name] ?? "").trim()) {
      return `${field.label} is required.`;
    }
  }

  const custom = config.validate(form);
  if (custom) return custom;

  for (const upload of config.uploads) {
    const error = validatePdf(files[upload.key], `${upload.label}`);
    if (error) return error;
  }
  return "";
}

function buildFormData(form, files, config) {
  const body = new FormData();
  const skip = new Set(config.keepFields);

  for (const field of config.fields) {
    if (skip.has(field.name)) continue;
    const value = form[field.name];
    body.append(field.name, typeof value === "string" ? value.trim() : String(value ?? ""));
  }

  for (const name of config.keepFields) body.append(name, form[name] || "");

  for (const { key } of config.uploads) {
    if (files[key]) body.append(key, files[key]);
  }
  return body;
}

/* ------------------------------------------------------------------ */
/* Small presentational components (memoized)                          */
/* ------------------------------------------------------------------ */

const Alert = memo(function Alert({ type, message, onClose }) {
  if (!message) return null;
  return (
    <div
      className={`cd-alert cd-alert-${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
});

const PdfButton = memo(function PdfButton({ value, label = "View PDF", onOpen }) {
  if (!value) return "-";
  return (
    <button type="button" className="cd-link-btn" onClick={() => onOpen(value)}>
      {label}
    </button>
  );
});

function renderCell(column, record, index, onOpen, config) {
  const value = record[column.field];

  switch (column.kind) {
    case "sr":
      return record.sr_no || index + 1;
    case "date":
      return displayDate(value);
    case "pdf":
      return <PdfButton value={value} onOpen={onOpen} />;
    case "type":
      return typeLabel(value, config.defaultType);
    case "desc":
      return String(value ?? "").trim() || "-";
    default:
      return value || "-";
  }
}

const RecordRow = memo(function RecordRow({
  record,
  index,
  config,
  isDeleting,
  onEdit,
  onDelete,
  onOpenPdf,
}) {
  const id = record.id;

  return (
    <tr>
      {config.columns.map((column) => (
        <td
          key={column.label}
          className={column.kind === "desc" ? "cd-description" : undefined}
        >
          {renderCell(column, record, index, onOpenPdf, config)}
        </td>
      ))}

      <td className="cd-actions">
        <button
          type="button"
          className="cd-btn cd-btn-edit"
          disabled={!id || isDeleting}
          onClick={() => onEdit(record)}
        >
          Edit
        </button>
        <button
          type="button"
          className="cd-btn cd-btn-delete"
          disabled={!id || isDeleting}
          onClick={() => onDelete(record)}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
        {!id && <small className="cd-id-warning">Missing ID</small>}
      </td>
    </tr>
  );
});

const FormField = memo(function FormField({ field, value, onChange }) {
  const id = `cd-${field.name}`;
  const full = field.type === "textarea" ? " cd-field-full" : "";

  let control;
  if (field.type === "textarea") {
    control = (
      <textarea
        id={id}
        name={field.name}
        rows={field.rows || 3}
        value={value}
        onChange={onChange}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  } else if (field.type === "select") {
    control = (
      <select id={id} name={field.name} value={value} onChange={onChange}>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        id={id}
        name={field.name}
        type={field.type || "text"}
        min={field.type === "number" ? "0" : undefined}
        value={value}
        onChange={onChange}
        required={field.required}
      />
    );
  }

  return (
    <div className={`cd-field${full}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="cd-required"> *</span>}
      </label>
      {control}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Modal form                                                          */
/* ------------------------------------------------------------------ */

const RecordModal = memo(function RecordModal({
  config,
  editingId,
  form,
  files,
  saving,
  onChange,
  onFileChange,
  onOpenPdf,
  onSubmit,
  onClose,
}) {
  const firstFieldRef = useRef(null);

  // select options depend on the section's default type
  const fields = useMemo(
    () =>
      config.fields.map((field) =>
        field.type === "select"
          ? {
              ...field,
              options: [
                { value: config.defaultType, label: config.typeBadge },
                ...TYPE_OPTIONS.map((t) => ({ value: t, label: t })),
              ],
            }
          : field
      ),
    [config]
  );

  // Esc to close, lock page scroll, focus first input
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [saving, onClose]);

  // focus first input once when the modal opens
  useEffect(() => {
    firstFieldRef.current?.querySelector("input, textarea, select")?.focus();
  }, []);

  const title = editingId
    ? `Edit Record (ID: ${editingId})`
    : `Add ${config.singular}`;

  return createPortal(
    <div
      className="cd-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="cd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-modal-title"
      >
        <div className="cd-modal-header">
          <h2 id="cd-modal-title">{title}</h2>
          <button
            type="button"
            className="cd-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="cd-modal-body">
          <form onSubmit={onSubmit} encType="multipart/form-data">
            <div className="cd-form-grid" ref={firstFieldRef}>
              {fields.map((field) => (
                <FormField
                  key={field.name}
                  field={field}
                  value={form[field.name]}
                  onChange={onChange}
                />
              ))}

              {config.uploads.map((upload) => {
                const inputId = `cd-file-${upload.key}`;
                const selected = files[upload.key];
                const current = form[upload.linkField];

                return (
                  <div className="cd-field cd-field-full" key={upload.key}>
                    <label htmlFor={inputId}>
                      Upload {upload.label} (max 10 MB)
                    </label>
                    <input
                      id={inputId}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) =>
                        onFileChange(upload.key, event.target.files?.[0] || null)
                      }
                    />
                    {editingId &&
                      (current ? (
                        <button
                          type="button"
                          className="cd-link-btn"
                          onClick={() => onOpenPdf(current)}
                        >
                          View current PDF
                        </button>
                      ) : (
                        <span className="cd-muted">No PDF uploaded</span>
                      ))}
                    {selected && <small>Selected: {selected.name}</small>}
                  </div>
                );
              })}
            </div>

            <div className="cd-form-actions">
              <button type="submit" className="cd-btn cd-btn-primary" disabled={saving}>
                {saving
                  ? "Uploading and Saving..."
                  : editingId
                  ? "Update Record"
                  : "Add Record"}
              </button>
              <button
                type="button"
                className="cd-btn cd-btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>,
    document.body
  );
});

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function CircularsDocuments() {
  const [section, setSection] = useState("orgi");
  const [data, setData] = useState({ orgi: [], dco: [] });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(SECTIONS.orgi.emptyForm);
  const [files, setFiles] = useState({});

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const config = SECTIONS[section];
  const isOrgi = section === "orgi";
  const records = data[section];

  /* ---- loading (aborts stale requests when switching tabs) ---- */

  const abortRef = useRef(null);

  const loadRecords = useCallback(async (target) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const targetConfig = SECTIONS[target];
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest(targetConfig.endpoint, {
        signal: controller.signal,
      });
      const rows = extractRecords(response).map((row) =>
        normalizeRecord(row, targetConfig)
      );
      setData((previous) => ({ ...previous, [target]: rows }));
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(`Unable to load records: ${err.message}`);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords(section);
    return () => abortRef.current?.abort();
  }, [section, loadRecords]);

  /* ---- form state ---- */

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setFiles({});
    setForm(config.emptyForm);
  }, [config]);

  const changeSection = useCallback((next) => {
    setSection(next);
    setSearch("");
    setError("");
    setSuccess("");
    setFormOpen(false);
    setEditingId(null);
    setFiles({});
    setForm(SECTIONS[next].emptyForm);
  }, []);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }, []);

  const handleFileChange = useCallback((key, file) => {
    setFiles((previous) => ({ ...previous, [key]: file }));
  }, []);

  const handleAddClick = useCallback(() => {
    setError("");
    setSuccess("");
    setFiles({});
    setEditingId(null);
    setForm({ ...config.emptyForm });
    setFormOpen(true);
  }, [config]);

  const handleEdit = useCallback(
    (record) => {
      const id = getId(record);
      if (!id) {
        setError("Record ID is missing. Check the backend SELECT query.");
        return;
      }

      setError("");
      setSuccess("");
      setFiles({});
      setEditingId(id);
      setForm(recordToForm(record, config));
      setFormOpen(true);
    },
    [config]
  );

  const openPdf = useCallback((value) => {
    const url = resolvePdfUrl(value);
    if (!url) {
      setError("No PDF is available for this record.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  /* ---- save / delete ---- */

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm(form, files, config);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `${config.endpoint}/${encodeURIComponent(editingId)}`
        : config.endpoint;

      const response = await apiRequest(url, {
        method: editingId ? "PUT" : "POST",
        body: buildFormData(form, files, config),
      });

      setSuccess(
        response.message ||
          (editingId ? "Record updated successfully." : "Record added successfully.")
      );
      closeForm();
      await loadRecords(section);
    } catch (err) {
      setError(`Unable to save record: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(
    async (record) => {
      const id = getId(record);
      if (!id) {
        setError("Record ID is missing. Check the backend SELECT query.");
        return;
      }

      if (!window.confirm(`Delete record ${record.document_no || `ID ${id}`}?`)) return;

      setError("");
      setSuccess("");
      setDeletingId(id);

      try {
        const response = await apiRequest(
          `${config.endpoint}/${encodeURIComponent(id)}`,
          { method: "DELETE" }
        );
        setSuccess(response.message || "Record deleted successfully.");
        await loadRecords(section);
      } catch (err) {
        setError(`Unable to delete record: ${err.message}`);
      } finally {
        setDeletingId(null);
      }
    },
    [config, section, loadRecords]
  );

  /* ---- derived data ---- */

  const sortedRecords = useMemo(
    () =>
      [...records].sort((a, b) => (Number(b.sr_no) || 0) - (Number(a.sr_no) || 0)),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return sortedRecords;

    return sortedRecords.filter((record) =>
      config.searchFields.some((field) =>
        String(record[field] ?? "").toLowerCase().includes(query)
      )
    );
  }, [sortedRecords, deferredSearch, config]);

  const clearError = useCallback(() => setError(""), []);
  const clearSuccess = useCallback(() => setSuccess(""), []);

  const columnCount = config.columns.length + 1;

  /* ---- render ---- */

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
        {Object.entries(SECTIONS).map(([key, item]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            className={`cd-tab ${section === key ? "active" : ""}`}
            onClick={() => changeSection(key)}
          >
            {item.tabLabel}
          </button>
        ))}
      </div>

      <Alert type="error" message={error} onClose={clearError} />
      <Alert type="success" message={success} onClose={clearSuccess} />

      <div className="cd-toolbar">
        <h2>{config.listTitle}</h2>
        <button type="button" className="cd-btn cd-btn-primary" onClick={handleAddClick}>
          + Add Record
        </button>
      </div>

      {formOpen && (
        <RecordModal
          config={config}
          editingId={editingId}
          form={form}
          files={files}
          saving={saving}
          onChange={handleChange}
          onFileChange={handleFileChange}
          onOpenPdf={openPdf}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
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

        {loading && records.length === 0 ? (
          <div className="cd-loading">Loading records...</div>
        ) : (
          <div className="cd-table-wrapper">
            <table className="cd-table">
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.label}>{column.label}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="cd-empty">
                      {search ? "No matching records." : "No records found."}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, index) => (
                    <RecordRow
                      key={record.id ?? `record-${index}`}
                      record={record}
                      index={index}
                      config={config}
                      isDeleting={deletingId === record.id}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onOpenPdf={openPdf}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
