
import { useEffect, useMemo, useState } from "react";
import "./Documents.css";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const API_URL = `${API_BASE}/documents`;

function pick(item, keys) {
  for (const key of keys) {
    if (
      item[key] !== undefined &&
      item[key] !== null &&
      String(item[key]).trim() !== ""
    ) {
      return item[key];
    }
  }

  return "";
}

// =====================================================
// NORMALIZE API RESPONSE
// =====================================================

function normalizeItem(item) {
  return {
    ...item,

    id: item.id ?? item.document_id ?? null,

    documentNo: pick(item, [
      "documentNo",
      "document_no",
      "docNo",
      "Document No",
      "Document No.",
      "Doc No",
    ]),

    referenceNo: pick(item, [
      "referenceNo",
      "reference_no",
      "refNo",
      "Reference No",
      "Reference No.",
      "Ref No",
    ]),

    date: pick(item, [
      "date",
      "circular_date",
      "Date",
    ]),

    description: pick(item, [
      "description",
      "description_gu",
      "Description",
      "subject",
      "Subject",
      "Circular Subject",
    ]),

    type: pick(item, [
      "type",
      "circular_type",
      "Type",
    ]),

    pdf: pick(item, [
      "pdf",
      "PDF",
      "pdfUrl",
      "pdfURL",
      "PDF Link",
      "gujaratiPdf",
      "gujarati_pdf",
      "Gujarati PDF",
      "Gujarati Pdf",
    ]),
  };
}

// =====================================================
// DATE HELPER
// =====================================================

function parseDate(value) {
  if (!value) return 0;

  const text = String(value).trim();

  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1])
    ).getTime();
  }

  match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

  if (match) {
    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1])
    ).getTime();
  }

  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    ).getTime();
  }

  const parsed = Date.parse(text);

  return Number.isNaN(parsed) ? 0 : parsed;
}

// =====================================================
// PDF HELPERS
// =====================================================

function getGoogleDriveFileId(url) {
  if (!url) return "";

  const text = String(url).trim();

  let match = text.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i
  );

  if (match) return match[1];

  match = text.match(/[?&]id=([a-zA-Z0-9_-]+)/i);

  if (match) return match[1];

  return "";
}

function resolvePdfUrl(url) {
  if (!url) return "";

  const text = String(url).trim();

  if (/^https?:\/\//i.test(text)) {
    const fileId = getGoogleDriveFileId(text);

    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/view`;
    }

    return text;
  }

  const origin = API_BASE.replace(/\/api\/?$/, "");

  if (text.startsWith("/api/")) {
    return `${origin}${text}`;
  }

  if (text.startsWith("/circulars/")) {
    return `${origin}/api${text}`;
  }

  if (text.startsWith("/")) {
    return `${origin}${text}`;
  }

  // Assumes backend serves stored filenames at this route.
  return `${API_BASE}/circulars/pdf/${encodeURIComponent(text)}`;
}

function getDownloadUrl(url) {
  const viewUrl = resolvePdfUrl(url);

  if (!viewUrl) return "";

  if (viewUrl.startsWith(`${API_BASE}/circulars/pdf/`)) {
    return `${viewUrl}${viewUrl.includes("?") ? "&" : "?"}download=1`;
  }

  return viewUrl;
}

function PdfButtons({ url }) {
  const viewUrl = resolvePdfUrl(url);
  const downloadUrl = getDownloadUrl(url);

  if (!viewUrl) {
    return <span className="no-pdf">PDF not available</span>;
  }

  return (
    <div className="pdf-buttons">
      <a
        className="pdf-btn view-btn"
        href={viewUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        View PDF
      </a>

      <a
        className="pdf-btn download-btn"
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        download
      >
        Download PDF
      </a>
    </div>
  );
}

// =====================================================
// SORTABLE COLUMNS
// =====================================================

const SORTABLE_COLUMNS = {
  documentNo: "Document No",
  referenceNo: "Reference No",
  date: "Date",
  description: "Description",
  type: "Type",
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function Documents() {
  const [allData, setAllData] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  // ===================================================
  // FETCH DATA
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setStatus("loading");
        setErrorMessage("");

        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(
            `API request failed with status ${response.status}`
          );
        }

        const result = await response.json();

        let items;

        if (Array.isArray(result)) {
          items = result;
        } else if (Array.isArray(result.data)) {
          items = result.data;
        } else if (Array.isArray(result.documents)) {
          items = result.documents;
        } else if (Array.isArray(result.result)) {
          items = result.result;
        } else {
          throw new Error("Invalid API data format");
        }

        if (!cancelled) {
          setAllData(items.map(normalizeItem));
          setStatus("ready");
        }
      } catch (err) {
        console.error("DCO documents API error:", err);

        if (!cancelled) {
          setErrorMessage(err.message || "Unable to load API data.");
          setStatus("error");
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // ===================================================
  // SORT
  // ===================================================

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDirection((direction) =>
        direction === "asc" ? "desc" : "asc"
      );
    } else {
      setSortColumn(column);
      setSortDirection(column === "date" ? "desc" : "asc");
    }
  }

  // ===================================================
  // SEARCH AND SORT DATA
  // ===================================================

  const filteredData = useMemo(() => {
    const term = search.toLowerCase().trim();

    let result = term
      ? allData.filter((item) =>
          [
            item.documentNo,
            item.referenceNo,
            item.date,
            item.description,
            item.type,
          ].some((value) =>
            String(value ?? "").toLowerCase().includes(term)
          )
        )
      : [...allData];

    result = [...result].sort((a, b) => {
      let valueA = a[sortColumn] ?? "";
      let valueB = b[sortColumn] ?? "";

      if (sortColumn === "date") {
        valueA = parseDate(valueA);
        valueB = parseDate(valueB);
      } else {
        valueA = String(valueA).toLowerCase().trim();
        valueB = String(valueB).toLowerCase().trim();
      }

      if (valueA < valueB) {
        return sortDirection === "asc" ? -1 : 1;
      }

      if (valueA > valueB) {
        return sortDirection === "asc" ? 1 : -1;
      }

      return 0;
    });

    return result;
  }, [allData, search, sortColumn, sortDirection]);

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="documents-page">
      <div className="container">
        <div className="header">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search Document No, Reference No, Description, Type..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="mobile-sort-bar">
            <select
              value={sortColumn}
              onChange={(event) => handleSort(event.target.value)}
            >
              {Object.entries(SORTABLE_COLUMNS).map(([key, label]) => (
                <option key={key} value={key}>
                  Sort by: {label}
                </option>
              ))}
            </select>

            <button
              type="button"
              title="Toggle sort direction"
              onClick={() =>
                setSortDirection((direction) =>
                  direction === "asc" ? "desc" : "asc"
                )
              }
            >
              {sortDirection === "asc" ? "▲" : "▼"}
            </button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Sr No</th>

                {Object.entries(SORTABLE_COLUMNS).map(([key, label]) => (
                  <th
                    key={key}
                    data-sortable
                    onClick={() => handleSort(key)}
                  >
                    {label}{" "}
                    {sortColumn === key
                      ? sortDirection === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </th>
                ))}

                <th>PDF</th>
              </tr>
            </thead>

            <tbody>
              {status === "loading" && (
                <tr>
                  <td colSpan={7} className="loading">
                    Loading data...
                  </td>
                </tr>
              )}

              {status === "error" && (
                <tr>
                  <td colSpan={7} className="error">
                    Unable to load API data.
                    <br />
                    {errorMessage}
                    <br />
                    Check your Node.js API and database.
                  </td>
                </tr>
              )}

              {status === "ready" && filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="no-data">
                    No data found
                  </td>
                </tr>
              )}

              {status === "ready" &&
                filteredData.map((item, index) => (
                  <tr
                    key={
                      item.id ??
                      `${item.documentNo}-${item.referenceNo}-${index}`
                    }
                  >
                    <td>{index + 1}</td>

                    <td data-label="Document No">
                      {item.documentNo}
                    </td>

                    <td data-label="Reference No">
                      {item.referenceNo}
                    </td>

                    <td data-label="Date">{item.date}</td>

                    <td data-label="Description" className="description">
                      {item.description}
                    </td>

                    <td data-label="Type">{item.type}</td>

                    <td data-label="PDF">
                      <PdfButtons url={item.pdf} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="count">
          Showing {filteredData.length} of {allData.length} records
        </div>
      </div>
    </div>
  );
}
