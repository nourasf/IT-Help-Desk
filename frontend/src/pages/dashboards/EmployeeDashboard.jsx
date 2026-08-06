import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getEmployeeDashboard } from "../../api/dashboard";
import "../../styles/EmployeeDashboard.css";

function normalize(value) {
  return String(value || "").trim().toLowerCase().replaceAll(" ", "-");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function EmployeeDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");
      setDashboard(await getEmployeeDashboard());
    } catch (requestError) {
      setError(requestError.message || "The dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const tickets = dashboard?.recentTickets || dashboard?.tickets || [];
  const counts = {
    open: tickets.filter((ticket) => String(ticket.status).toLowerCase() === "open").length,
    progress: tickets.filter((ticket) => String(ticket.status).toLowerCase() === "in progress").length,
    resolved: tickets.filter((ticket) => String(ticket.status).toLowerCase() === "resolved").length,
    closed: tickets.filter((ticket) => String(ticket.status).toLowerCase() === "closed").length,
  };

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter((ticket) =>
      !query ||
      String(ticket.ticketNumber || "").toLowerCase().includes(query) ||
      String(ticket.subject || "").toLowerCase().includes(query)
    );
  }, [tickets, search]);

  if (loading) return <DashboardLayout activePage="dashboard"><div className="product-state">Loading your dashboard...</div></DashboardLayout>;
  if (error) return <DashboardLayout activePage="dashboard"><div className="product-state error"><h2>Dashboard unavailable</h2><p>{error}</p><button onClick={loadDashboard}>Try Again</button></div></DashboardLayout>;

  return (
    <DashboardLayout activePage="dashboard">
      <main className="product-dashboard employee-product-dashboard">
        <header className="product-page-header">
          <div>
            <span className="product-eyebrow">Employee workspace</span>
            <h1>Welcome, {dashboard?.fullName || dashboard?.name || "Emily"}.</h1>
            <p>Here is the current status of your support requests.</p>
          </div>
          <button className="product-primary-button" onClick={() => navigate("/create-ticket")}>+ Create New Ticket</button>
        </header>

        <section className="product-panel employee-overview-panel">
          <div className="product-panel-heading"><div><span>My requests</span><h2>Ticket Overview</h2></div></div>
          <div className="employee-status-grid">
            <div className="open"><span>Open</span><strong>{counts.open}</strong></div>
            <div className="progress"><span>In Progress</span><strong>{counts.progress}</strong></div>
            <div className="resolved"><span>Resolved</span><strong>{counts.resolved}</strong></div>
            <div className="closed"><span>Closed</span><strong>{counts.closed}</strong></div>
          </div>
        </section>

        <section className="product-two-column employee-main-grid">
          <article className="product-panel product-table-panel">
            <div className="product-panel-heading"><div><span>Latest</span><h2>My Recent Tickets</h2></div><button className="product-text-button" onClick={() => navigate("/my-tickets")}>View all tickets</button></div>
            <div className="product-table-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search my tickets..." /></div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead><tr><th>Ticket</th><th>Status</th><th>Priority</th><th>Updated</th></tr></thead>
                <tbody>
                  {filteredTickets.slice(0, 7).map((ticket) => (
                    <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
                      <td><button><span>{ticket.ticketNumber || `#${ticket.id}`}</span><strong>{ticket.subject}</strong></button></td>
                      <td><span className={`product-badge status-${normalize(ticket.status)}`}>{ticket.status || "Open"}</span></td>
                      <td><span className={`product-badge priority-${normalize(ticket.priority)}`}>{ticket.priority || "Medium"}</span></td>
                      <td>{formatDate(ticket.updatedAt || ticket.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="employee-side-stack">
            <article className="product-panel employee-action-panel">
              <div className="product-panel-heading"><div><span>Self service</span><h2>Quick Actions</h2></div></div>
              <button onClick={() => navigate("/create-ticket")}><span>＋</span><div><strong>Create a ticket</strong><small>Report a new issue</small></div><b>›</b></button>
              <button onClick={() => navigate("/my-tickets")}><span>▣</span><div><strong>Track requests</strong><small>Check ticket progress</small></div><b>›</b></button>
              <button onClick={() => navigate("/knowledge-base")}><span>▤</span><div><strong>Knowledge Base</strong><small>Find a quick solution</small></div><b>›</b></button>
            </article>

            <article className="product-panel knowledge-panel">
              <div className="product-panel-heading"><div><span>Popular guides</span><h2>Knowledge Base</h2></div></div>
              <button onClick={() => navigate("/knowledge-base")}>How to reset your password <span>→</span></button>
              <button onClick={() => navigate("/knowledge-base")}>How to connect to VPN <span>→</span></button>
              <button onClick={() => navigate("/knowledge-base")}>Set up email on mobile <span>→</span></button>
              <div className="knowledge-illustration">▤</div>
            </article>
          </aside>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default EmployeeDashboard;
