const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || "http://localhost:5099").replace(/\/+$/, "");
export const API_ROOT = `${API_BASE_URL}/api`;
export const HUB_ROOT = `${API_BASE_URL}/hubs`;
