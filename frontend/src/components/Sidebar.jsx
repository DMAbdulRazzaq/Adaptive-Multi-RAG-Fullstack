import {
  LayoutDashboard,
  MessageSquare,
  Activity,
  FileText,
  Settings,
  Plus,
  Trash2,
  LogOut,
  Sparkles,
} from "lucide-react";

function Sidebar({
  user,
  activePage,
  onNavigate,
  onLogout,
  onNewResearch,
  conversations = [],
  activeConversationId,
  onOpenConversation,
  onDeleteConversation,
}) {
  const firstLetter =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <aside className="sidebar">
      {/* BRAND */}
      <div className="brand">
        <div className="brand-logo" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={16} color="#fff" />
        </div>

        <div className="brand-text">
          <strong>Adaptive RAG</strong>
          <span>Enterprise Neural Pipeline</span>
        </div>
      </div>

      {/* NEW RESEARCH BUTTON */}
      <button className="new-chat-button" onClick={onNewResearch}>
        <span className="plus-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={14} />
        </span>
        <span>New research</span>
      </button>

      {/* NAVIGATION */}
      <div className="sidebar-section">
        <div className="sidebar-label">WORKSPACE</div>

        <NavItem
          icon={<LayoutDashboard size={15} />}
          label="Dashboard"
          active={activePage === "dashboard"}
          onClick={() => onNavigate("dashboard")}
        />

        <NavItem
          icon={<MessageSquare size={15} />}
          label="Research Assistant"
          active={activePage === "chat"}
          onClick={() => onNavigate("chat")}
        />

        <NavItem
          icon={<Activity size={15} />}
          label="Live Analysis"
          active={activePage === "analysis"}
          onClick={() => onNavigate("analysis")}
          badge="LIVE"
        />

        <NavItem
          icon={<FileText size={15} />}
          label="Documents"
          active={activePage === "documents"}
          onClick={() => onNavigate("documents")}
        />
      </div>

      {/* RECENT CONVERSATIONS */}
      <div className="sidebar-section recent-section">
        <div className="sidebar-label">RECENT CHATS</div>

        {conversations.length === 0 ? (
          <div className="empty-recent">
            <span style={{ fontSize: "11px", opacity: 0.6 }}>No past conversations</span>
          </div>
        ) : (
          <div className="recent-list">
            {conversations.slice(0, 12).map((conversation) => (
              <div
                key={conversation.id}
                className={`recent-item-row ${
                  conversation.id === activeConversationId ? "active" : ""
                }`}
              >
                <button
                  className="recent-item-title"
                  onClick={() => onOpenConversation?.(conversation.id)}
                  title={conversation.title || "Untitled conversation"}
                >
                  <span className="recent-dot">·</span>
                  <span className="recent-text">{conversation.title || "Untitled conversation"}</span>
                </button>
                <button
                  className="recent-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Delete this conversation?")) {
                      onDeleteConversation?.(conversation.id);
                    }
                  }}
                  title="Delete conversation"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM */}
      <div className="sidebar-bottom">
        <div className="engine-card">
          <div className="engine-icon">
            <span className="status-dot" />
          </div>

          <div>
            <strong>RAG Engine</strong>
            <span>Gemini 3.5 Active</span>
          </div>
        </div>

        <NavItem
          icon={<Settings size={15} />}
          label="Settings"
          active={activePage === "settings"}
          onClick={() => onNavigate("settings")}
        />

        {/* USER PROFILE */}
        <div className="user-profile">
          <div className="user-avatar">{firstLetter}</div>

          <div className="user-info">
            <div className="user-name">{user?.full_name || "Research Scientist"}</div>
            <div className="user-email">{user?.email}</div>
          </div>

          <button
            className="logout-button"
            onClick={onLogout}
            title="Log out"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </span>
      <span className="nav-label">{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
      {active && <span className="nav-active-pill" />}
    </button>
  );
}

export default Sidebar;