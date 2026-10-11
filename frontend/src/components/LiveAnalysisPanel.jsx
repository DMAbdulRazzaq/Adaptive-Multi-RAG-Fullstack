import { useEffect, useState } from "react";
import { listAnalysis } from "../services/api";

function LiveAnalysisPanel() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listAnalysis();
      setAnalyses(data || []);
      if (data && data.length > 0) {
        setSelectedRecord(data[0]);
      }
    } catch (err) {
      console.error("Failed to load analysis:", err);
    } finally {
      setLoading(false);
    }
  };

  const avgLatency = analyses.length
    ? Math.round(
        analyses.reduce((acc, a) => acc + (a.latency_ms || 0), 0) / analyses.length
      )
    : 0;

  const avgConfidence = analyses.length
    ? Math.round(
        (analyses.reduce((acc, a) => acc + (a.confidence || 0), 0) / analyses.length) * 100
      )
    : 0;

  const totalTokens = analyses.reduce((acc, a) => acc + (a.context_tokens || 0), 0);

  if (loading) {
    return (
      <div className="empty-page">
        <div className="session-loading-mark">◉</div>
        <p>Loading real-time pipeline telemetry…</p>
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="empty-page">
        <div className="empty-icon">◉</div>
        <div className="eyebrow">LIVE TELEMETRY</div>
        <h1>No queries analyzed yet.</h1>
        <p>
          Ask a question about your uploaded document in the Research Assistant.
          Real-time query routing, token usage, latency, and retrieval steps will appear here!
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <div className="eyebrow">PIPELINE TELEMETRY</div>
          <h1>Live Analysis & Diagnostics</h1>
          <p>
            Real-time telemetry showing adaptive query routing, vector retrieval, and LLM synthesis performance.
          </p>
        </div>
        <button className="primary-button" onClick={loadData}>
          <span>↻</span> Refresh
        </button>
      </div>

      {/* METRICS GRID */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">◈</div>
            <span className="stat-label">Total Queries</span>
          </div>
          <div className="stat-value">{analyses.length}</div>
          <div className="stat-description">Analyzed RAG queries</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">⚡</div>
            <span className="stat-label">Avg Latency</span>
          </div>
          <div className="stat-value">{avgLatency} ms</div>
          <div className="stat-description">End-to-end response time</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">✦</div>
            <span className="stat-label">Avg Confidence</span>
          </div>
          <div className="stat-value">{avgConfidence}%</div>
          <div className="stat-description">Faithfulness & groundedness</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">▣</div>
            <span className="stat-label">Context Tokens</span>
          </div>
          <div className="stat-value">{totalTokens.toLocaleString()}</div>
          <div className="stat-description">Tokens fed to LLM</div>
        </div>
      </div>

      {/* DETAILED INSPECTION */}
      {selectedRecord && (
        <div className="pipeline-card" style={{ marginBottom: "32px" }}>
          <div className="pipeline-header">
            <div>
              <div className="eyebrow">QUERY TRACE</div>
              <h2>&ldquo;{selectedRecord.query}&rdquo;</h2>
            </div>
            <div className="pipeline-status">
              <span className="status-dot" />
              <span>{new Date(selectedRecord.created_at).toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="pipeline">
            <div className="pipeline-step">
              <div className="pipeline-number">01</div>
              <strong>Routing</strong>
              <span style={{ color: "var(--accent-2)" }}>{selectedRecord.query_type || "Direct"}</span>
            </div>
            <div className="pipeline-line" />

            <div className="pipeline-step">
              <div className="pipeline-number">02</div>
              <strong>Retrieval</strong>
              <span>{selectedRecord.retrieved_chunks || 0} chunks</span>
            </div>
            <div className="pipeline-line" />

            <div className="pipeline-step">
              <div className="pipeline-number">03</div>
              <strong>Context</strong>
              <span>{selectedRecord.context_tokens || 0} tokens</span>
            </div>
            <div className="pipeline-line" />

            <div className="pipeline-step">
              <div className="pipeline-number">04</div>
              <strong>Model</strong>
              <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedRecord.model || "Gemini"}
              </span>
            </div>
            <div className="pipeline-line" />

            <div className="pipeline-step">
              <div className="pipeline-number">05</div>
              <strong>Latency</strong>
              <span style={{ color: "var(--green)" }}>{selectedRecord.latency_ms || 0} ms</span>
            </div>
          </div>
        </div>
      )}

      {/* RECENT QUERIES TABLE */}
      <div className="section-header">
        <h2>Recent Query Analysis History</h2>
        <p>Click any row to inspect its full pipeline trace above.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {analyses.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedRecord(item)}
            className="document-row"
            style={{
              cursor: "pointer",
              borderColor: selectedRecord?.id === item.id ? "var(--accent)" : "var(--border)",
              background: selectedRecord?.id === item.id ? "var(--bg-4)" : "var(--bg-3)",
            }}
          >
            <div className="document-row-icon">◉</div>
            <div className="document-row-info">
              <strong>{item.query}</strong>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px", fontSize: "11px", color: "var(--text-3)" }}>
                <span>Type: <b style={{ color: "var(--text-2)" }}>{item.query_type || "standard"}</b></span>
                <span>·</span>
                <span>Chunks: <b style={{ color: "var(--text-2)" }}>{item.retrieved_chunks || 0}</b></span>
                <span>·</span>
                <span>Confidence: <b style={{ color: "var(--green)" }}>{Math.round((item.confidence || 0) * 100)}%</b></span>
                <span>·</span>
                <span>Latency: <b style={{ color: "var(--text-2)" }}>{item.latency_ms || 0} ms</b></span>
              </div>
            </div>
            <span style={{ fontSize: "10px", color: "var(--text-4)" }}>
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveAnalysisPanel;
