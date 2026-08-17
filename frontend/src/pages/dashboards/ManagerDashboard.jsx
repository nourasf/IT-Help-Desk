import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getManagerDashboard } from "../../api/dashboard";
import { assignTicket, getAssignmentOptions } from "../../api/ticket";
import "../../styles/dashboard/ManagerDashboard.css";

function Icon({ name }) {
  const icons = {
    open: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    unassigned: <><circle cx="9" cy="8" r="3" /><path d="M4 19a5 5 0 0 1 10 0" /><path d="M17 8h4M19 6v4" /></>,
    overdue: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 17h.01" /></>,
    resolved: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
    spark: <><path d="M12 3l1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
    assign: <><circle cx="8" cy="8" r="3" /><path d="M3 20a5 5 0 0 1 10 0" /><path d="M16 8h5M18.5 5.5v5" /></>,
    tickets: <><path d="M4 6h16v12H4z" /><path d="M8 6v12M16 6v12" /></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M18 10a7 7 0 0 0-12-3L4 9M6 14a7 7 0 0 0 12 3l2-2" /></>,
  };
  return <svg className="dashboard-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replaceAll(" ", "-");
}

function ManagerDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [assignmentOptions, setAssignmentOptions] = useState({ tickets: [], agents: [] });
  const [selectedAgents, setSelectedAgents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [assigningTicketId, setAssigningTicketId] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [dashboardData, assignmentData] = await Promise.all([getManagerDashboard(), getAssignmentOptions()]);
      setDashboard(dashboardData);
      setAssignmentOptions(assignmentData || { tickets: [], agents: [] });
    } catch (requestError) {
      setError(requestError.message || "The manager dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const agents = useMemo(() => [...(assignmentOptions.agents || [])].sort((a, b) => Number(a.activeTickets) - Number(b.activeTickets) || a.name.localeCompare(b.name)), [assignmentOptions.agents]);

  async function assignToAgent(ticketId, agentUserId, automatic = false) {
    if (!agentUserId) { setMessage("No support agent is available."); return; }
    try {
      setAssigningTicketId(ticketId);
      setMessage("");
      const result = await assignTicket(ticketId, agentUserId);
      const agent = agents.find((item) => Number(item.id) === Number(agentUserId));
      setMessage(automatic ? `Auto-assigned to ${agent?.name || "the least busy agent"}.` : result.message || `Ticket assigned to ${agent?.name || "agent"}.`);
      await loadData();
    } catch (requestError) {
      setMessage(requestError.message || "The ticket could not be assigned.");
    } finally {
      setAssigningTicketId(null);
    }
  }

  async function handleAssign(ticketId) { await assignToAgent(ticketId, selectedAgents[ticketId] || agents[0]?.id, false); }
  async function handleAutoAssign(ticketId) { await assignToAgent(ticketId, agents[0]?.id, true); }

  if (loading) return <DashboardLayout activePage="dashboard"><div className="product-state">Loading team operations...</div></DashboardLayout>;
  if (error) return <DashboardLayout activePage="dashboard"><div className="product-state error"><h2>Dashboard unavailable</h2><p>{error}</p><button onClick={loadData}>Try Again</button></div></DashboardLayout>;

  const waitingTickets = assignmentOptions.tickets || [];
  const recentTickets = dashboard?.recentTickets || [];
  const performance = dashboard?.agentPerformance || [];

  return (
    <DashboardLayout activePage="dashboard">
      <main className="product-dashboard manager-product-dashboard">
        <header className="product-page-header">
          <div><span className="product-eyebrow">Team operations</span><h1>Welcome back, Manager.</h1><p>Monitor workload, prioritize incoming requests and keep your support team moving.</p></div>
          <div className="dashboard-header-actions">
            <button className="product-secondary-button" onClick={() => navigate("/tickets/all")}><Icon name="tickets" />View All Tickets</button>
            <button className="product-primary-button" onClick={loadData}><Icon name="refresh" />Refresh Dashboard</button>
          </div>
        </header>

        <section className="product-kpi-grid">
          <article><span className="kpi-icon blue"><Icon name="open" /></span><div><small>Open Tickets</small><strong>{dashboard?.openTickets || 0}</strong><p>{dashboard?.criticalTickets || 0} critical requests</p></div></article>
          <article><span className="kpi-icon amber"><Icon name="unassigned" /></span><div><small>Unassigned</small><strong>{dashboard?.unassignedTickets || 0}</strong><p>Waiting for an agent</p></div></article>
          <article><span className="kpi-icon red"><Icon name="overdue" /></span><div><small>Overdue</small><strong>{dashboard?.overdueTickets || 0}</strong><p>Older than three days</p></div></article>
          <article><span className="kpi-icon green"><Icon name="resolved" /></span><div><small>Resolved</small><strong>{dashboard?.resolvedTickets || 0}</strong><p>Completed tickets</p></div></article>
        </section>

        <section className="product-two-column manager-focus-grid">
          <article className="product-panel product-alert-panel manager-needs-attention">
            <div className="product-panel-heading"><div><span>Priority queue</span><h2>Needs Attention</h2></div><span className="product-count">{waitingTickets.length}</span></div>
            {waitingTickets.length > 0 ? <div className="manager-assignment-rows">{waitingTickets.slice(0, 4).map((ticket) => {
              const leastBusyAgent = agents[0];
              return <div key={ticket.id} className="manager-assignment-row">
                <div className="manager-queue-ticket"><div className="manager-queue-title"><span>{ticket.ticketNumber}</span><strong>{ticket.subject}</strong></div><div className="manager-queue-meta"><span>{ticket.category}</span><span>{formatDate(ticket.createdAt)}</span><span className={`product-badge priority-${normalize(ticket.priority)}`}>{ticket.priority}</span></div></div>
                <div className="manager-queue-actions">
                  <div className="manager-manual-assignment"><span className="manager-action-label">Manual assignment</span><div className="manager-manual-controls"><select aria-label={`Choose agent for ${ticket.ticketNumber}`} value={selectedAgents[ticket.id] || leastBusyAgent?.id || ""} onChange={(event) => setSelectedAgents((current) => ({ ...current, [ticket.id]: event.target.value }))} disabled={agents.length === 0 || assigningTicketId === ticket.id}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.activeTickets} active</option>)}</select><button className="manager-manual-button" disabled={assigningTicketId === ticket.id || agents.length === 0} onClick={() => handleAssign(ticket.id)}>{assigningTicketId === ticket.id ? "Working..." : "Assign"}</button></div></div>
                  <div className="manager-auto-assignment"><div><span className="manager-action-label">Smart assignment</span><small>{leastBusyAgent ? `${leastBusyAgent.name} has the lightest workload (${leastBusyAgent.activeTickets} active).` : "No agent is currently available."}</small></div><button className="manager-auto-button" disabled={assigningTicketId === ticket.id || agents.length === 0} onClick={() => handleAutoAssign(ticket.id)}><Icon name="spark" />{assigningTicketId === ticket.id ? "Assigning..." : "Auto Assign"}</button></div>
                </div>
              </div>;
            })}</div> : <div className="product-empty"><strong>Everything is assigned</strong><p>No tickets are waiting for an agent.</p></div>}
            {message && <p className="product-inline-message manager-assignment-feedback">{message}</p>}
          </article>

          <article className="product-panel agent-workload-panel"><div className="product-panel-heading"><div><span>Team capacity</span><h2>Agent Workload</h2></div></div><div className="agent-workload-list">{(performance.length ? performance : agents).slice(0, 6).map((agent, index) => { const name = agent.agent || agent.name; const active = Number(agent.open ?? agent.activeTickets ?? 0); const max = Math.max(5, ...agents.map((item) => Number(item.activeTickets || 0))); return <div key={name || index}><span className="workload-avatar">{String(name || "A").charAt(0)}</span><div><strong>{name}</strong><small>{active} active tickets</small></div><div className="workload-bar"><span style={{ width: `${Math.min(100, (active / max) * 100)}%` }} /></div><b>{active}</b></div>; })}</div></article>
        </section>

        <section className="product-two-column manager-bottom-grid">
          <article className="product-panel product-table-panel"><div className="product-panel-heading"><div><span>Latest requests</span><h2>Recent Tickets</h2></div><button className="product-text-button" type="button" onClick={() => navigate("/tickets/all")}>View all</button></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Ticket</th><th>Requester</th><th>Priority</th><th>Status</th><th>Owner</th></tr></thead><tbody>{recentTickets.slice(0, 6).map((ticket) => <tr key={ticket.id}><td><button type="button" onClick={() => navigate(`/tickets/${ticket.id}`)}><span>{ticket.ticketNumber}</span><strong>{ticket.subject}</strong></button></td><td>{ticket.employee}</td><td><span className={`product-badge priority-${normalize(ticket.priority)}`}>{ticket.priority}</span></td><td><span className={`product-badge status-${normalize(ticket.status)}`}>{ticket.status}</span></td><td>{ticket.assignedTo || "Unassigned"}</td></tr>)}</tbody></table></div></article>
          <aside className="product-panel manager-quick-actions"><div className="product-panel-heading"><div><span>Shortcuts</span><h2>Quick Actions</h2></div></div><button onClick={() => document.querySelector(".manager-needs-attention")?.scrollIntoView({ behavior: "smooth" })}><span><Icon name="assign" /></span><strong>Assign Tickets</strong></button><button onClick={() => navigate("/tickets/all")}><span><Icon name="tickets" /></span><strong>View All Tickets</strong></button><button onClick={() => navigate("/reports")}><span><Icon name="reports" /></span><strong>View Reports</strong></button><button onClick={loadData}><span><Icon name="refresh" /></span><strong>Refresh Data</strong></button></aside>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default ManagerDashboard;
