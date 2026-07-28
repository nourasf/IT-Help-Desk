import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/DashboardLayout";
import { getMyTickets } from "../../api/ticket";

function MyTickets() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      setLoading(true);
      setError("");

      const data = await getMyTickets();
      setTickets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const searchValue = searchText.trim().toLowerCase();

      const matchesSearch =
        !searchValue ||
        ticket.subject?.toLowerCase().includes(searchValue) ||
        ticket.ticketNumber?.toLowerCase().includes(searchValue) ||
        ticket.category?.toLowerCase().includes(searchValue);

      const matchesStatus =
        !selectedStatus ||
        ticket.status?.toLowerCase() === selectedStatus.toLowerCase();

      const matchesPriority =
        !selectedPriority ||
        ticket.priority?.toLowerCase() ===
          selectedPriority.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [
    tickets,
    searchText,
    selectedStatus,
    selectedPriority,
  ]);

  function getStatusClass(status) {
    const normalizedStatus = status
      ?.toLowerCase()
      .replaceAll(" ", "-");

    switch (normalizedStatus) {
      case "open":
        return "status-open";

      case "pending":
        return "status-pending";

      case "resolved":
      case "closed":
        return "status-resolved";

      case "in-progress":
        return "status-progress";

      default:
        return "status-default";
    }
  }

  function getPriorityClass(priority) {
    switch (priority?.toLowerCase()) {
      case "critical":
        return "priority-critical";

      case "high":
        return "priority-high";

      case "medium":
        return "priority-medium";

      case "low":
        return "priority-low";

      default:
        return "priority-default";
    }
  }

  function formatDate(dateValue) {
    if (!dateValue) {
      return "—";
    }

    return new Date(dateValue).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <DashboardLayout activePage="my-tickets">
      <header className="tickets-page-header">
        <div>
          <p className="dashboard-welcome-label">
            Employee workspace
          </p>

          <h1>My Tickets</h1>

          <p className="dashboard-subtitle">
            Track your support requests and review their progress.
          </p>
        </div>

        <button
          className="new-ticket-button"
          type="button"
          onClick={() => navigate("/create-ticket")}
        >
          <span>＋</span>
          Create New Ticket
        </button>
      </header>

      <section className="ticket-summary-strip">
        <div className="ticket-summary-text">
          <span className="ticket-summary-icon">✦</span>

          <div>
            <strong>
              {filteredTickets.length}
              {filteredTickets.length === 1
                ? " ticket"
                : " tickets"}
            </strong>

            <p>
              Showing the requests that match your current filters.
            </p>
          </div>
        </div>

        <button
          className="clear-filters-button"
          type="button"
          onClick={() => {
            setSearchText("");
            setSelectedStatus("");
            setSelectedPriority("");
          }}
        >
          Clear filters
        </button>
      </section>

      <section className="tickets-panel my-tickets-panel">
        <div className="ticket-filters">
          <div className="table-search">
            <span className="ticket-search-symbol">⌕</span>

            <input
              type="text"
              placeholder="Search by subject, category or ID..."
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value)
            }
          >
            <option value="">All statuses</option>
            <option value="Open">Open</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(event) =>
              setSelectedPriority(event.target.value)
            }
          >
            <option value="">All priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        {loading && (
          <div className="tickets-state">
            <div className="tickets-loader"></div>

            <h3>Loading your tickets</h3>

            <p>
              We are collecting your latest support requests.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="tickets-state tickets-error-state">
            <div className="tickets-state-icon">!</div>

            <h3>We could not load your tickets</h3>

            <p>{error}</p>

            <button
              className="primary-pill-button"
              type="button"
              onClick={loadTickets}
            >
              Try again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          filteredTickets.length === 0 && (
            <div className="tickets-state">
              <div className="tickets-state-icon">⌁</div>

              <h3>No tickets found</h3>

              <p>
                Try changing the filters or create a new support
                request.
              </p>

              <button
                className="primary-pill-button"
                type="button"
                onClick={() => navigate("/create-ticket")}
              >
                Create ticket
              </button>
            </div>
          )}

        {!loading &&
          !error &&
          filteredTickets.length > 0 && (
            <div className="table-wrapper">
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="ticket-number">
                        {ticket.ticketNumber}
                      </td>

                      <td>
                        <div className="ticket-subject-cell">
                          <span className="ticket-subject-icon">
                            {ticket.subject
                              ?.charAt(0)
                              .toUpperCase()}
                          </span>

                          <div>
                            <strong>{ticket.subject}</strong>

                            <span>
                              Support request
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>{ticket.category}</td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            ticket.status
                          )}`}
                        >
                          <span className="badge-dot"></span>
                          {ticket.status}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`priority-badge ${getPriorityClass(
                            ticket.priority
                          )}`}
                        >
                          {ticket.priority}
                        </span>
                      </td>

                      <td>
                        {formatDate(ticket.createdAt)}
                      </td>

                      <td>
                        <button
                          className="ticket-action-button"
                          type="button"
                          onClick={() =>
                            navigate(`/tickets/${ticket.id}`)
                          }
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </DashboardLayout>
  );
}

export default MyTickets;