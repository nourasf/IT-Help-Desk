import { getStoredToken } from "../utils/authStorage";
import { API_ROOT } from "../config/api";

const API_URL = `${API_ROOT}/tickets`;

function getToken() {
  const token = getStoredToken();

  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return token;
}

async function readResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function uploadTicketAttachments(ticketId, files, ticketCommentId = null) {
  const token = getToken();
  const formData = new FormData();

  Array.from(files || []).forEach((file) => {
    formData.append("files", file);
  });

  if (ticketCommentId != null) {
    formData.append("ticketCommentId", String(ticketCommentId));
  }

  const response = await fetch(`${API_URL}/${ticketId}/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await readResponse(response);

  if (!response.ok) {
    throw new Error(data.message || `Attachment upload failed. Error ${response.status}.`);
  }

  return data;
}

export async function getTicketAttachments(ticketId) {
  const token = getToken();

  const response = await fetch(`${API_URL}/${ticketId}/attachments`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await readResponse(response);

  if (!response.ok) {
    throw new Error(data.message || `Could not load attachments. Error ${response.status}.`);
  }

  return Array.isArray(data) ? data : [];
}

export async function downloadTicketAttachment(ticketId, attachmentId, fileName = "attachment") {
  const token = getToken();

  const response = await fetch(
    `${API_URL}/${ticketId}/attachments/${attachmentId}/download`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const data = await readResponse(response);
    throw new Error(data.message || `Could not download attachment. Error ${response.status}.`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
