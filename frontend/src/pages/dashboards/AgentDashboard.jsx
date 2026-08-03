import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getAgentDashboard } from "../../api/dashboard";
import "../../styles/AgentDashboard.css";
import {takeTicket} from "../../api/ticket";


function getInitials(name) {
  if (!name) {
    return "NA";
  }

  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getBadgeClass(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("_", "-");
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  const today = new Date();

  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return `Today, ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getWorkloadDetails(activeTickets) {
  const count = Number(activeTickets) || 0;

  if (count <= 2) {
    return {
      label: "Available",
      description: "You currently have capacity for another ticket.",
      className: "available",
    };
  }

  if (count <= 4) {
    return {
      label: "Moderate",
      description: "Your active workload is currently balanced.",
      className: "moderate",
    };
  }

  return {
    label: "Busy",
    description:
      "Complete some active work before taking another ticket.",
    className: "busy",
  };
}

function AgentDashboard() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [takingTicketId, setTakingTicketId] = useState(null);
  const[takeMessage,setTakeMessage]=useState("")
  const [takeError,setTakeError]=useState("")


  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleTakeTicket(ticketId) {
    setTakingTicketId(ticketId);
    setTakeMessage("");
    setTakeError("");
    try{
      const result= await takeTicket(ticketId);

      setTakeMessage(
        result.message || "Ticket successfully assigned to you.");
     await loadDashboard(); 
    }catch(requestError){
      setTakeError(
        requestError.message ||
        "The ticket could not be assigned to you."
      );
    }finally{
      setTakingTicketId(null);
      
    }
  }
  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const data = await getAgentDashboard();

      setDashboard(data);
    } catch (requestError) {
      console.error("Failed to load agent dashboard.", requestError);

      setError(
        requestError.message ||
          "The agent dashboard could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const tickets =
    dashboard?.recentTickets ||
    dashboard?.tickets ||
    [];

  const inProgressTickets = tickets.filter(
    (ticket) =>
      ticket.status?.toLowerCase() === "in progress"
  );

  const criticalTickets = tickets.filter(
    (ticket) =>
      ticket.priority?.toLowerCase() === "critical" &&
      ticket.status?.toLowerCase() !== "resolved" &&
      ticket.status?.toLowerCase() !== "closed"
  );

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return [...tickets]
      .sort((firstTicket, secondTicket) => {
        const firstIsCritical =
          firstTicket.priority?.toLowerCase() === "critical";

        const secondIsCritical =
          secondTicket.priority?.toLowerCase() === "critical";

        if (firstIsCritical !== secondIsCritical) {
          return firstIsCritical ? -1 : 1;
        }

        return (
          new Date(secondTicket.createdAt).getTime() -
          new Date(firstTicket.createdAt).getTime()
        );
      })
      .filter((ticket) => {
        const ticketNumber =
          ticket.ticketNumber?.toLowerCase() || "";

        const subject =
          ticket.subject?.toLowerCase() || "";

        const employee =
          ticket.employee?.toLowerCase() || "";

        const priority =
          ticket.priority?.toLowerCase() || "";

        const status =
          ticket.status?.toLowerCase() || "";

        const matchesSearch =
          !normalizedSearch ||
          ticketNumber.includes(normalizedSearch) ||
          subject.includes(normalizedSearch) ||
          employee.includes(normalizedSearch);

        const matchesPriority =
          !priorityFilter ||
          priority === priorityFilter.toLowerCase();

        const matchesStatus =
          !statusFilter ||
          status === statusFilter.toLowerCase();

        return (
          matchesSearch &&
          matchesPriority &&
          matchesStatus
        );
      });
  }, [
    tickets,
    search,
    priorityFilter,
    statusFilter,
  ]);

  if (loading) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="agent-page-state">
          <div className="agent-dashboard-loader"></div>

          <p>Loading your support workspace...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="agent-page-state agent-error-state">
          <h2>We could not load your dashboard</h2>

          <p>{error}</p>

          <button type="button" onClick={loadDashboard}>
            Try Again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const workload = getWorkloadDetails(
    dashboard?.assignedToMe
  );

  return (
    <DashboardLayout activePage="dashboard">
      <main className="agent-dashboard-page">
        <section className="agent-welcome-section">
          <div>
            <span className="agent-welcome-label">
              Support agent workspace
            </span>

            <h1>
              Welcome back,{" "}
              {dashboard?.fullName ||
                dashboard?.name ||
                "Ian"}{" "}
              <span className="agent-wave-emoji">
                👋
              </span>
            </h1>

            <p>
              Review assigned tickets, handle urgent issues and
              keep employee requests moving.
            </p>
          </div>

         
        </section>

        <section className="agent-overview-section">
          <div className="agent-section-title-row">
            <div>
              <h2>Today&apos;s Overview</h2>

              <p>
                A quick summary of your active support work.
              </p>
            </div>
          </div>

          <div className="agent-overview-grid">
            <article className="agent-overview-card assigned">
              <span className="agent-overview-icon">
                ▣
              </span>

              <div>
                <strong>
                  {dashboard.assignedToMe}
                </strong>

                <span>Assigned to Me</span>

                <small>Active support tickets</small>
              </div>
            </article>

            <article className="agent-overview-card progress">
              <span className="agent-overview-icon">
                ◷
              </span>

              <div>
                <strong>
                  {inProgressTickets.length}
                </strong>

                <span>In Progress</span>

                <small>Currently being worked on</small>
              </div>
            </article>

            <article className="agent-overview-card critical">
              <span className="agent-overview-icon">
                !
              </span>

              <div>
                <strong>
                  {dashboard.criticalTickets}
                </strong>

                <span>Critical</span>

                <small>Needs immediate attention</small>
              </div>
            </article>

            <article className="agent-overview-card resolved">
              <span className="agent-overview-icon">
                ✓
              </span>

              <div>
                <strong>
                  {dashboard.resolvedToday}
                </strong>

                <span>Resolved Today</span>

                <small>Completed this workday</small>
              </div>
            </article>
          </div>
        </section>

        <section className="agent-priority-section">
          <div className="agent-priority-header">
            <div className="agent-priority-title">
              <span className="agent-priority-alert-icon">
                !
              </span>

              <div>
                <h2>Needs Immediate Attention</h2>

                <p>
                  Critical tickets currently assigned to you.
                </p>
              </div>
            </div>

            <span className="agent-priority-count">
              {criticalTickets.length}
            </span>
          </div>

          {criticalTickets.length > 0 ? (
            <div className="agent-priority-list">
              {criticalTickets
                .slice(0, 3)
                .map((ticket) => (
                  <button
                    type="button"
                    className="agent-priority-ticket"
                    key={ticket.id}
                    onClick={() =>
                      navigate(`/tickets/${ticket.id}`)
                    }
                  >
                    <div>
                      <span className="agent-priority-ticket-number">
                        {ticket.ticketNumber ||
                          `#${ticket.id}`}
                      </span>

                      <h3>{ticket.subject}</h3>

                      <p>
                        Requested by {ticket.employee}
                        {" · "}
                        {formatDate(ticket.createdAt)}
                      </p>
                    </div>

                    <span className="agent-open-priority-button">
                      Open Ticket
                    </span>
                  </button>
                ))}
            </div>
          ) : (
            <div className="agent-no-priority-tickets">
              <span>✓</span>

              <div>
                <h3>Everything is under control</h3>

                <p>
                  You have no critical tickets right now.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="agent-quick-actions-section">
          <div className="agent-section-title-row">
            <div>
              <h2>Quick Actions</h2>

              <p>
                Continue your most common support tasks.
              </p>
            </div>
          </div>

          <div className="agent-quick-actions-grid">
            <button
              type="button"
              className="agent-quick-action-card"
              onClick={() => {
                const firstTicket =
                  inProgressTickets[0] || tickets[0];

                if (firstTicket) {
                  navigate(`/tickets/${firstTicket.id}`);
                }
              }}
              disabled={tickets.length === 0}
            >
              <span className="agent-quick-action-icon resume-icon">
                ▶
              </span>

              <span className="agent-quick-action-text">
                <strong>Resume Work</strong>

                <small>
                  Continue your active ticket
                </small>
              </span>

              <span className="agent-quick-action-arrow">
                ›
              </span>
            </button>

            <button
              type="button"
              className="agent-quick-action-card"
              onClick={() =>
                navigate("/agent-tickets")
              }
            >
              <span className="agent-quick-action-icon queue-icon">
                ▤
              </span>

              <span className="agent-quick-action-text">
                <strong>My Ticket Queue</strong>

                <small>
                  View all assigned requests
                </small>
              </span>

              <span className="agent-quick-action-arrow">
                ›
              </span>
            </button>

            <button
              type="button"
              className="agent-quick-action-card"
              disabled
              title="Assignment history will be connected later."
            >
              <span className="agent-quick-action-icon history-icon">
                ↻
              </span>

              <span className="agent-quick-action-text">
                <strong>Assignment History</strong>

                <small>
                  Review previous ticket assignments
                </small>
              </span>

              <span className="agent-quick-action-arrow">
                ›
              </span>
            </button>
          </div>
        </section>

        <section className="agent-assigned-section">
          <div className="agent-section-title-row agent-tickets-title-row">
            <div>
              <h2>My Assigned Tickets</h2>

              <p>
                Critical requests are shown first.
              </p>
            </div>

            <button
              type="button"
              className="agent-view-all-button"
              onClick={() =>
                navigate("/agent-tickets")
              }
            >
              View all tickets
              <span>›</span>
            </button>
          </div>

          <div className="agent-ticket-filters">
            <div className="agent-ticket-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search ticket, subject or employee..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">
                In Progress
              </option>
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value)
              }
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">
                Critical
              </option>
            </select>
          </div>

          <div className="agent-ticket-table-wrapper">
            <table className="agent-ticket-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Employee</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredTickets.length > 0 ? (
                  filteredTickets
                    .slice(0, 7)
                    .map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <div className="agent-ticket-main-cell">
                            <span>
                              {ticket.ticketNumber ||
                                `#${ticket.id}`}
                            </span>

                            <strong>
                              {ticket.subject}
                            </strong>
                          </div>
                        </td>

                        <td>
                          <div className="agent-employee-cell">
                            <span className="agent-employee-avatar">
                              {getInitials(
                                ticket.employee
                              )}
                            </span>

                            <span>
                              {ticket.employee}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`agent-ticket-badge priority-${getBadgeClass(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`agent-ticket-badge status-${getBadgeClass(
                              ticket.status
                            )}`}
                          >
                            {ticket.status}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            ticket.createdAt
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="agent-open-ticket-button"
                            onClick={() =>
                              navigate(
                                `/tickets/${ticket.id}`
                              )
                            }
                          >
                            Open Ticket
                          </button>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan="6">
                      <div className="agent-empty-tickets">
                        <div className="agent-empty-ticket-icon">
                          ▱
                        </div>

                        <h3>No tickets found</h3>

                        <p>
                          You have no matching assigned tickets.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="agent-bottom-grid">
          <article className="agent-info-card agent-workload-card">
            <div className="agent-info-card-header">
              <div>
                <h2>My Workload</h2>

                <p>
                  Your current support capacity.
                </p>
              </div>

              <span
                className={`agent-workload-label ${workload.className}`}
              >
                {workload.label}
              </span>
            </div>

            <div className="agent-workload-main">
              <div>
                <strong>
                  {dashboard.assignedToMe}
                </strong>

                <span>
                  active ticket
                  {dashboard.assignedToMe === 1
                    ? ""
                    : "s"}
                </span>
              </div>

              <p>{workload.description}</p>
            </div>

            <div className="agent-workload-details">
              <div>
                <span>In Progress</span>

                <strong>
                  {inProgressTickets.length}
                </strong>
              </div>

              <div>
                <span>Critical</span>

                <strong>
                  {dashboard.criticalTickets}
                </strong>
              </div>

              <div>
                <span>Resolved Today</span>

                <strong>
                  {dashboard.resolvedToday}
                </strong>
              </div>
            </div>
          </article>

          <article className="agent-info-card agent-available-card">
  <div className="agent-info-card-header">
    <div>
      <h2>Available Tickets</h2>
      <p>Unassigned requests waiting for an agent.</p>
    </div>

    <span className="agent-info-header-icon">
      {dashboard.availableTickets?.length || 0}
    </span>
  </div>

  {takeMessage && (
    <div className="agent-take-message success">
      {takeMessage}
    </div>
  )}

  {takeError && (
    <div className="agent-take-message error">
      {takeError}
    </div>
  )}

  {dashboard.availableTickets?.length > 0 ? (
    <div className="agent-available-ticket-list">
      {dashboard.availableTickets.map((ticket) => (
        <article
          className="agent-available-ticket-item"
          key={ticket.id}
        >
          <div className="agent-available-ticket-content">
            <span className="agent-available-ticket-number">
              {ticket.ticketNumber}
            </span>

            <strong>{ticket.subject}</strong>

            <p>
              {ticket.category} · {ticket.priority} ·{" "}
              {ticket.employee}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleTakeTicket(ticket.id)}
            disabled={takingTicketId === ticket.id}
          >
            {takingTicketId === ticket.id
              ? "Taking..."
              : "Take Ticket"}
          </button>
        </article>
      ))}
    </div>
  ) : (
    <div className="agent-no-available-tickets">
      <span>✓</span>

      <div>
        <h3>No tickets waiting</h3>
        <p>All current requests are already assigned.</p>
      </div>
    </div>
  )}
</article>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default AgentDashboard;