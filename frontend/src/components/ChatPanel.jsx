import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getConversation, sendChatMessage } from "../services/api";

const SUGGESTIONS = [
  {
    icon: "◉",
    title: "Understand the research",
    text: "What is the main contribution of this document?",
  },
  {
    icon: "≡",
    title: "Summarize a section",
    text: "Summarize the methodology used in this document.",
  },
  {
    icon: "◇",
    title: "Analyze the approach",
    text: "Why did the authors choose this approach?",
  },
];

function ChatPanel({
  model,
  documents,
  conversationId,
  onConversationCreated,
  onNavigateToDocuments,
  onDeleteConversation,
}) {
  const [selectedDocId, setSelectedDocId] = useState(
    documents[0]?.id ?? null
  );
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Keep a document selected whenever the list of documents changes.
  useEffect(() => {
    if (!selectedDocId && documents.length > 0) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // Load history when an existing conversation is opened.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingHistory(true);

    getConversation(conversationId)
      .then((data) => {
        if (cancelled) return;
        setMessages(
          data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            confidence: m.confidence,
            chunksUsed: m.chunks_used,
            queryType: m.query_type,
            latencyMs: m.latency_ms,
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Scroll to bottom whenever messages update.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Auto-resize textarea.
  const handleTextareaChange = (e) => {
    setQuestion(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  };

  const submitQuestion = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (!selectedDocId) {
      setError("Pick a document to ask about first.");
      return;
    }

    setError("");
    setQuestion("");
    setSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const result = await sendChatMessage({
        question: trimmed,
        documentId: selectedDocId,
        conversationId,
        model: model?.id,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          confidence: result.confidence,
          chunksUsed: result.chunks_used,
          queryType: result.query_type,
          latencyMs: result.latency_ms,
        },
      ]);

      if (!conversationId && result.conversation_id) {
        onConversationCreated?.(result.conversation_id);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitQuestion(question);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion(question);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="empty-page">
        <div className="empty-icon">▣</div>
        <div className="eyebrow">RESEARCH ASSISTANT</div>
        <h1>Upload a document first.</h1>
        <p>
          Ask questions grounded in your documents. Upload one to get
          started with adaptive retrieval.
        </p>
        <button className="primary-button" onClick={onNavigateToDocuments}>
          <span>＋</span>
          Upload a document
        </button>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="chat-window">
      {/* Document selector toolbar */}
      <div className="chat-toolbar">
        <label className="chat-doc-select">
          <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-4)" }}>
            Context Document
          </span>
          <select
            value={selectedDocId ?? ""}
            onChange={(e) => setSelectedDocId(e.target.value)}
          >
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename}
              </option>
            ))}
          </select>
        </label>

        {hasMessages && (
          <button
            className="clear-chat-btn"
            onClick={() => {
              if (window.confirm("Clear and delete this chat?")) {
                if (conversationId) {
                  onDeleteConversation?.(conversationId);
                }
                setMessages([]);
              }
            }}
            title="Clear and delete this conversation"
          >
            🗑 Clear Chat
          </button>
        )}
      </div>

      {/* Scrollable chat body */}
      <div className="chat-body">

        {/* Welcome / empty state */}
        {!hasMessages && !loadingHistory && (
          <>
            <section className="welcome">
              <div className="welcome-mark">
                <span>A</span>
              </div>

              <p className="eyebrow">ADAPTIVE MULTI-RAG</p>

              <h2>
                Research, understand,{" "}
                <span>and ask anything.</span>
              </h2>

              <p className="welcome-description">
                Ask a question about the selected document. Adaptive
                retrieval finds, ranks, and synthesizes the most relevant
                evidence automatically.
              </p>
            </section>

            <section className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  className="suggestion-card"
                  key={s.title}
                  onClick={() => submitQuestion(s.text)}
                >
                  <div className="suggestion-icon">{s.icon}</div>

                  <div className="suggestion-content">
                    <strong>{s.title}</strong>
                    <span>{s.text}</span>
                  </div>

                  <span className="arrow">→</span>
                </button>
              ))}
            </section>
          </>
        )}

        {loadingHistory && (
          <div className="chat-loading">Loading conversation…</div>
        )}

        {/* Messages */}
        {hasMessages && (
          <div className="chat-messages">
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}

            {sending && (
              <div className="chat-bubble assistant pending">
                <div className="chat-avatar-row">
                  <div className="assistant-avatar">✦</div>
                  <span className="chat-bubble-role">Assistant</span>
                </div>
                <div className="chat-bubble-body">
                  <div className="thinking-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Spacer to push composer down when no messages */}
        {!hasMessages && <div style={{ flex: 1 }} />}
      </div>

      {/* Composer */}
      <div className="composer-wrapper">
        {error && <div className="chat-error">{error}</div>}

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={question}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your document… (Enter to send, Shift+Enter for new line)"
            disabled={sending}
          />

          <button
            type="submit"
            className={`send-button ${question.trim() ? "ready" : ""}`}
            title="Send message"
            disabled={sending || !question.trim()}
          >
            ↑
          </button>
        </form>

        <p className="composer-note">
          Adaptive RAG synthesizes grounded facts from your documents. Always verify important research findings.
        </p>
      </div>
    </div>
  );
}


function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const hasStats =
    !isUser &&
    (typeof message.confidence === "number" ||
      message.chunksUsed != null ||
      message.queryType);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`chat-bubble ${message.role}`}>
      <div className="chat-avatar-row">
        {isUser ? (
          <>
            <span className="chat-bubble-role">You</span>
            <div className="user-avatar" style={{ width: "22px", height: "22px", fontSize: "10px" }}>U</div>
          </>
        ) : (
          <>
            <div className="assistant-avatar">✦</div>
            <span className="chat-bubble-role">Assistant</span>
          </>
        )}
      </div>

      <div className="chat-bubble-body">
        {isUser ? (
          <div className="chat-bubble-content">{message.content}</div>
        ) : (
          <div className="markdown-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {!isUser && (
        <div className="chat-bubble-meta">
          <div className="meta-tags-container">
            {message.chunksUsed != null && (
              <span className="meta-tag">
                <span className="meta-dot" style={{ background: "var(--accent-2)" }} />
                {message.chunksUsed} chunks
              </span>
            )}

            {message.queryType && (
              <span className="meta-tag">
                <span className="meta-dot" style={{ background: "#4ecdc4" }} />
                {message.queryType}
              </span>
            )}

            {typeof message.confidence === "number" && (
              <span className="meta-tag">
                <span className="meta-dot" style={{ background: "var(--green)" }} />
                {Math.round(message.confidence * 100)}% confidence
              </span>
            )}

            {message.latencyMs != null && (
              <span className="meta-tag">
                <span className="meta-dot" style={{ background: "var(--text-4)" }} />
                {(message.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          <button
            className="copy-btn"
            onClick={handleCopy}
            title="Copy answer"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}


export default ChatPanel;
