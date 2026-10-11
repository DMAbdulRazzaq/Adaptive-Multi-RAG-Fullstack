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
    user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <aside className="sidebar">

      {/* BRAND */}

      <div className="brand">

        <div className="brand-logo">
          A
        </div>

        <div className="brand-text">
          <strong>
            Adaptive RAG
          </strong>

          <span>
            Research Intelligence
          </span>
        </div>

      </div>


      {/* NEW RESEARCH */}

      <button
        className="new-research-button"
        onClick={onNewResearch}
      >
        <span className="new-icon">
          ＋
        </span>

        <span>
          New research
        </span>
      </button>


      {/* NAVIGATION */}

      <div className="sidebar-section">

        <div className="sidebar-label">
          WORKSPACE
        </div>

        <NavItem
          icon="⌂"
          label="Dashboard"
          active={activePage === "dashboard"}
          onClick={() => onNavigate("dashboard")}
        />

        <NavItem
          icon="✦"
          label="Research Assistant"
          active={activePage === "chat"}
          onClick={() => onNavigate("chat")}
        />

        <NavItem
          icon="◉"
          label="Live Analysis"
          active={activePage === "analysis"}
          onClick={() => onNavigate("analysis")}
          badge="LIVE"
        />

        <NavItem
          icon="▣"
          label="Documents"
          active={activePage === "documents"}
          onClick={() => onNavigate("documents")}
        />

      </div>


      {/* RECENT */}

      <div className="sidebar-section recent-section">

        <div className="sidebar-label">
          RECENT
        </div>

        {conversations.length === 0 ? (
          <div className="empty-recent">
            <span>◇</span>
            No conversations yet
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
                  ✕
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
            <strong>
              RAG Engine
            </strong>

            <span>
              System ready
            </span>
          </div>

        </div>


        <NavItem
          icon="⚙"
          label="Settings"
          active={activePage === "settings"}
          onClick={() => onNavigate("settings")}
        />


        {/* USER */}

        <div className="user-profile">

          <div className="user-avatar">
            {firstLetter}
          </div>

          <div className="user-details">

            <strong>
              {user?.name || "User"}
            </strong>

            <span>
              {user?.email || ""}
            </span>

          </div>

          <button
            className="logout-button"
            onClick={onLogout}
            title="Log out"
          >
            ↪
          </button>

        </div>


        <div className="sidebar-version">
          Adaptive Multi-RAG · v1.0
        </div>

      </div>

    </aside>
  );
}


function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >

      <span className="nav-icon">
        {icon}
      </span>

      <span className="nav-label">
        {label}
      </span>

      {badge && (
        <span className="nav-badge">
          {badge}
        </span>
      )}

      {active && (
        <span className="nav-active-indicator" />
      )}

    </button>
  );
}


export default Sidebar;