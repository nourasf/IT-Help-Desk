const API_URL = "http://localhost:5099/api/dashboard";

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token")
  );
}

async function requestDashboard(endpoint) {
  const token = getToken();

  if (!token) {
    throw new Error("No authentication token found. Please log in again.");
  }

  const response = await fetch(`${API_URL}/${endpoint}`, {
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

  if (!response.ok) {
    throw new Error(`Failed to load ${endpoint} dashboard.`);
  }

  return response.json();
}

export function getEmployeeDashboard() {
  return requestDashboard("employee");
}

export function getAdminDashboard() {
  return requestDashboard("admin");
}

export function getAgentDashboard() {
  return requestDashboard("agent");
}

export function getManagerDashboard() {
  return requestDashboard("manager");
}