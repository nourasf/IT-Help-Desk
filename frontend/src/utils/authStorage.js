export function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token")
  );
}

export function getStoredRole() {
  return (
    localStorage.getItem("role") ||
    sessionStorage.getItem("role")
  );
}

export function saveAuthentication(token, role, rememberMe) {
  clearAuthentication();

  const storage = rememberMe
    ? localStorage
    : sessionStorage;

  storage.setItem("token", token);
  storage.setItem("role", role.trim());
}
export function clearAuthentication() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");

  sessionStorage.removeItem("token");
  sessionStorage.removeItem("role");
}