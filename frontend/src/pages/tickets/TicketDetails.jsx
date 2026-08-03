import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  getTicketById,
  startWork,
  pauseWork,
} from "../../api/ticket";
import "../../styles/TicketDetails.css";

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBadgeClass(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-");
}

function getInitials(name) {
  if (!name) {
    return "NA";
  }

  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [workLoading, setWorkLoading] = useState(false);
  const [workMessage, setWorkMessage] = useState("");
  const [workError, setWorkError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    loadTicket();
  }, [id]);

  async function loadTicket() {
    setLoading(true);
    setError("");

    try {
      const data = await getTicketById(id);

      setTicket(data);

      /*
       * This will start working once the backend returns
       * activeWorkSession.
       */
      setIsWorking(Boolean(data.activeWorkSession));
    } catch (requestError) {
      setError(
        requestError.message ||
          "The ticket could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStartWork() {
    setWorkLoading(true);
    setWorkMessage("");
    setWorkError("");

    try {
      const result = await startWork(id);

      setIsWorking(true);

      setWorkMessage(
        result.message ||
          "Work session started successfully."
      );

      await loadTicket();
    } catch (requestError) {
      setWorkError(
        requestError.message ||
          "The work session could not be started."
      );
    } finally {
      setWorkLoading(false);
    }
  }

  async function handlePauseWork() {
    setWorkLoading(true);
    setWorkMessage("");
    setWorkError("");

    try {
      const result = await pauseWork(id);

      setIsWorking(false);

      setWorkMessage(
        result.message ||
          "Work session paused successfully."
      );

      await loadTicket();
    } catch (requestError) {
      setWorkError(
        requestError.message ||
          "The work session could not be paused."
      );
    } finally {
      setWorkLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout activePage="tickets">
        <div className="ticket-details-state">
          Loading ticket...
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout activePage="tickets">
        <div className="ticket-details-state error">
          <h2>Could not load ticket</h2>
          <p>{error}</p>

          <button type="button" onClick={loadTicket}>
            Try Again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!ticket) {
    return (
      <DashboardLayout activePage="tickets">
        <div className="ticket-details-state error">
          Ticket not found.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activePage="tickets">
      <main className="ticket-details-page">
        <header className="ticket-details-header">
          <div>
            <button
              type="button"
              className="ticket-back-button"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>

            <span className="ticket-details-number">
              {ticket.ticketNumber}
            </span>

            <h1>{ticket.subject}</h1>

            <div className="ticket-details-badges">
              <span
                className={`ticket-details-badge priority-${getBadgeClass(
                  ticket.priority
                )}`}
              >
                {ticket.priority}
              </span>

              <span
                className={`ticket-details-badge status-${getBadgeClass(
                  ticket.status
                )}`}
              >
                {ticket.status}
              </span>
            </div>
          </div>

          <div className="ticket-details-header-actions">
            <button
              type="button"
              className={
                isWorking
                  ? "ticket-pause-work-button"
                  : "ticket-start-work-button"
              }
              disabled={!ticket.canEdit || workLoading}
              onClick={
                isWorking
                  ? handlePauseWork
                  : handleStartWork
              }
            >
              {workLoading
                ? "Please wait..."
                : isWorking
                  ? "Pause Work"
                  : "Start Work"}
            </button>
          </div>
        </header>

        {workMessage && (
          <div className="ticket-work-message success">
            {workMessage}
          </div>
        )}

        {workError && (
          <div className="ticket-work-message error">
            {workError}
          </div>
        )}

        {ticket.isClosed && (
          <div className="ticket-closed-banner">
            This ticket is closed and is now read-only.
          </div>
        )}

        <section className="ticket-details-grid">
          <article className="ticket-details-main-card">
            <div className="ticket-details-section-heading">
              <h2>Issue Description</h2>
            </div>

            <p className="ticket-description">
              {ticket.description}
            </p>

            <div className="ticket-information-grid">
              <div>
                <span>Category</span>
                <strong>{ticket.category}</strong>
              </div>

              <div>
                <span>Priority</span>
                <strong>{ticket.priority}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{ticket.status}</strong>
              </div>

              <div>
                <span>Created</span>
                <strong>
                  {formatDate(ticket.createdAt)}
                </strong>
              </div>

              <div>
                <span>Last Updated</span>
                <strong>
                  {formatDate(ticket.updatedAt)}
                </strong>
              </div>

              <div>
                <span>Closed</span>
                <strong>
                  {formatDate(ticket.closedAt)}
                </strong>
              </div>
            </div>
          </article>

          <aside className="ticket-details-sidebar">
            <article className="ticket-person-card">
              <span className="ticket-person-label">
                Requested by
              </span>

              <div className="ticket-person-details">
                <span className="ticket-person-avatar">
                  {getInitials(ticket.employee?.name)}
                </span>

                <div>
                  <strong>
                    {ticket.employee?.name || "Unknown employee"}
                  </strong>

                  <small>
                    {ticket.employee?.email || "No email"}
                  </small>
                </div>
              </div>
            </article>

            <article className="ticket-person-card">
              <span className="ticket-person-label">
                Assigned agent
              </span>

              {ticket.assignedAgent ? (
                <div className="ticket-person-details">
                  <span className="ticket-person-avatar agent">
                    {getInitials(
                      ticket.assignedAgent.name
                    )}
                  </span>

                  <div>
                    <strong>
                      {ticket.assignedAgent.name}
                    </strong>

                    <small>
                      {ticket.assignedAgent.email}
                    </small>
                  </div>
                </div>
              ) : (
                <p className="ticket-unassigned-text">
                  This ticket is currently unassigned.
                </p>
              )}
            </article>

            <article className="ticket-work-card">
              <h2>Work Session</h2>

              {isWorking ? (
                <div className="ticket-work-active">
                  <span className="ticket-work-active-dot" />

                  <div>
                    <strong>Work session active</strong>

                    <p>
                      Your working time is currently being
                      tracked.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="ticket-work-empty">
                  <strong>No active work session</strong>

                  <p>
                    Start work to track the real time spent on
                    this ticket.
                  </p>
                </div>
              )}

              <div className="ticket-total-work-time">
                <span>Total working time</span>

                <strong>
                  {ticket.totalWorkMinutes ?? 0} minutes
                </strong>
              </div>
            </article>
          </aside>
        </section>

        <section className="ticket-details-bottom-grid">
          <article className="ticket-details-placeholder-card">
            <h2>Comments</h2>

            <p>
              Ticket comments will appear here after we connect
              the comments endpoint.
            </p>
          </article>

          <article className="ticket-details-placeholder-card">
            <h2>Activity Timeline</h2>

            <p>
              Status changes, assignments and work sessions will
              appear here.
            </p>
          </article>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default TicketDetails;