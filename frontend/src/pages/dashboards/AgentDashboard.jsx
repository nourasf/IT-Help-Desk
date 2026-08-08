import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getAgentDashboard } from "../../api/dashboard";
import { takeTicket } from "../../api/ticket";
import "../../styles/AgentDashboard.css";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replaceAll(" ", "-");
}

function AgentDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [takingTicketId, setTakingTicketId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");
      setDashboard(await getAgentDashboard());
    } catch (requestError) {
      setError(requestError.message || "The agent dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const tickets = dashboard?.recentTickets || dashboard?.tickets || [];
  const availableTickets = dashboard?.availableTickets || [];
  const assignedTickets = tickets.filter((ticket) => ticket.assignedToMe !== false);
  const currentTicket = assignedTickets.find((ticket) => String(ticket.status).toLowerCase() === "in progress") || assignedTickets[0] || null;
  const criticalTickets = assignedTickets.filter((ticket) => String(ticket.priority).toLowerCase() === "critical" && !["resolved", "closed"].includes(String(ticket.status).toLowerCase()));

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignedTickets.filter((ticket) =>
      !query ||
      String(ticket.ticketNumber || "").toLowerCase().includes(query) ||
      String(ticket.subject || "").toLowerCase().includes(query) ||
      String(ticket.employee || "").toLowerCase().includes(query)
    );
  }, [assignedTickets, search]);

  async function handleTakeTicket(ticketId) {
    try {
      setTakingTicketId(ticketId);
      setMessage("");
      const result = await takeTicket(ticketId);
      setMessage(result.message || "Ticket assigned to you.");
      await loadDashboard();
    } catch (requestError) {
      setMessage(requestError.message || "The ticket could not be assigned.");
    } finally {
      setTakingTicketId(null);
    }
  }

  if (loading) {
    return <DashboardLayout activePage="dashboard"><div className="product-state">Loading your workspace...</div></DashboardLayout>;
  }

  if (error) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="product-state error"><h2>Dashboard unavailable</h2><p>{error}</p><button onClick={loadDashboard}>Try Again</button></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activePage="dashboard">
      <main className="product-dashboard agent-product-dashboard">
        <header className="product-page-header">
          <div>
            <span className="product-eyebrow">Support agent workspace</span>
            <h1>Good morning, {dashboard?.fullName || dashboard?.name || "Ian"}.</h1>
            <p>You have {dashboard?.assignedToMe || 0} tickets to work on today.</p>
          </div>
          <button className="product-primary-button" onClick={() => navigate("/agent-tickets")}>View Queue</button>
        </header>

        <section className="product-agent-top-grid">
          <article className="product-panel compact-overview-panel">
            <div className="product-panel-heading"><div><span>Today</span><h2>Overview</h2></div></div>
            <div className="product-mini-metrics">
              <div><span>Assigned</span><strong>{dashboard?.assignedToMe || 0}</strong></div>
              <div><span>In progress</span><strong>{assignedTickets.filter((t) => String(t.status).toLowerCase() === "in progress").length}</strong></div>
              <div><span>Available</span><strong>{dashboard?.unassignedTickets || 0}</strong></div>
              <div><span>Resolved today</span><strong>{dashboard?.resolvedToday || 0}</strong></div>
            </div>
          </article>

          <article className="product-panel current-ticket-panel">
            <div className="product-panel-heading"><div><span>Focus</span><h2>Current Ticket</h2></div>{currentTicket && <span className={`product-badge status-${normalize(currentTicket.status)}`}>{currentTicket.status}</span>}</div>
            {currentTicket ? (
              <button className="current-ticket-content" onClick={() => navigate(`/tickets/${currentTicket.id}`)}>
                <span>{currentTicket.ticketNumber || `#${currentTicket.id}`}</span>
                <strong>{currentTicket.subject}</strong>
                <small>Requested by {currentTicket.employee || "Employee"}</small>
                <div><span>{currentTicket.priority}</span><b>Continue working →</b></div>
              </button>
            ) : <div className="product-empty"><strong>No active ticket</strong><p>Your assigned work will appear here.</p></div>}
          </article>

          <article className="product-panel work-timer-panel">
            <div className="product-panel-heading"><div><span>Time tracking</span><h2>Work Timer</h2></div></div>
            <div className="timer-display">{currentTicket ? "00:00:00" : "—"}</div>
            <p>{currentTicket ? "Open the ticket to start or resume work." : "No ticket is currently active."}</p>
            <button disabled={!currentTicket} onClick={() => currentTicket && navigate(`/tickets/${currentTicket.id}`)}>Open Work Session</button>
          </article>
        </section>

        <section className="product-panel agent-incoming-panel">
          <div className="product-panel-heading">
            <div>
              <span>Incoming queue</span>
              <h2>Available Tickets</h2>
              <p className="agent-incoming-description">Unassigned requests are visible to the support team. Take one when you are ready to work on it.</p>
            </div>
            <span className="product-count">{availableTickets.length}</span>
          </div>

          {availableTickets.length > 0 ? (
            <div className="agent-incoming-list">
              {availableTickets.map((ticket) => (
                <article className="agent-incoming-card" key={ticket.id}>
                  <div className="agent-incoming-main">
                    <span className="agent-incoming-number">{ticket.ticketNumber}</span>
                    <strong>{ticket.subject}</strong>
                    <small>Requested by {ticket.employee || "Employee"}</small>
                  </div>
                  <div className="agent-incoming-meta">
                    <span>{ticket.category}</span>
                    <span>{formatDate(ticket.createdAt)}</span>
                    <span className={`product-badge priority-${normalize(ticket.priority)}`}>{ticket.priority}</span>
                  </div>
                  <button
                    type="button"
                    className="agent-take-ticket-button"
                    disabled={takingTicketId === ticket.id}
                    onClick={() => handleTakeTicket(ticket.id)}
                  >
                    {takingTicketId === ticket.id ? "Taking..." : "Take Ticket"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="product-empty"><strong>No incoming tickets</strong><p>All current requests have already been assigned.</p></div>
          )}

          {message && <p className="product-inline-message agent-take-message">{message}</p>}
        </section>

        {criticalTickets.length > 0 && (
          <section className="product-panel product-alert-panel">
            <div className="product-panel-heading"><div><span>Priority</span><h2>Needs Attention</h2></div><span className="product-count">{criticalTickets.length}</span></div>
            <div className="product-alert-list">
              {criticalTickets.slice(0, 3).map((ticket) => (
                <button key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
                  <span>{ticket.ticketNumber}</span><strong>{ticket.subject}</strong><small>{ticket.employee} · {formatDate(ticket.createdAt)}</small><b>Open Ticket</b>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="product-two-column">
          <article className="product-panel product-table-panel">
            <div className="product-panel-heading"><div><span>My work</span><h2>Assigned Tickets</h2></div><button className="product-text-button" onClick={() => navigate("/agent-tickets")}>View all</button></div>
            <div className="product-table-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets..." /></div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead><tr><th>Ticket</th><th>Requester</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead>
                <tbody>
                  {filteredTickets.slice(0, 6).map((ticket) => (
                    <tr key={ticket.id}>
                      <td><button onClick={() => navigate(`/tickets/${ticket.id}`)}><span>{ticket.ticketNumber || `#${ticket.id}`}</span><strong>{ticket.subject}</strong></button></td>
                      <td>{ticket.employee || "—"}</td>
                      <td><span className={`product-badge priority-${normalize(ticket.priority)}`}>{ticket.priority}</span></td>
                      <td><span className={`product-badge status-${normalize(ticket.status)}`}>{ticket.status}</span></td>
                      <td>{formatDate(ticket.updatedAt || ticket.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="product-panel recent-activity-panel">
            <div className="product-panel-heading"><div><span>Timeline</span><h2>Recent Activity</h2></div></div>
            <div className="product-activity-list">
              {assignedTickets.slice(0, 4).map((ticket, index) => (
                <div key={ticket.id}><span>{index + 1}</span><div><strong>{ticket.subject}</strong><small>{ticket.status} · {formatDate(ticket.updatedAt || ticket.createdAt)}</small></div></div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default AgentDashboard;
