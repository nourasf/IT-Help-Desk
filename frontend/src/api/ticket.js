import { getStoredToken } from "../utils/authStorage";

const API_URL = "http://localhost:5099/api/tickets";

async function readResponse(response) {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      message: responseText,
    };
  }
}

function getValidationMessage(errors) {
  if (!errors) {
    return null;
  }

  const messages = Object.values(errors).flat();

  return (
    messages.find(
      (message) =>
        !message
          .toLowerCase()
          .includes("request field is required")
    ) ||
    messages[0] ||
    null
  );
}

export async function getTicketFormOptions(signal) {
  const token = getStoredToken();

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const response = await fetch(`${API_URL}/form-options`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  const data = await readResponse(response);

  if (response.status === 401) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "Only employees can load ticket options."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Could not load ticket options. Error ${response.status}.`
    );
  }

  return {
    categories: Array.isArray(data.categories)
      ? data.categories
      : [],
    priorities: Array.isArray(data.priorities)
      ? data.priorities
      : [],
  };
}

export async function createTicket(ticket) {
  const token = getStoredToken();

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const response = await fetch(`${API_URL}/create-ticket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subject: ticket.subject.trim(),
      description: ticket.description.trim(),
      category: ticket.category,
      priority: ticket.priority,
    }),
  });

  const data = await readResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Only employees can create support tickets."
      );
    }

    const validationMessage = getValidationMessage(data.errors);

    throw new Error(
      data.message ||
        validationMessage ||
        `The ticket could not be created. Error ${response.status}.`
    );
  }

  return data;
}

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

  const data = await readResponse(response);

  if (response.status === 401) {
    throw new Error(
      "Your login session is invalid or expired."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "You do not have permission to view these tickets."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load tickets."
    );
  }

  return data;
}
 export async function getAssignmentOptions(signal) {
  const token = getStoredToken();

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const response = await fetch(
    `${API_URL}/assignment-options`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal,
    }
  );

  const data = await readResponse(response);

  if (response.status === 401) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "Only managers can load assignment options."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Could not load assignment options. Error ${response.status}.`
    );
  }

  return {
    tickets: Array.isArray(data.tickets)
      ? data.tickets
      : [],
    agents: Array.isArray(data.agents)
      ? data.agents
      : [],
  };
}

 export async function assignTicket(ticketId, agentUserId) {
  const token = getStoredToken();

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }
  const response = await fetch(`${API_URL}/${ticketId}/assign/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      agentUserId: Number(agentUserId),
    }),
  }
);
const data = await readResponse(response);

if(response.status === 401){
  throw new Error("Your session has expired. Please sign in again.");
}
if(response.status === 403){
  throw new Error("Only admins and managers can assign tickets.");
}

if(!response.ok){
  throw new Error(data.message || `The ticket could not be assigned. Error ${response.status}.`);
}
return data;

  }
 export async function takeTicket(ticketId) {
  const token = getStoredToken();

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }
  const response= await fetch(
    `${API_URL}/${ticketId}/take`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await readResponse(response);

  if (response.status === 401) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }
  if(response.status === 403){
    throw new Error("Only IT Support Agents can take tickets.");
  }
 if(!response.ok){
  throw new Error(
    data.message ||
    'The ticket could not be taken. Error ${response.status}.'
  );
 }
 return data;

 }

 export async function startWork(ticketId){
  const token = getStoredToken();
  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }
  const response= await fetch(
    `${API_URL}/${ticketId}/start-work`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await readResponse(response);
  if(!response.ok){
    throw new Error(
      data.message ||
      'The ticket could not be started. Error ${response.status}.'
    );
  }
  return data;
  }
 
  export async function pauseWork(ticketId){
  const token = getStoredToken();
  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }
    const response= await fetch (
      '${API_URL}/${ticketId}/pause-work',
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await readResponse(response);
    if(!response.ok){
      throw new Error(
        data.message ||
        'The ticket could not be paused. Error ${response.status}.'
      );
    }
    return data;

  }
export async function getTicketById(ticketId) {
  const token = getStoredToken();

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const response = await fetch(
    `${API_URL}/${ticketId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await readResponse(response);

  if (response.status === 401) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "You do not have permission to view this ticket."
    );
  }

  if (response.status === 404) {
    throw new Error(
      data.message ||
      "Ticket not found."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      `Could not load ticket. Error ${response.status}.`
    );
  }

  return data;
}