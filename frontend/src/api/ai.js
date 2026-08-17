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

async function postAi(path, body) {
  const token = requireToken();

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await readResponse(response);

  if (response.status === 401) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (response.status === 403) {
    throw new Error(data.message || "You do not have permission to use the AI assistant.");
  }

  if (!response.ok) {
    throw new Error(data.message || `AI request failed. Error ${response.status}.`);
  }

  return data;
}

export async function analyzeTicket(subject, description) {
  return postAi("/analyze-ticket", {
    subject: subject.trim(),
    description: description.trim(),
  });
}

export async function sendAiChatMessage(message, history = []) {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((item) => item && (item.role === "user" || item.role === "assistant") && String(item.text || "").trim())
        .slice(-10)
        .map((item) => ({
          role: item.role,
          text: String(item.text).trim(),
        }))
    : [];

  const data = await postAi("/chat", {
    message: message.trim(),
    history: safeHistory,
  });

  return {
    reply: data.reply || "",
    role: data.role || "",
  };
}
