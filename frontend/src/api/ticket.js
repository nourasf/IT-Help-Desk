import { getStoredToken } from "../utils/authStorage";

const API_URL = "http://localhost:5099/api/tickets";

export async function getMyTickets() {
  const token = getStoredToken();

  if (!token) {
    throw new Error("No login token found.");
  }

  const response = await fetch(`${API_URL}/my-tickets`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401) {
    throw new Error("Your login session is invalid or expired.");
  }

  if (response.status === 403) {
    throw new Error("You do not have permission to view these tickets.");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load tickets.");
  }

  return response.json();
}