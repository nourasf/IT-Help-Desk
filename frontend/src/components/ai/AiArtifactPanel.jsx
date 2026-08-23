import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeTicket } from "../../api/ai";
import {
  assignTicket,
  createTicket,
  getAllTickets,
  getAssignmentOptions,
  getMyTickets,
  getTicketFormOptions,
} from "../../api/ticket";
import { getAgentDashboard } from "../../api/dashboard";
import { getStoredToken } from "../../utils/authStorage";

const USER_ROLES = ["Employee", "IT Support Agent", "Manager", "Admin"];

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function createUserRequest(form) {
  const response = await fetch("http://localhost:5099/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStoredToken()}`,
    },
    body: JSON.stringify(form),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || "The user could not be created.");
  return data;
}

async function getUsersRequest() {
  const response = await fetch("http://localhost:5099/api/users", {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.message || "The user directory could not be loaded.");
  return Array.isArray(data) ? data : [];
}

function PanelHeader({ artifact, onClose }) {
  return (
    <header className="ai-artifact-header">
      <div>
        <span className="ai-artifact-eyebrow">AI workspace</span>
        <h2>{artifact?.title || "SupportHub action"}</h2>
      </div>
      <button type="button" className="ai-artifact-close" onClick={onClose} aria-label="Close action panel">×</button>
    </header>
  );
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="ai-artifact-empty">
      <span className="ai-artifact-empty-icon">✦</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {actionLabel && <button type="button" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

function CreateUserArtifact({ artifact }) {
  const initialRole = artifact?.initialData?.role || "Employee";
  const [form, setForm] = useState({ fullName: "", email: "", phoneNumber: "", password: "", confirmPassword: "", role: initialRole });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError(""); setSuccess("");
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await createUserRequest({ fullName: form.fullName.trim(), email: form.email.trim(), phoneNumber: form.phoneNumber.trim(), password: form.password, role: form.role });
      setSuccess(`${form.fullName} was created successfully.`);
      setForm({ fullName: "", email: "", phoneNumber: "", password: "", confirmPassword: "", role: initialRole });
    } catch (err) { setError(err.message || "The user could not be created."); }
    finally { setSaving(false); }
  }

  return (
    <form className="ai-artifact-form" onSubmit={submit}>
      <div className="ai-artifact-callout"><strong>Admin action</strong><span>Review the account details before creating the user.</span></div>
      {error && <div className="ai-artifact-message error">{error}</div>}
      {success && <div className="ai-artifact-message success">{success}</div>}
      <label>Full Name<input name="fullName" value={form.fullName} onChange={change} required placeholder="Enter full name" /></label>
      <label>Email Address<input name="email" type="email" value={form.email} onChange={change} required placeholder="user@supporthub.com" /></label>
      <label>Phone Number<input name="phoneNumber" value={form.phoneNumber} onChange={change} required placeholder="+961 71 123 456" /></label>
      <label>Role<select name="role" value={form.role} onChange={change}>{USER_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
      <div className="ai-artifact-form-grid">
        <label>Temporary Password<input name="password" type="password" value={form.password} onChange={change} minLength={8} required /></label>
        <label>Confirm Password<input name="confirmPassword" type="password" value={form.confirmPassword} onChange={change} minLength={8} required /></label>
      </div>
      <button className="ai-artifact-primary" type="submit" disabled={saving}>{saving ? "Creating..." : "Create User"}</button>
    </form>
  );
}

function CreateTicketArtifact({ artifact }) {
  const [options, setOptions] = useState({ categories: [], priorities: [] });
  const [form, setForm] = useState({ subject: "", description: artifact?.initialData?.description || "", category: "", priority: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getTicketFormOptions(controller.signal).then((data) => {
      setOptions(data);
      setForm((current) => ({ ...current, category: current.category || data.categories?.[0]?.name || data.categories?.[0] || "", priority: current.priority || data.priorities?.[0]?.name || data.priorities?.[0] || "" }));
    }).catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, []);

  const names = (items) => items.map((item) => typeof item === "string" ? item : item.name);

  async function suggest() {
    if (!form.subject.trim() || !form.description.trim()) { setError("Add a subject and description first."); return; }
    setAnalyzing(true); setError("");
    try {
      const result = await analyzeTicket(form.subject, form.description);
      setForm((current) => ({ ...current, category: result.category || current.category, priority: result.priority || current.priority }));
    } catch (err) { setError(err.message || "AI suggestions are unavailable right now."); }
    finally { setAnalyzing(false); }
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const result = await createTicket(form);
      setSuccess(`Ticket ${result.ticketNumber || result.ticket?.ticketNumber || ""} created successfully.`.trim());
      setForm((current) => ({ ...current, subject: "", description: "" }));
    } catch (err) { setError(err.message || "The ticket could not be created."); }
    finally { setSaving(false); }
  }

  return (
    <form className="ai-artifact-form" onSubmit={submit}>
      <div className="ai-artifact-callout"><strong>AI-assisted ticket</strong><span>Your message can be reused here and analyzed before submission.</span></div>
      {error && <div className="ai-artifact-message error">{error}</div>}
      {success && <div className="ai-artifact-message success">{success}</div>}
      <label>Subject<input value={form.subject} onChange={(e) => setForm((c) => ({ ...c, subject: e.target.value }))} required placeholder="Briefly describe the issue" /></label>
      <label>Description<textarea rows={6} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} required placeholder="What happened? What have you tried?" /></label>
      <button className="ai-artifact-secondary" type="button" onClick={suggest} disabled={analyzing}>{analyzing ? "Analyzing..." : "Suggest Category & Priority"}</button>
      <div className="ai-artifact-form-grid">
        <label>Category<select value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}>{names(options.categories).map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Priority<select value={form.priority} onChange={(e) => setForm((c) => ({ ...c, priority: e.target.value }))}>{names(options.priorities).map((name) => <option key={name}>{name}</option>)}</select></label>
      </div>
      <button className="ai-artifact-primary" type="submit" disabled={saving}>{saving ? "Creating..." : "Create Ticket"}</button>
    </form>
  );
}

function UserListArtifact() {
  const [users, setUsers] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { getUsersRequest().then(setUsers).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  if (loading) return <EmptyState title="Loading users" text="Fetching the SupportHub directory..." />;
  if (error) return <EmptyState title="Could not load users" text={error} />;
  return <div className="ai-artifact-list">{users.map((user) => <div className="ai-artifact-list-row" key={user.id}><span className="ai-artifact-avatar">{String(user.fullName || "U").slice(0, 1).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{user.email}</small></div><span className="ai-artifact-pill">{user.role}</span></div>)}</div>;
}

function TicketListArtifact({ artifact, mode }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = mode === "mine" ? getMyTickets() : getAllTickets();
    Promise.resolve(load).then((data) => setTickets(Array.isArray(data) ? data : data?.tickets || [])).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [mode]);

  const filtered = useMemo(() => tickets.filter((ticket) => {
    const requestedStatus = String(artifact?.initialData?.status || "").toLowerCase();
    const requestedPriority = String(artifact?.initialData?.priority || "").toLowerCase();
    const ticketStatus = String(ticket.status || ticket.statusName || "").toLowerCase();
    const ticketPriority = String(ticket.priority || ticket.priorityName || "").toLowerCase();

    let statusMatches = true;
    if (requestedStatus === "unsolved") {
      statusMatches = !["resolved", "closed", "cancelled"].includes(ticketStatus);
    } else if (requestedStatus === "solved") {
      statusMatches = ["resolved", "closed"].includes(ticketStatus);
    } else if (requestedStatus) {
      statusMatches = ticketStatus === requestedStatus;
    }

    const priorityMatches = !requestedPriority || ticketPriority === requestedPriority;
    return statusMatches && priorityMatches;
  }), [tickets, artifact]);

  if (loading) return <EmptyState title="Loading tickets" text="Fetching the latest ticket data..." />;
  if (error) return <EmptyState title="Could not load tickets" text={error} />;
  if (!filtered.length) return <EmptyState title="No matching tickets" text="There are no tickets matching those filters right now." />;
  return <div className="ai-artifact-list">{filtered.slice(0, 20).map((ticket) => <button type="button" className="ai-artifact-ticket-row" key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}><div><strong>{ticket.ticketNumber || `#${ticket.id}`} · {ticket.subject}</strong><small>{ticket.category || "Uncategorized"}</small></div><span><b>{ticket.status}</b><small>{ticket.priority}</small></span></button>)}</div>;
}

function AssignmentArtifact({ artifact }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ tickets: [], agents: [] }); const [selected, setSelected] = useState({}); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() { try { setLoading(true); setData(await getAssignmentOptions()); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function assign(ticketId) {
    const agentId = selected[ticketId]; if (!agentId) { setError("Choose an agent first."); return; }
    try { await assignTicket(ticketId, agentId); setMessage("Ticket assigned successfully."); setError(""); await load(); } catch (err) { setError(err.message); }
  }
  const tickets = data.tickets.filter((ticket) => !artifact?.initialData?.priority || String(ticket.priority).toLowerCase() === String(artifact.initialData.priority).toLowerCase());
  if (loading) return <EmptyState title="Loading assignment queue" text="Checking unassigned tickets and agent workload..." />;
  return <div className="ai-artifact-stack">{error && <div className="ai-artifact-message error">{error}</div>}{message && <div className="ai-artifact-message success">{message}</div>}{tickets.length === 0 ? <EmptyState title="Queue is clear" text="There are no matching unassigned tickets right now." /> : tickets.map((ticket) => <div className="ai-assignment-card" key={ticket.id}><button type="button" className="ai-assignment-ticket" onClick={() => navigate(`/tickets/${ticket.id}`)}><strong>{ticket.ticketNumber}</strong><span>{ticket.subject}</span><small>{ticket.priority} · {ticket.category}</small></button><div><select value={selected[ticket.id] || ""} onChange={(e) => setSelected((c) => ({ ...c, [ticket.id]: e.target.value }))}><option value="">Choose agent</option>{data.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.activeTickets} active</option>)}</select><button type="button" onClick={() => assign(ticket.id)}>Assign</button></div></div>)}</div>;
}

function AgentTicketsArtifact({ available }) {
  const navigate = useNavigate(); const [dashboard, setDashboard] = useState(null); const [error, setError] = useState("");
  useEffect(() => { getAgentDashboard().then(setDashboard).catch((err) => setError(err.message)); }, []);
  if (error) return <EmptyState title="Could not load agent tickets" text={error} />;
  if (!dashboard) return <EmptyState title="Loading agent workspace" text="Fetching your latest ticket queue..." />;
  const source = available ? (dashboard.availableTickets || dashboard.unassignedTicketsList || dashboard.unassigned || []) : (dashboard.recentTickets || dashboard.assignedTickets || []);
  if (!Array.isArray(source) || source.length === 0) return <EmptyState title={available ? "No available tickets" : "No active tickets"} text={available ? "There are no unassigned tickets available right now." : "You do not have active tickets in this view."} />;
  return <div className="ai-artifact-list">{source.slice(0, 20).map((ticket) => <button type="button" className="ai-artifact-ticket-row" key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}><div><strong>{ticket.ticketNumber || `#${ticket.id}`} · {ticket.subject}</strong><small>{ticket.employee || ticket.category || "Support ticket"}</small></div><span><b>{ticket.status}</b><small>{ticket.priority}</small></span></button>)}</div>;
}

function ReportsArtifact() {
  const navigate = useNavigate();
  return <EmptyState title="Reports are ready" text="Open the full reporting workspace to filter dates, review analytics, and export PDF or Excel reports." actionLabel="Open Reports" onAction={() => navigate("/reports")} />;
}

export default function AiArtifactPanel({ artifact, onClose }) {
  if (!artifact) return null;
  let content = null;
  switch (artifact.type) {
    case "create_user": content = <CreateUserArtifact artifact={artifact} />; break;
    case "user_list": content = <UserListArtifact />; break;
    case "create_ticket": content = <CreateTicketArtifact artifact={artifact} />; break;
    case "ticket_list": content = <TicketListArtifact artifact={artifact} mode="all" />; break;
    case "my_tickets": content = <TicketListArtifact artifact={artifact} mode="mine" />; break;
    case "assignment_center": content = <AssignmentArtifact artifact={artifact} />; break;
    case "agent_available_tickets": content = <AgentTicketsArtifact available />; break;
    case "agent_my_tickets": content = <AgentTicketsArtifact available={false} />; break;
    case "reports": content = <ReportsArtifact />; break;
    default: content = <EmptyState title="Action ready" text="This SupportHub action is available from its full workspace." />;
  }

  return <aside className="ai-artifact-panel"><PanelHeader artifact={artifact} onClose={onClose} /><div className="ai-artifact-body">{content}</div></aside>;
}
