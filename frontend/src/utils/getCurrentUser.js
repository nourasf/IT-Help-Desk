export function getCurrentUser() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");

  if (!token) return null;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));

    return {
      id:
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
        payload.sub ||
        null,
      name:
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
        payload.name ||
        "User",
      email:
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
        payload.email ||
        "",
    };
  } catch {
    return null;
  }
}
