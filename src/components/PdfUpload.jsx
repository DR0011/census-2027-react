
import React, { useEffect, useState } from "react";
import "./PdfUpload.css";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("census_token") ||
    sessionStorage.getItem("census_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export default function PdfUpload() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);

  const authHeaders = () => {
    const token = getToken();

    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  };

  const loadPdfs = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/pdfs`, {
        headers: authHeaders(),
      });

      const data = await readResponse(response);

      setPdfs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load PDFs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPdfs();
  }, []);

  const handleUpload = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!title.trim()) {
      setError("Please enter a PDF title.");
      return;
    }

    if (!file) {
      setError("Please select a PDF file.");
      return;
    }

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF files are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("PDF size must be 10 MB or less.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("pdf", file);

    setUploading(true);

    try {
      const response = await fetch(
        `${API_BASE}/pdfs/upload`,
        {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        }
      );

      const data = await readResponse(response);

      setMessage(data.message || "PDF uploaded successfully.");
      setTitle("");
      setFile(null);

      const input = document.getElementById("pdf-file-input");
      if (input) input.value = "";

      await loadPdfs();
    } catch (err) {
      setError(err.message || "PDF upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const getFileUrl = (id, download = false) =>
    `${API_BASE}/pdfs/${id}/file${
      download ? "?download=1" : ""
    }`;

  const openPdf = async (pdf, download = false) => {
    setError("");

    try {
      const response = await fetch(getFileUrl(pdf.id, download), {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Unable to access PDF.");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (download) {
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = pdf.original_name || "document.pdf";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } else {
        setPreview((old) => {
          if (old?.url) URL.revokeObjectURL(old.url);
          return {
            url: blobUrl,
            title: pdf.title,
          };
        });
      }
    } catch (err) {
      setError(err.message || "Unable to open PDF.");
    }
  };

  const deletePdf = async (pdf) => {
    const confirmed = window.confirm(
      `Delete "${pdf.title}" permanently?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/pdfs/${pdf.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await readResponse(response);

      setMessage(data.message || "PDF deleted successfully.");

      if (preview?.title === pdf.title) {
        setPreview((old) => {
          if (old?.url) URL.revokeObjectURL(old.url);
          return null;
        });
      }

      await loadPdfs();
    } catch (err) {
      setError(err.message || "Unable to delete PDF.");
    }
  };

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  return (
    <main className="pdf-page">
      <header className="pdf-page-header">
        <div>
          <h1>PDF Document Management</h1>
          <p>Upload, preview, download and manage PDF documents.</p>
        </div>

        <button
          type="button"
          className="pdf-btn pdf-btn-secondary"
          onClick={loadPdfs}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="pdf-alert pdf-alert-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="pdf-alert pdf-alert-success" role="status">
          {message}
        </div>
      )}

      <section className="pdf-panel">
        <h2>Upload New PDF</h2>

        <form onSubmit={handleUpload}>
          <div className="pdf-form-group">
            <label htmlFor="pdf-title">Document Title</label>
            <input
              id="pdf-title"
              type="text"
              maxLength={255}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter document title"
              required
            />
          </div>

          <div className="pdf-form-group">
            <label htmlFor="pdf-file-input">Select PDF File</label>
            <input
              id="pdf-file-input"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) =>
                setFile(event.target.files?.[0] || null)
              }
              required
            />
            <small>PDF only. Maximum file size: 10 MB.</small>
          </div>

          {file && (
            <p className="pdf-selected-file">
              Selected: {file.name} (
              {(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          )}

          <button
            type="submit"
            className="pdf-btn pdf-btn-primary"
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload PDF"}
          </button>
        </form>
      </section>

      <section className="pdf-panel">
        <h2>Uploaded PDFs ({pdfs.length})</h2>

        {loading && <p>Loading documents...</p>}

        {!loading && pdfs.length === 0 && (
          <p>No PDF documents uploaded yet.</p>
        )}

        {pdfs.length > 0 && (
          <div className="pdf-table-wrapper">
            <table className="pdf-table">
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Title</th>
                  <th>Original File</th>
                  <th>Size</th>
                  <th>Uploaded Date</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {pdfs.map((pdf, index) => (
                  <tr key={pdf.id}>
                    <td>{index + 1}</td>
                    <td>{pdf.title}</td>
                    <td>{pdf.original_name}</td>
                    <td>
                      {(Number(pdf.file_size) / (1024 * 1024))
                        .toFixed(2)}{" "}
                      MB
                    </td>
                    <td>
                      {pdf.uploaded_at
                        ? new Date(pdf.uploaded_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <div className="pdf-actions">
                        <button
                          type="button"
                          className="pdf-btn pdf-btn-view"
                          onClick={() => openPdf(pdf)}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="pdf-btn pdf-btn-download"
                          onClick={() => openPdf(pdf, true)}
                        >
                          Download
                        </button>

                        <button
                          type="button"
                          className="pdf-btn pdf-btn-delete"
                          onClick={() => deletePdf(pdf)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview && (
        <section className="pdf-panel pdf-preview-panel">
          <div className="pdf-preview-header">
            <h2>{preview.title}</h2>

            <button
              type="button"
              className="pdf-btn pdf-btn-secondary"
              onClick={() =>
                setPreview((old) => {
                  if (old?.url) URL.revokeObjectURL(old.url);
                  return null;
                })
              }
            >
              Close Preview
            </button>
          </div>

          <iframe
            className="pdf-preview-frame"
            src={preview.url}
            title={`PDF preview: ${preview.title}`}
          />
        </section>
      )}
    </main>
  );
}
