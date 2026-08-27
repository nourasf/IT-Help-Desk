import { API_ROOT } from "../config/api";

const API_URL = `${API_ROOT}/dashboard`;

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

async function requestJson(url) {
  const token = getToken();
  if (!token) throw new Error("No authentication token found. Please log in again.");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    throw new Error("Your login session is invalid or expired.");
  }

  if (!response.ok) throw new Error(`Request failed. Error ${response.status}.`);
  return response.json();
}

function requestDashboard(endpoint) {
  return requestJson(`${API_URL}/${endpoint}`);
}

export function getEmployeeDashboard() { return requestDashboard("employee"); }
export function getAdminDashboard() { return requestDashboard("admin"); }
export async function getAgentDashboard() {
  const data = await requestDashboard("agent");
  return {
    ...data,
    unassignedTicketsList: Array.isArray(data.availableTickets) ? data.availableTickets : [],
    assignedTickets: Array.isArray(data.recentTickets) ? data.recentTickets : [],
  };
}
export function getManagerDashboard() { return requestDashboard("manager"); }
export function getAdminResolvedAnalytics() {
  return requestJson(`${API_URL}/admin/resolved-last-30-days`);
}
