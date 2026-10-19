
import { useEffect, useMemo, useRef, useState } from "react";
import "./Circulars.css";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const API_URL = `${API_BASE}/circulars`;

const COLUMN_NAMES = {
  documentNo: "Document No",
  referenceNo: "Reference No",
  date: "Date",
  description: "Description",
};

// =====================================================
// TEXT HELPERS
// =====================================================

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value) {
  if (!value) return new Date(0);

  const text = String(value).trim();

  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1])
    );
  }

  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
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

  // A filename without a path: assumes this backend route.
  return `${API_BASE}/circulars/pdf/${encodeURIComponent(text)}`;
}

function getDownloadUrl(url) {
  const viewUrl = resolvePdfUrl(url);

  if (!viewUrl) return "";

  // For local backend files, request download mode.
  if (viewUrl.startsWith(`${API_BASE}/circulars/pdf/`)) {
    return `${viewUrl}${viewUrl.includes("?") ? "&" : "?"}download=1`;
  }

  return viewUrl;
}

function PdfButtons({ url }) {
  const viewUrl = resolvePdfUrl(url);
  const downloadUrl = getDownloadUrl(url);

  if (!viewUrl) {
    return <span className="pdf-not-available">PDF not available</span>;
  }

  return (
    <div className="description-pdf-buttons">
      <a
        href={viewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pdf-btn"
      >
        View PDF
      </a>

      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pdf-btn"
        download
      >
        Download PDF
      </a>
    </div>
  );
}

// =====================================================
// NORMALIZE API FIELDS
// =====================================================

function normalizeRow(row) {
  return {
    ...row,

    id: row.id ?? row.document_id ?? null,

    documentNo:
      row.documentNo ??
      row.document_no ??
      row.docNo ??
      "",

    referenceNo:
      row.referenceNo ??
      row.reference_no_en ??
      row.reference_no_hi ??
      row.reference_no ??
      "",

    date:
      row.date ??
      row.circular_date ??
      "",

    descriptionEn:
      row.descriptionEn ??
      row.description_en ??
      "",

    descriptionHi:
      row.descriptionHi ??
      row.description_hi ??
      "",

    englishPdf:
      row.englishPdf ??
      row.english_pdf ??
      row.link_en ??
      "",

    hindiPdf:
      row.hindiPdf ??
      row.hindi_pdf ??
      row.link_hi ??
      "",
  };
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function Circulars() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");

  const [sortColumn, setSortColumn] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  const [activeFilters, setActiveFilters] = useState({
    documentNo: new Set(),
    referenceNo: new Set(),
    date: new Set(),
    description: new Set(),
  });

  const [popup, setPopup] = useState(null);
  const [tempSelected, setTempSelected] = useState(new Set());
  const [popupSearch, setPopupSearch] = useState("");

  const popupRef = useRef(null);

  // ===================================================
  // FETCH DATA
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }

        const result = await response.json();

        const rows = Array.isArray(result)
          ? result
          : Array.isArray(result.data)
            ? result.data
            : Array.isArray(result.circulars)
              ? result.circulars
              : Array.isArray(result.result)
                ? result.result
                : null;

        if (!rows) {
          throw new Error(
            result.error || "Invalid API response format."
          );
        }

        if (!cancelled) {
          setAllData(rows.map(normalizeRow));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // ===================================================
  // CLOSE FILTER POPUP ON OUTSIDE CLICK
  // ===================================================

  useEffect(() => {
    function handleClick(event) {
      if (!popup) return;

      if (
        popupRef.current &&
        !popupRef.current.contains(event.target) &&
        !event.target.closest(".filter-button")
      ) {
        setPopup(null);
      }
    }

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [popup]);

  // ===================================================
  // TABLE HELPERS
  // ===================================================

  function getColumnValue(row, column) {
    switch (column) {
      case "documentNo":
        return row.documentNo || "";

      case "referenceNo":
        return row.referenceNo || "";

      case "date":
        return row.date || "";

      case "description":
        return [row.descriptionEn, row.descriptionHi]
          .filter(Boolean)
          .join(" | ");

      default:
        return "";
    }
  }

  function getUniqueValues(column) {
    const values = new Map();

    allData.forEach((row) => {
      if (column === "description") {
        [row.descriptionEn, row.descriptionHi].forEach(
          (description) => {
            if (!description) return;

            const key = normalizeText(description);

            if (!values.has(key)) {
              values.set(key, description);
            }
          }
        );
      } else {
        const value = getColumnValue(row, column);

        if (!value) return;

        const key = normalizeText(value);

        if (!values.has(key)) {
          values.set(key, value);
        }
      }
    });

    return Array.from(values.values()).sort((a, b) => {
      if (column === "date") {
        return parseDate(b) - parseDate(a);
      }

      return String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }

  // ===================================================
  // SEARCH, FILTER AND SORT
  // ===================================================

  const filteredData = useMemo(() => {
    const searchNorm = normalizeText(search);

    let result = allData.filter((row) => {
      if (searchNorm) {
        const searchable = normalizeText(
          [
            row.documentNo,
            row.referenceNo,
            row.date,
            row.descriptionEn,
            row.descriptionHi,
          ]
            .filter(Boolean)
            .join(" ")
        );

        if (!searchable.includes(searchNorm)) return false;
      }

      if (
        activeFilters.documentNo.size &&
        !activeFilters.documentNo.has(normalizeText(row.documentNo))
      ) {
        return false;
      }

      if (
        activeFilters.referenceNo.size &&
        !activeFilters.referenceNo.has(normalizeText(row.referenceNo))
      ) {
        return false;
      }

      if (
        activeFilters.date.size &&
        !activeFilters.date.has(normalizeText(row.date))
      ) {
        return false;
      }

      if (activeFilters.description.size) {
        const en = normalizeText(row.descriptionEn);
        const hi = normalizeText(row.descriptionHi);

        if (
          !activeFilters.description.has(en) &&
          !activeFilters.description.has(hi)
        ) {
          return false;
        }
      }

      if (
        language === "english" &&
        !row.descriptionEn &&
        !row.englishPdf
      ) {
        return false;
      }

      if (
        language === "hindi" &&
        !row.descriptionHi &&
        !row.hindiPdf
      ) {
        return false;
      }

      return true;
    });

    result.sort((a, b) => {
      let comparison;

      if (sortColumn === "date") {
        comparison = parseDate(a.date) - parseDate(b.date);
      } else {
        comparison = normalizeText(
          getColumnValue(a, sortColumn)
        ).localeCompare(
          normalizeText(getColumnValue(b, sortColumn)),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    allData,
    search,
    language,
    activeFilters,
    sortColumn,
    sortDirection,
  ]);

  // ===================================================
  // SORT HANDLER
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
  // FILTER POPUP HANDLERS
  // ===================================================

  function openFilter(column, event) {
    setTempSelected(new Set(activeFilters[column]));
    setPopupSearch("");

    let top = 0;
    let left = 0;

    if (window.innerWidth > 720 && event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const popupWidth = 280;

      left = rect.left;
      top = rect.bottom + 5;

      if (left + popupWidth > window.innerWidth - 10) {
        left = window.innerWidth - popupWidth - 10;
      }

      if (top + 430 > window.innerHeight) {
        top = rect.top - 435;
      }

      left = Math.max(10, left);
      top = Math.max(10, top);
    }

    setPopup({ column, top, left });
  }

  function closePopup() {
    setPopup(null);
  }

  function toggleTempValue(value) {
    const key = normalizeText(value);

    setTempSelected((previous) => {
      const next = new Set(previous);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });
  }

  function selectAllTemp() {
    if (!popup) return;

    const values = getUniqueValues(popup.column);

    setTempSelected((previous) => {
      const next = new Set(previous);
      values.forEach((value) => next.add(normalizeText(value)));
      return next;
    });
  }

  function clearTemp() {
    setTempSelected(new Set());
  }

  function applyFilter() {
    if (!popup) return;

    setActiveFilters((previous) => ({
      ...previous,
      [popup.column]: new Set(tempSelected),
    }));

    closePopup();
  }

  function removeFilterValue(column, value) {
    setActiveFilters((previous) => {
      const next = { ...previous };
      const values = new Set(previous[column]);

      values.delete(value);
      next[column] = values;

      return next;
    });
  }

  function clearAllFilters() {
    setActiveFilters({
      documentNo: new Set(),
      referenceNo: new Set(),
      date: new Set(),
      description: new Set(),
    });

    setSearch("");
    setLanguage("all");
  }

  const popupValues = useMemo(() => {
    if (!popup) return [];

    let values = getUniqueValues(popup.column);
    const searchValue = normalizeText(popupSearch);

    if (searchValue) {
      values = values.filter((value) =>
        normalizeText(value).includes(searchValue)
      );
    }

    return values;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, popupSearch, allData]);

  const activeFilterTags = [];

  Object.keys(activeFilters).forEach((column) => {
    activeFilters[column].forEach((value) => {
      activeFilterTags.push({ column, value });
    });
  });

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="circulars-page">
      <div className="container">
        <div className="filter-bar">
          <input
            className="search-box"
            type="text"
            placeholder="Search Document No, Reference No, Date or Description..."
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="all">All Languages</option>
            <option value="english">English</option>
            <option value="hindi">हिन्दी</option>
          </select>

          <button
            className="clear-all"
            type="button"
            onClick={clearAllFilters}
          >
            Clear All
          </button>
        </div>

        <div className="mobile-sort-bar">
          <select
            value={sortColumn}
            onChange={(event) => handleSort(event.target.value)}
          >
            <option value="date">Sort by: Date</option>
            <option value="documentNo">Sort by: Document No</option>
            <option value="referenceNo">Sort by: Reference No</option>
            <option value="description">Sort by: Description</option>
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

        <div className="active-filters">
          {activeFilterTags.map(({ column, value }) => (
            <div className="filter-tag" key={column + value}>
              {COLUMN_NAMES[column]}: {value}

              <button
                type="button"
                title="Remove filter"
                onClick={() => removeFilterValue(column, value)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {(loading || error) && (
          <div className={`status${error ? " error" : ""}`}>
            {loading ? (
              "Loading data..."
            ) : (
              <>
                Unable to load data.
                <br />
                <br />
                {error}
                <br />
                <br />
                Please check your Node.js API and database.
              </>
            )}
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>
                  <div className="header-content">
                    <span>Sr No</span>
                  </div>
                </th>

                {[
                  "documentNo",
                  "referenceNo",
                  "date",
                  "description",
                ].map((column) => (
                  <th key={column} className="filter-button">
                    <div className="header-content">
                      <span
                        className="header-title"
                        onClick={() => handleSort(column)}
                      >
                        {COLUMN_NAMES[column]}

                        <span className="sort-icon">
                          {sortColumn === column
                            ? sortDirection === "asc"
                              ? "▲"
                              : "▼"
                            : ""}
                        </span>
                      </span>

                      <span
                        style={{ cursor: "pointer" }}
                        onClick={(event) => openFilter(column, event)}
                        title={`Filter ${COLUMN_NAMES[column]}`}
                      >
                        ⏷
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!loading && filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="no-data">
                    No data found
                  </td>
                </tr>
              )}

              {filteredData.map((row, index) => {
                const showEn =
                  row.descriptionEn &&
                  (language === "all" || language === "english");

                const showHi =
                  row.descriptionHi &&
                  (language === "all" || language === "hindi");

                return (
                  <tr
                    key={
                      row.id ??
                      `${row.documentNo}-${row.referenceNo}-${index}`
                    }
                  >
                    <td data-label="Sr No">{index + 1}</td>

                    <td data-label="Document No">
                      {row.documentNo || ""}
                    </td>

                    <td data-label="Reference No">
                      {row.referenceNo || ""}
                    </td>

                    <td data-label="Date">{row.date || ""}</td>

                    <td className="description" data-label="Description">
                      {!showEn && !showHi && (
                        <span style={{ color: "#999" }}>—</span>
                      )}

                      {showEn && (
                        <div className="description-language-block">
                          <div className="description-text">
                            {row.descriptionEn}
                          </div>

                          <PdfButtons url={row.englishPdf} />
                        </div>
                      )}

                      {showHi && (
                        <div className="description-language-block">
                          <div className="description-text">
                            {row.descriptionHi}
                          </div>

                          <PdfButtons url={row.hindiPdf} />
                        </div>
                      )}

                      {!row.descriptionEn &&
                        !row.descriptionHi &&
                        (row.englishPdf || row.hindiPdf) && (
                          <div className="description-language-block">
                            <PdfButtons url={row.englishPdf || row.hindiPdf} />
                          </div>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="count">
          Showing {filteredData.length} of {allData.length} records
        </div>
      </div>

      {popup && (
        <div
          className="filter-popup active"
          ref={popupRef}
          style={
            window.innerWidth > 720
              ? { top: popup.top, left: popup.left }
              : {}
          }
        >
          <div className="popup-header">
            Filter {COLUMN_NAMES[popup.column]}
          </div>

          <input
            className="popup-search"
            type="text"
            placeholder="Search values..."
            value={popupSearch}
            onChange={(event) => setPopupSearch(event.target.value)}
          />

          <div className="popup-actions">
            <button
              type="button"
              className="popup-action"
              onClick={selectAllTemp}
            >
              Select All
            </button>

            <button
              type="button"
              className="popup-action"
              onClick={clearTemp}
            >
              Clear Filter
            </button>
          </div>

          <div className="selected-count">
            {tempSelected.size} selected
          </div>

          <div className="filter-options">
            {popupValues.length === 0 && (
              <div className="no-options">No values found</div>
            )}

            {popupValues.map((value) => (
              <label className="filter-option" key={value}>
                <input
                  type="checkbox"
                  checked={tempSelected.has(normalizeText(value))}
                  onChange={() => toggleTempValue(value)}
                />

                <span className="option-text">{value}</span>
              </label>
            ))}
          </div>

          <div className="popup-footer">
            <button
              type="button"
              className="apply-btn"
              onClick={applyFilter}
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
