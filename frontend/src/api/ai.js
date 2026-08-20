import { getStoredToken } from "../utils/authStorage";

const API_URL = "http://localhost:5099/api/ai";

async function readResponse(response) {
  const responseText = await response.text();
  if (!responseText) return {};
  try {
    return JSON.parse(responseText);
  } catch {
    return { message: responseText };
  }
}

function requireToken() {
  const token = getStoredToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

async function requestAi(path, options = {}) {
  const token = requireToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await readResponse(response);

  if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
  if (response.status === 403) throw new Error(data.message || "You do not have permission to use the AI assistant.");
  if (!response.ok) throw new Error(data.message || `AI request failed. Error ${response.status}.`);
  return data;
}

async function postAi(path, body) {
  return requestAi(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function analyzeTicket(subject, description) {
  return postAi("/analyze-ticket", {
    subject: subject.trim(),
    description: description.trim(),
  });
}

export async function sendAiChatMessage(message, conversationId = null) {
  const data = await postAi("/chat", {
    message: message.trim(),
    conversationId,
  });

  return {
    reply: data.reply || "",
    role: data.role || "",
    conversationId: data.conversationId ?? null,
    title: data.title || "New conversation",
    artifact: data.artifact || null,
  };
}

export async function getAiConversations() {
  const data = await requestAi("/conversations", { method: "GET" });
  return Array.isArray(data) ? data : [];
}

export async function getAiConversation(id) {
  return requestAi(`/conversations/${id}`, { method: "GET" });
}

export async function deleteAiConversation(id) {
  await requestAi(`/conversations/${id}`, { method: "DELETE" });
}

export async function clearAiConversations() {
  await requestAi("/conversations", { method: "DELETE" });
}
