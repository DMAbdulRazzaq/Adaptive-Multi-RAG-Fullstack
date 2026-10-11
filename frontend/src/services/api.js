const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "adaptive_rag_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  setToken(null);
}

/**
 * Low-level request helper. Adds the auth header automatically, parses
 * JSON, and throws a plain Error with the backend's detail message on
 * any non-2xx response so callers can just try/catch.
 */
async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let payload = body;

  if (body && !isForm) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: payload,
    });
  } catch {
    throw new Error(
      "Could not reach the server. Is the backend running and is VITE_API_URL set correctly?"
    );
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");

  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      `Request failed (${response.status})`;

    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail)
    );
  }

  return data;
}

function normalizeUser(userResponse) {
  return {
    id: userResponse.id,
    email: userResponse.email,
    name: userResponse.full_name || userResponse.email.split("@")[0],
    fullName: userResponse.full_name,
    createdAt: userResponse.created_at,
  };
}

/* ============================================================
   AUTH
============================================================ */

export async function register(email, password, fullName) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: { email, password, full_name: fullName || null },
  });

  setToken(data.access_token);
  return normalizeUser(data.user);
}

export async function login(email, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  setToken(data.access_token);
  return normalizeUser(data.user);
}

export async function fetchCurrentUser() {
  const data = await request("/api/auth/me");
  return normalizeUser(data);
}

export function logout() {
  clearToken();
}

/* ============================================================
   DOCUMENTS
============================================================ */

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  return request("/api/documents/upload", {
    method: "POST",
    body: formData,
    isForm: true,
  });
}

export async function listDocuments() {
  return request("/api/documents");
}

export async function deleteDocument(documentId) {
  return request(`/api/documents/${documentId}`, { method: "DELETE" });
}

/* ============================================================
   CHAT
============================================================ */

export async function sendChatMessage({
  question,
  documentId,
  conversationId,
  model,
}) {
  return request("/api/chat", {
    method: "POST",
    body: {
      question,
      document_id: documentId,
      conversation_id: conversationId || null,
      model: model?.id || null,
      model_name: model?.modelName || null,
    },
  });
}

export async function listConversations() {
  return request("/api/chat/conversations");
}

export async function getConversation(conversationId) {
  return request(`/api/chat/conversations/${conversationId}`);
}

export async function deleteConversation(conversationId) {
  return request(`/api/chat/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

export async function listAnalysis() {
  return request("/api/chat/analysis");
}

