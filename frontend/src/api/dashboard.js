const API_URL = "http://localhost:5099/api/dashboard";

export async function getEmployeeDashboard() {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/employee`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error("Failed to load dashboard");
    }

    return await response.json();


    export async function getAdminDashboard() {
const token = localStorage.getItem("token");
 const response = await fetch("http://localhost:5099/api/dashboard/admin", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error("Failed to load admin dashboard");
    }

    return await response.json();

    }

    export async function getAgentDashboard() {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:5099/api/dashboard/agent", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load agent dashboard");
        }

        return await response.json();
    }

      export async function getManagerDashboard() {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:5099/api/dashboard/manager", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load manager dashboard");
        }

        return await response.json();
    }
    function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token")
  );
}

const API_URL = "http://localhost:5099/api/dashboard";

async function requestDashboard(endpoint) {
  const token = getToken();

  if (!token) {
    throw new Error("You are not logged in.");
  }

  const response = await fetch(`${API_URL}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

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
}