import { getStoredToken } from "../utils/authStorage";

const REPORTS_URL = "http://localhost:5099/api/reports";

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function getReport(from, to, signal) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const url = params.toString() ? `${REPORTS_URL}?${params}` : REPORTS_URL;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
    },
    signal,
  });

  const data = await readResponse(response);
  if (!response.ok) {
    throw new Error(data?.message || "The report could not be loaded.");
  }

  return data;
}
