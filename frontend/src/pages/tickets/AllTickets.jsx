import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getAllTickets } from "../../api/ticket";
import { getStoredRole } from "../../utils/authStorage";
import "../../styles/AdminDashboard.css";

const inputStyle = {
  minHeight: 44,
  padding: "0 14px",
  border: "1px solid #ddd4e9",
  borderRadius: 11,
  outline: "none",
  background: "#fff",
  color: "#4d4659",
};

function AllTickets() {
  const navigate = useNavigate();
  const role = String(getStoredRole() || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  async function loadTickets() {
    setLoading(true);
    setError("");
    try {
      setTickets(await getAllTickets());
    } catch (requestError) {
      setError(requestError.message || "Tickets could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTickets(); }, []);

  const statuses = useMemo(
    () => [...new Set(tickets.map((ticket) => ticket.status).filter(Boolean))],
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesSearch = !query || [
        ticket.ticketNumber,
        ticket.subject,
        ticket.category,
        ticket.priority,
        ticket.status,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesStatus = status === "all" || String(ticket.status || "").toLowerCase() === status.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, status]);

  return (
    <DashboardLayout activePage={isAdmin ? "admin-tickets" : "all-tickets"}>
      <main className="admin-product-dashboard">
        <header className="admin-dashboard-header">
          <div>
            <p className="admin-eyebrow">Ticket oversight</p>
            <h1>All Tickets</h1>
            <p>Search the help desk and open any ticket to review its details, history and activity.</p>
          </div>
          <button className="admin-create-user-button" type="button" onClick={loadTickets}>Refresh</button>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) minmax(160px,190px)", gap: 12, marginBottom: 18 }}>
          <input
            style={inputStyle}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ticket number, subject, category..."
          />
          <select style={inputStyle} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><p>{isAdmin ? "Administration" : "Management"}</p><h2>Ticket List</h2></div>
            <span>{filteredTickets.length} tickets</span>
          </div>

          {loading ? (
            <p className="admin-empty-state">Loading tickets...</p>
          ) : error ? (
            <div className="admin-empty-state"><p>{error}</p><button type="button" onClick={loadTickets}>Try again</button></div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-activity-table">
                <thead>
                  <tr><th>Ticket</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} onDoubleClick={() => navigate(`/tickets/${ticket.id}`)}>
                      <td><strong>{ticket.ticketNumber}</strong><span>{ticket.subject}</span></td>
                      <td>{ticket.category}</td>
                      <td><span className="admin-table-badge priority">{ticket.priority}</span></td>
                      <td><span className="admin-table-badge status">{ticket.status}</span></td>
                      <td>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <button
                          style={{ minHeight: 34, padding: "0 13px", border: 0, borderRadius: 9, background: "#eee8fa", color: "#6f54ad", fontWeight: 800, fontSize: 11 }}
                          type="button"
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                        >
                          View Ticket
                        </button>
                      </td>
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

export default AllTickets;
