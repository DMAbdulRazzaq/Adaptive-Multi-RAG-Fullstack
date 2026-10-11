import { useEffect, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import DocumentsPanel from "./components/DocumentsPanel";
import LiveAnalysisPanel from "./components/LiveAnalysisPanel";
import {
  fetchCurrentUser,
  getToken,
  listConversations,
  listDocuments,
  deleteConversation,
  logout as apiLogout,
} from "./services/api";
import "./index.css";

const MODELS = [
  {
    id: "gemini",
    modelName: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash",
    provider: "Gemini",
    description: "Hosted, ultra-fast, high free tier quota",
  },
  {
    id: "openai",
    modelName: "gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "OpenAI",
    description: "Hosted, pay-as-you-go",
  },
  {
    id: "mock",
    modelName: "mock",
    name: "Mock",
    provider: "Local",
    description: "No API key needed — for testing the pipeline",
  },
];

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [activePage, setActivePage] = useState("dashboard");
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  // Restore session from a stored JWT, if any, by asking the backend who it belongs to.
  useEffect(() => {
    async function restoreSession() {
      if (!getToken()) {
        setCheckingSession(false);
        return;
      }

      try {
        const restoredUser = await fetchCurrentUser();
        setUser(restoredUser);
      } catch {
        apiLogout();
      } finally {
        setCheckingSession(false);
      }
    }

    restoreSession();
  }, []);

  // Once logged in, load the user's workspace data.
  useEffect(() => {
    if (!user) return;

    listDocuments().then(setDocuments).catch(() => setDocuments([]));
    refreshConversations();
  }, [user]);

  const refreshConversations = async () => {
    try {
      const data = await listConversations();
      setConversations(data);
    } catch {
      // Non-fatal — the sidebar just shows an empty recent list.
    }
  };

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    setActivePage("dashboard");
  };

  const handleLogout = () => {
    apiLogout();
    setUser(null);
    setActivePage("dashboard");
    setDocuments([]);
    setConversations([]);
    setActiveConversationId(null);
  };

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    setShowModelMenu(false);
  };

  const startNewResearch = () => {
    setActiveConversationId(null);
    setActivePage("chat");
  };

  const openConversation = (id) => {
    setActiveConversationId(id);
    setActivePage("chat");
  };

  const handleConversationCreated = (id) => {
    setActiveConversationId(id);
    refreshConversations();
  };

  const handleDeleteConversation = async (id) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  if (checkingSession) {
    return (
      <div className="session-loading">
        <div className="session-loading-mark">A</div>
        Loading your workspace…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const currentModel =
    MODELS.find((model) => model.id === selectedModel) || MODELS[0];

  return (
    <div className="app-shell">

      {/* SIDEBAR */}
      <Sidebar
        user={user}
        activePage={activePage}
        onNavigate={setActivePage}
        onLogout={handleLogout}
        onNewResearch={startNewResearch}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onOpenConversation={openConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* MAIN AREA */}
      <main className="main-area">

        {/* TOP BAR */}
        <header className="topbar">

          <div className="breadcrumb">
            <span className="breadcrumb-muted">
              Adaptive RAG
            </span>

            <span className="breadcrumb-divider">
              /
            </span>

            <span>
              {activePage === "dashboard"
                ? "Dashboard"
                : activePage === "chat"
                ? "Research Assistant"
                : activePage === "analysis"
                ? "Live Analysis"
                : activePage === "documents"
                ? "Documents"
                : "Settings"}
            </span>
          </div>

          <div className="topbar-actions">

            {/* SYSTEM STATUS */}
            <div className="system-status">
              <span className="status-dot" />
              <span>RAG Engine Ready</span>
            </div>

            {/* MODEL SELECTOR */}
            <div className="model-selector-wrapper">

              <button
                className="model-selector"
                onClick={() =>
                  setShowModelMenu(!showModelMenu)
                }
              >
                <div className="model-icon">
                  ✦
                </div>

                <div className="model-info">
                  <span className="model-label">
                    Model
                  </span>

                  <span className="model-name">
                    {currentModel.name}
                  </span>
                </div>

                <span className="model-chevron">
                  {showModelMenu ? "⌃" : "⌄"}
                </span>
              </button>

              {showModelMenu && (
                <div className="model-menu">

                  <div className="model-menu-title">
                    SELECT MODEL
                  </div>

                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      className={`model-option ${
                        selectedModel === model.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        handleModelChange(model.id)
                      }
                    >

                      <div className="model-option-icon">
                        {selectedModel === model.id
                          ? "✓"
                          : "✦"}
                      </div>

                      <div className="model-option-content">
                        <strong>
                          {model.name}
                        </strong>

                        <span>
                          {model.provider} ·{" "}
                          {model.description}
                        </span>
                      </div>

                    </button>
                  ))}

                </div>
              )}

            </div>

            {/* USER AVATAR */}
            <button className="top-avatar">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </button>

          </div>

        </header>

        {/* CONTENT */}
        {activePage === "chat" ? (
          <div className="chat-shell">
            <ChatPanel
              model={currentModel}
              documents={documents}
              conversationId={activeConversationId}
              onConversationCreated={handleConversationCreated}
              onNavigateToDocuments={() => setActivePage("documents")}
              onDeleteConversation={handleDeleteConversation}
            />
          </div>
        ) : (
          <div className="page-container">
            {activePage === "dashboard" && (
              <Dashboard
                user={user}
                onNavigate={setActivePage}
                model={currentModel}
                documentsCount={documents.length}
                conversationsCount={conversations.length}
              />
            )}

            {activePage === "analysis" && (
              <LiveAnalysisPanel />
            )}

            {activePage === "documents" && (
              <DocumentsPanel
                documents={documents}
                onDocumentsChange={setDocuments}
              />
            )}

            {activePage === "settings" && (
              <SettingsPlaceholder
                user={user}
                model={currentModel}
              />
            )}
          </div>
        )}

      </main>

    </div>
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({ user, onNavigate, model, documentsCount, conversationsCount }) {
  const firstName =
    user.name?.split(" ")[0] || "Researcher";

  return (
    <div className="dashboard-page">

      <div className="dashboard-heading">

        <div>
          <div className="eyebrow">
            WORKSPACE OVERVIEW
          </div>

          <h1>
            Good to see you, {firstName}.
          </h1>

          <p>
            Analyze documents, retrieve evidence, and
            generate grounded research answers.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => onNavigate("chat")}
        >
          <span>＋</span>
          New research
        </button>

      </div>


      {/* STATS */}

      <div className="stats-grid">

        <StatCard
          label="Documents"
          value={String(documentsCount)}
          description={
            documentsCount === 0
              ? "No documents uploaded"
              : `${documentsCount} ready to search`
          }
          icon="▣"
        />

        <StatCard
          label="Conversations"
          value={String(conversationsCount)}
          description={
            conversationsCount === 0
              ? "Start your first analysis"
              : "Across all your documents"
          }
          icon="◈"
        />

        <StatCard
          label="Questions answered"
          value="—"
          description="Powered by Adaptive RAG"
          icon="✦"
        />

        <StatCard
          label="Current model"
          value={model.name}
          description={`${model.provider}`}
          icon="◎"
        />

      </div>


      {/* QUICK ACTIONS */}

      <div className="section-header">
        <div>
          <h2>Workspace</h2>
          <p>
            Choose where you want to continue.
          </p>
        </div>
      </div>

      <div className="workspace-grid">

        <WorkspaceCard
          icon="✦"
          title="Research Assistant"
          description="Ask questions about your documents using adaptive retrieval."
          button="Open assistant"
          onClick={() => onNavigate("chat")}
        />

        <WorkspaceCard
          icon="◉"
          title="Live Analysis"
          description="Watch retrieval, reranking, context compression and generation in real time."
          button="View analysis"
          onClick={() => onNavigate("analysis")}
        />

        <WorkspaceCard
          icon="▣"
          title="Document Library"
          description="Upload and manage the documents connected to your workspace."
          button="Manage documents"
          onClick={() => onNavigate("documents")}
        />

      </div>


      {/* PIPELINE */}

      <div className="pipeline-card">

        <div className="pipeline-header">

          <div>
            <div className="eyebrow">
              ADAPTIVE PIPELINE
            </div>

            <h2>
              Retrieval intelligence
            </h2>
          </div>

          <div className="pipeline-status">
            <span className="status-dot" />
            System ready
          </div>

        </div>

        <div className="pipeline">

          <PipelineStep
            number="01"
            title="Query routing"
            description="Classify question"
          />

          <PipelineLine />

          <PipelineStep
            number="02"
            title="Retrieval"
            description="Find evidence"
          />

          <PipelineLine />

          <PipelineStep
            number="03"
            title="Reranking"
            description="Rank relevance"
          />

          <PipelineLine />

          <PipelineStep
            number="04"
            title="Compression"
            description="Reduce noise"
          />

          <PipelineLine />

          <PipelineStep
            number="05"
            title="Generation"
            description="Grounded answer"
          />

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   PLACEHOLDER PAGES (not wired yet)
========================================================= */

function AnalysisPlaceholder() {
  return (
    <div className="empty-page">

      <div className="empty-icon">
        ◉
      </div>

      <div className="eyebrow">
        LIVE ANALYSIS
      </div>

      <h1>
        Watch the RAG pipeline work.
      </h1>

      <p>
        Ask a question in the Research Assistant first — per-question
        retrieval stats (chunks used, confidence, latency) show up under
        each answer there. A dedicated live view of every pipeline stage
        isn't wired up yet.
      </p>

    </div>
  );
}


function SettingsPlaceholder({ user, model }) {
  return (
    <div className="settings-page">

      <div className="eyebrow">
        ACCOUNT SETTINGS
      </div>

      <h1>
        Settings
      </h1>

      <p className="settings-description">
        Manage your Adaptive RAG workspace.
      </p>

      <div className="settings-card">

        <div className="settings-row">
          <span>Name</span>
          <strong>{user.name}</strong>
        </div>

        <div className="settings-row">
          <span>Email</span>
          <strong>{user.email}</strong>
        </div>

        <div className="settings-row">
          <span>Active model</span>
          <strong>{model.name}</strong>
        </div>

        <div className="settings-row">
          <span>Workspace</span>
          <strong>Personal</strong>
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   SMALL COMPONENTS
========================================================= */

function StatCard({
  label,
  value,
  description,
  icon,
}) {
  return (
    <div className="stat-card">

      <div className="stat-top">
        <div className="stat-icon">
          {icon}
        </div>

        <span className="stat-label">
          {label}
        </span>
      </div>

      <div className="stat-value">
        {value}
      </div>

      <div className="stat-description">
        {description}
      </div>

    </div>
  );
}


function WorkspaceCard({
  icon,
  title,
  description,
  button,
  onClick,
}) {
  return (
    <div className="workspace-card">

      <div className="workspace-icon">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {description}
      </p>

      <button
        className="workspace-button"
        onClick={onClick}
      >
        {button}
        <span>→</span>
      </button>

    </div>
  );
}


function PipelineStep({
  number,
  title,
  description,
}) {
  return (
    <div className="pipeline-step">

      <div className="pipeline-number">
        {number}
      </div>

      <strong>
        {title}
      </strong>

      <span>
        {description}
      </span>

    </div>
  );
}


function PipelineLine() {
  return (
    <div className="pipeline-line" />
  );
}


export default App;
