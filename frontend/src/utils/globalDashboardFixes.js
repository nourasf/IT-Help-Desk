import { clearAuthentication, getStoredRole } from "./authStorage";

let installed = false;

function setReactInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function searchRouteForRole() {
  const role = String(getStoredRole() || "").trim().toLowerCase();
  if (role === "admin") return "/admin/tickets";
  if (role === "manager") return "/tickets/all";
  if (role === "employee") return "/my-tickets";
  if (["agent", "it", "it support agent"].includes(role)) return "/agent-dashboard";
  return null;
}

function applyPendingSearch() {
  const query = sessionStorage.getItem("supporthubPendingSearch");
  if (!query) return;

  const candidates = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
  const searchInput = candidates.find((input) => {
    if (input.closest(".topbar-search")) return false;
    const placeholder = String(input.placeholder || "").toLowerCase();
    return placeholder.includes("search") && (placeholder.includes("ticket") || placeholder.includes("request"));
  });

  if (!searchInput) return;
  setReactInputValue(searchInput, query);
  searchInput.focus();
  sessionStorage.removeItem("supporthubPendingSearch");
}

export function installGlobalDashboardFixes() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  document.addEventListener("click", (event) => {
    const logoutButton = event.target.closest?.(".logout-button");
    if (!logoutButton) return;
    event.preventDefault();
    event.stopPropagation();
    clearAuthentication();
    sessionStorage.removeItem("resetEmail");
    sessionStorage.removeItem("passwordResetToken");
    sessionStorage.removeItem("supporthubPendingSearch");
    window.location.replace("/login");
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.closest(".topbar-search")) return;
    const query = input.value.trim();
    if (!query) return;
    const route = searchRouteForRole();
    if (!route) return;
    event.preventDefault();
    sessionStorage.setItem("supporthubPendingSearch", query);
    window.location.assign(route);
  }, true);

  const observer = new MutationObserver(() => applyPendingSearch());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", applyPendingSearch);
  window.setTimeout(applyPendingSearch, 0);
}

installGlobalDashboardFixes();
