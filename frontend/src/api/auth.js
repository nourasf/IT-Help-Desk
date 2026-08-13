const API_URL = "http://localhost:5099/api/auth";

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function publicRequest(path, body) {
  const response = await fetch(`${API_URL}/${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await readResponse(response);

  if (!response.ok) {
    const validationMessage = data.errors
      ? Object.values(data.errors).flat()[0]
      : null;
    throw new Error(data.message || validationMessage || `Request failed. Error ${response.status}.`);
  }

  return data;
}

export function forgotPassword(email) {
  return publicRequest("forgot-password", {
    email: String(email || "").trim(),
  });
}

export function resetPassword(email, otp, newPassword) {
  return publicRequest("reset-password", {
    email: String(email || "").trim(),
    otp: String(otp || "").trim(),
    newPassword,
  });
}
