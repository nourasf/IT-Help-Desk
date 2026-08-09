import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getAllTickets } from "../../api/ticket";
import "../../styles/AdminDashboard.css";

function AdminTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  async function loadTickets() {
    setLoading(true);
    setError("");
    try { setTickets(await getAllTickets()); }
    catch (requestError) { setError(requestError.message || "Tickets could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTickets(); }, []);

  const statuses = useMemo(() => [...new Set(tickets.map((ticket) => ticket.status).filter(Boolean))], [tickets]);
  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesSearch = !query || [ticket.ticketNumber, ticket.subject, ticket.category, ticket.priority]
        .some((value) => String(value || "").toLowerCase().includes(query));
      const matchesStatus = status === "all" || String(ticket.status).toLowerCase() === status.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, status]);

  return (
    <DashboardLayout activePage="admin-tickets">
      <main className="admin-tickets-page">
        <header className="admin-tickets-header">
          <div>
            <p className="admin-eyebrow">Ticket oversight</p>
            <h1>All Tickets</h1>
            <p>Open any ticket to review its history, activity and leave a comment.</p>
          </div>
          <span className="admin-ticket-count">{filteredTickets.length} tickets</span>
        </header>

        <section className="admin-ticket-filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ticket number, subject, category..." />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </section>

        <section className="admin-panel admin-all-tickets-panel">
          {loading ? <p className="admin-empty-state">Loading tickets...</p> : error ? (
            <div className="admin-empty-state"><p>{error}</p><button type="button" onClick={loadTickets}>Try again</button></div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-activity-table">
                <thead><tr><th>Ticket</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td><strong>{ticket.ticketNumber}</strong><span>{ticket.subject}</span></td>
                      <td>{ticket.category}</td>
                      <td><span className="admin-table-badge priority">{ticket.priority}</span></td>
                      <td><span className="admin-table-badge status">{ticket.status}</span></td>
                      <td>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : "—"}</td>
                      <td><button className="admin-view-ticket-button" type="button" onClick={() => navigate(`/tickets/${ticket.id}`)}>View Ticket</button></td>
                    </tr>
                  ))}
                  {!filteredTickets.length && <tr><td colSpan="6" className="admin-empty-table">No tickets match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </DashboardLayout>
  );
}

export default AdminTickets;
