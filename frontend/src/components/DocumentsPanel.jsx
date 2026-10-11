import { useRef, useState } from "react";
import { FileText, UploadCloud, Trash2, FolderOpen } from "lucide-react";
import { deleteDocument, uploadDocument } from "../services/api";

const ACCEPTED = ".pdf,.txt,.docx,.md";

function DocumentsPanel({ documents, onDocumentsChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];

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
    if (!window.confirm("Delete this document from the library?")) return;
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
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UploadCloud size={32} color="var(--accent-2)" />
        </div>

        <h2>Drop files here, or browse</h2>
        <p>PDF, DOCX, TXT and Markdown files are supported.</p>

        <button
          type="button"
          className="primary-button"
          disabled={uploading}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <FolderOpen size={15} />
          <span>{uploading ? "Uploading & chunking…" : "Select a file"}</span>
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
          <h2>Uploaded Documents</h2>
          <p>{documents.length} document{documents.length === 1 ? "" : "s"} in vector cache</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="empty-recent" style={{ padding: "32px 0", textAlign: "center" }}>
          <span style={{ fontSize: "12px", opacity: 0.7 }}>No documents uploaded yet. Add a PDF to get started.</span>
        </div>
      ) : (
        <div className="document-list">
          {documents.map((doc) => (
            <div className="document-row" key={doc.id}>
              <div className="document-row-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={18} color="var(--accent-2)" />
              </div>

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
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentsPanel;
