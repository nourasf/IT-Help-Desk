import { getStoredToken } from "../utils/authStorage";

const API_URL = "http://localhost:5099/api/tickets";

async function readResponse(response) {
  const responseText = await response.text();
  if (!responseText) return {};
  try { return JSON.parse(responseText); } catch { return { message: responseText }; }
}

function getValidationMessage(errors) {
  if (!errors) return null;
  const messages = Object.values(errors).flat();
  return messages.find((message) => !String(message).toLowerCase().includes("request field is required")) || messages[0] || null;
}

function requireToken() {
  const token = getStoredToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

async function request(url, options = {}) {
  const token = requireToken();
  const response = await fetch(url, {
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
  if (response.status === 403) throw new Error(data.message || "You do not have permission to perform this action.");
  if (!response.ok) throw new Error(data.message || getValidationMessage(data.errors) || `Request failed. Error ${response.status}.`);
  return data;
}

export async function getTicketFormOptions(signal) {
  const data = await request(`${API_URL}/form-options`, { method: "GET", signal });
  return { categories: Array.isArray(data.categories) ? data.categories : [], priorities: Array.isArray(data.priorities) ? data.priorities : [] };
}

export async function createTicket(ticket) {
  return request(`${API_URL}/create-ticket`, {
    method: "POST",
    body: JSON.stringify({ subject: ticket.subject.trim(), description: ticket.description.trim(), category: ticket.category, priority: ticket.priority }),
  });
}

export async function getMyTickets() { return request(`${API_URL}/my-tickets`, { method: "GET" }); }
export async function getAllTickets() {
  const data = await request(API_URL, { method: "GET" });
  return Array.isArray(data) ? data : [];
}

export async function getAssignmentOptions(signal) {
  const data = await request(`${API_URL}/assignment-options`, { method: "GET", signal });
  return { tickets: Array.isArray(data.tickets) ? data.tickets : [], agents: Array.isArray(data.agents) ? data.agents : [] };
}

export async function assignTicket(ticketId, agentUserId) {
  return request(`${API_URL}/${ticketId}/assign`, { method: "POST", body: JSON.stringify({ agentUserId: Number(agentUserId) }) });
}
export async function takeTicket(ticketId) { return request(`${API_URL}/${ticketId}/take`, { method: "POST" }); }
export async function startWork(ticketId) { return request(`${API_URL}/${ticketId}/start-work`, { method: "POST" }); }
export async function pauseWork(ticketId) { return request(`${API_URL}/${ticketId}/pause-work`, { method: "POST" }); }
export async function getTicketById(ticketId) { return request(`${API_URL}/${ticketId}`, { method: "GET" }); }

export async function getTicketComments(ticketId) {
  const data = await request(`${API_URL}/${ticketId}/comments`, { method: "GET" });
  return Array.isArray(data) ? data : [];
}
export async function addTicketComment(ticketId, comment) {
  return request(`${API_URL}/${ticketId}/comments`, { method: "POST", body: JSON.stringify({ comment: comment.trim() }) });
}
export async function getInternalNotes(ticketId) {
  const data = await request(`${API_URL}/${ticketId}/internal-notes`, { method: "GET" });
  return Array.isArray(data) ? data : [];
}
export async function addInternalNote(ticketId, note) {
  return request(`${API_URL}/${ticketId}/internal-notes`, { method: "POST", body: JSON.stringify({ note: note.trim() }) });
}
export async function getTicketActivity(ticketId) {
  const data = await request(`${API_URL}/${ticketId}/activity`, { method: "GET" });
  return Array.isArray(data) ? data : [];
}
export async function getTicketHistory(ticketId) {
  const data = await request(`${API_URL}/${ticketId}/history`, { method: "GET" });
  return Array.isArray(data) ? data : [];
}

async function ticketAction(ticketId, action, note) {
  return request(`${API_URL}/${ticketId}/${action}`, { method: "POST", body: JSON.stringify({ note: String(note || "").trim() }) });
}

export async function resolveTicket(ticketId, resolutionNotes) { return ticketAction(ticketId, "resolve", resolutionNotes); }
export async function escalateTicket(ticketId, reason) { return ticketAction(ticketId, "escalate", reason); }
export async function cancelTicket(ticketId, reason) { return ticketAction(ticketId, "cancel", reason); }
export async function returnTicketToManager(ticketId, reason) { return ticketAction(ticketId, "return-to-manager", reason); }
export async function reopenTicket(ticketId, reason) { return ticketAction(ticketId, "reopen", reason); }
export async function managerReopenTicket(ticketId, reason) { return ticketAction(ticketId, "manager-reopen", reason); }
export async function closeTicket(ticketId) { return request(`${API_URL}/${ticketId}/close`, { method: "POST" }); }
