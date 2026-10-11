import { useEffect, useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { listAnalysis } from "../services/api";

const TYPE_COLORS = {
  reasoning: "#7c5fff",
  summarization: "#4ecdc4",
  multi_hop: "#ffb703",
  direct: "#06d6a0",
  standard: "#4895ef",
  unknown: "#8d99ae",
};

const PIE_PALETTE = ["#7c5fff", "#4ecdc4", "#ffb703", "#06d6a0", "#f72585", "#4895ef"];

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

  // Chart 1: Latency timeline (in chronologic order for graph)
  const latencyData = useMemo(() => {
    return [...analyses]
      .reverse()
      .map((item, idx) => ({
        index: `Q${idx + 1}`,
        query: item.query.length > 30 ? item.query.substring(0, 30) + "…" : item.query,
        latencyMs: Math.round(item.latency_ms || 0),
        latencySec: Number(((item.latency_ms || 0) / 1000).toFixed(1)),
        chunks: item.retrieved_chunks || 0,
        confidencePct: Math.round((item.confidence || 0) * 100),
      }));
  }, [analyses]);

  // Chart 2: Query type distribution
  const distributionData = useMemo(() => {
    const counts = {};
    analyses.forEach((a) => {
      const t = (a.query_type || "standard").toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.keys(counts).map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      count: counts[key],
      rawKey: key,
    }));
  }, [analyses]);

  // Chart 3: Chunks & Confidence comparison
  const retrievalData = useMemo(() => {
    return [...analyses]
      .reverse()
      .slice(-8)
      .map((item, idx) => ({
        name: `Q${idx + 1}`,
        chunks: item.retrieved_chunks || 0,
        confidence: Math.round((item.confidence || 0) * 100),
        query: item.query.length > 25 ? item.query.substring(0, 25) + "…" : item.query,
      }));
  }, [analyses]);

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
          <span>↻</span> Refresh Telemetry
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
          <div className="stat-value">{(avgLatency / 1000).toFixed(1)}s</div>
          <div className="stat-description">{avgLatency} ms average latency</div>
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
          <div className="stat-description">Tokens synthesized</div>
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        {/* CHART 1: LATENCY TIMELINE */}
        <div className="pipeline-card" style={{ padding: "20px" }}>
          <div className="eyebrow">PERFORMANCE TIMELINE</div>
          <h3 style={{ margin: "4px 0 16px", fontSize: "15px", color: "var(--text)" }}>Response Latency (Seconds)</h3>
          <div style={{ height: "220px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c5fff" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#7c5fff" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="index" stroke="var(--text-4)" fontSize={11} />
                <YAxis stroke="var(--text-4)" fontSize={11} unit="s" />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--bg-3)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value) => [`${value}s`, "Latency"]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.query || label}
                />
                <Area type="monotone" dataKey="latencySec" stroke="#7c5fff" strokeWidth={2} fillOpacity={1} fill="url(#latencyGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: ROUTING INTENT DISTRIBUTION */}
        <div className="pipeline-card" style={{ padding: "20px" }}>
          <div className="eyebrow">ADAPTIVE ROUTER</div>
          <h3 style={{ margin: "4px 0 16px", fontSize: "15px", color: "var(--text)" }}>Query Intent Classification</h3>
          <div style={{ height: "220px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={TYPE_COLORS[entry.rawKey] || PIE_PALETTE[index % PIE_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--bg-3)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value, name) => [`${value} queries`, name]}
                />
                <Legend
                  formatter={(value) => <span style={{ color: "var(--text-2)", fontSize: "12px" }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 3: RETRIEVAL DEPTH & CONFIDENCE */}
        <div className="pipeline-card" style={{ padding: "20px", gridColumn: "1 / -1" }}>
          <div className="eyebrow">GROUNDEDNESS & EVIDENCE</div>
          <h3 style={{ margin: "4px 0 16px", fontSize: "15px", color: "var(--text)" }}>Retrieved Chunks vs. Answer Confidence (%)</h3>
          <div style={{ height: "200px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retrievalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="var(--text-4)" fontSize={11} />
                <YAxis yAxisId="left" stroke="var(--accent-2)" fontSize={11} unit=" chunks" />
                <YAxis yAxisId="right" orientation="right" stroke="var(--green)" fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--bg-3)", borderColor: "var(--border)", borderRadius: "8px", fontSize: "12px" }}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.query || label}
                />
                <Legend formatter={(value) => <span style={{ color: "var(--text-2)", fontSize: "12px" }}>{value}</span>} />
                <Bar yAxisId="left" dataKey="chunks" name="Retrieved Chunks" fill="var(--accent-2)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="confidence" name="Confidence (%)" fill="var(--green)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* DETAILED INSPECTION */}
      {selectedRecord && (
        <div className="pipeline-card" style={{ marginBottom: "32px" }}>
          <div className="pipeline-header">
            <div>
              <div className="eyebrow">QUERY TRACE INSPECTION</div>
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
              <span style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis" }}>
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
        <h2>Recent Query Execution Log</h2>
        <p>Click any row to trace the exact routing and latency breakdown above.</p>
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
