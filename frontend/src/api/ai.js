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

export async function analyzeTicket(subject, description) {
  const token = getStoredToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch(`${API_URL}/analyze-ticket`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subject: subject.trim(),
      description: description.trim(),
    }),
  });

  const data = await readResponse(response);

  if (response.status === 401) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (response.status === 403) {
    throw new Error(data.message || "You do not have permission to use the AI assistant.");
  }

  if (!response.ok) {
    throw new Error(data.message || `AI analysis failed. Error ${response.status}.`);
  }

  return data;
}
