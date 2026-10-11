import { useRef, useState } from "react";
import { deleteDocument, uploadDocument } from "../services/api";

const ACCEPTED = ".pdf,.txt,.docx,.md";

function DocumentsPanel({ documents, onDocumentsChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const file = fileList?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    try {
      const document = await uploadDocument(file);
      onDocumentsChange((prev) => [document, ...prev]);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDocument(id);
      onDocumentsChange((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      setError(err.message || "Could not delete that document.");
    }
  };

  return (
    <div className="documents-page">
      <div className="dashboard-heading">
        <div>
          <div className="eyebrow">DOCUMENT LIBRARY</div>
          <h1>Your research documents.</h1>
          <p>Upload PDFs, DOCX, TXT or Markdown to ask questions about them.</p>
        </div>
      </div>

      <section
        className={`upload-area ${dragActive ? "drag-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="upload-icon">↑</div>

        <div className="upload-text">
          <strong>{uploading ? "Uploading…" : "Drop a document here"}</strong>
          <span>PDF, DOCX, TXT or Markdown</span>
        </div>

        <button
          type="button"
          className="browse-button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Browse files
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </section>

      {error && <div className="chat-error">{error}</div>}

      <div className="section-header">
        <div>
          <h2>Uploaded</h2>
          <p>{documents.length} document{documents.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="empty-recent" style={{ padding: "24px 0" }}>
          <span>◇</span>
          No documents uploaded yet
        </div>
      ) : (
        <div className="document-list">
          {documents.map((doc) => (
            <div className="document-row" key={doc.id}>
              <div className="document-row-icon">▣</div>

              <div className="document-row-info">
                <strong>{doc.filename}</strong>
                <span>
                  {doc.file_type.replace(".", "").toUpperCase()} ·{" "}
                  {new Date(doc.created_at).toLocaleDateString()} · {doc.status}
                </span>
              </div>

              <button
                className="document-row-delete"
                title="Delete document"
                onClick={() => handleDelete(doc.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentsPanel;
