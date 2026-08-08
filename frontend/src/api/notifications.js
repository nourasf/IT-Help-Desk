import { getStoredToken } from "../utils/authStorage";

const API_URL = "http://localhost:5099/api/notifications";

function requireToken() {
  const token = getStoredToken();
  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  return token;
}

async function request(url, options = {}) {
  const token = requireToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.message || `Notification request failed. Error ${response.status}.`);
  }

  return data;
}

export function getNotifications(take = 20) {
  return request(`${API_URL}?take=${take}`, { method: "GET" });
}

export function getUnreadNotificationCount() {
  return request(`${API_URL}/unread-count`, { method: "GET" });
}

export function markNotificationAsRead(notificationId) {
  return request(`${API_URL}/${notificationId}/read`, { method: "POST" });
}

export function markAllNotificationsAsRead() {
  return request(`${API_URL}/read-all`, { method: "POST" });
}
