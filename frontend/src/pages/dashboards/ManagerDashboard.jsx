import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { getManagerDashboard } from "../../api/dashboard";
import {
  assignTicket,
  getAssignmentOptions,
} from "../../api/ticket";
import "../../styles/ManagerDashboard.css";

const statusColors = {
  Open: "#8c78cb",
  "In Progress": "#5b8fd6",
  Pending: "#d4a744",
  Resolved: "#45a775",
  Closed: "#7e8798",
};

function ManagerIcon({ name }) {
  const icons = {
    tickets: (
      <>
        <path d="M4 6h16v12H4z" />
        <path d="M8 6v12" />
        <path d="M16 6v12" />
      </>
    ),
    active: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    overdue: (
      <>
        <path d="M12 4 3.5 19h17z" />
        <path d="M12 9v4" />
        <path d="M12 16h.01" />
      </>
    ),
    resolved: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16.5 9" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

function ManagerMetric({ icon, label, value, description, tone }) {
  return (
    <article className={`manager-metric ${tone}`}>
      <div className="manager-metric-icon">
        <ManagerIcon name={icon} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{description}</span>
      </div>
    </article>
  );
}

function performanceLabel(rate) {
  if (rate >= 75) return "Excellent";
  if (rate >= 50) return "Good";
  if (rate > 0) return "Needs attention";
  return "No data";
}

function formatDate(value) {
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ManagerDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [assignmentOptions, setAssignmentOptions] = useState({
    tickets: [],
    agents: [],
  });
  const [selectedAgents, setSelectedAgents] = useState({});
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assigningTicketId, setAssigningTicketId] = useState(null);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

  async function loadDashboard() {
    setError("");

    try {
      const data = await getManagerDashboard();
      setDashboard(data);
    } catch (requestError) {
      setError(requestError.message || "The dashboard could not be loaded.");
    }
  }

  async function loadAssignmentOptions(signal) {
    setAssignmentLoading(true);
    setAssignmentError("");

    try {
      const data = await getAssignmentOptions(signal);
      setAssignmentOptions(data);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setAssignmentError(
          requestError.message ||
            "The assignment options could not be loaded."
        );
      }
    } finally {
      if (!signal?.aborted) {
        setAssignmentLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    loadDashboard();

    loadAssignmentOptions(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  function handleAgentChange(ticketId, agentUserId) {
    setSelectedAgents((currentSelections) => ({
      ...currentSelections,
      [ticketId]: agentUserId,
    }));
    setAssignmentError("");
    setAssignmentMessage("");
  }

  async function handleAssignTicket(ticketId) {
    const agentUserId = selectedAgents[ticketId];

    if (!agentUserId) {
      setAssignmentMessage("");
      setAssignmentError("Please select an agent first.");
      return;
    }

    setAssigningTicketId(ticketId);
    setAssignmentMessage("");
    setAssignmentError("");

    try {
      const result = await assignTicket(ticketId, agentUserId);

      setAssignmentMessage(
        result.message || "The ticket was assigned successfully."
      );

      setSelectedAgents((currentSelections) => {
        const updatedSelections = { ...currentSelections };
        delete updatedSelections[ticketId];
        return updatedSelections;
      });

      await Promise.all([
        loadDashboard(),
        loadAssignmentOptions(),
      ]);
    } catch (requestError) {
      setAssignmentError(
        requestError.message || "The ticket could not be assigned."
      );
    } finally {
      setAssigningTicketId(null);
    }
  }

  if (error) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="manager-dashboard-state">
          <h1>Dashboard unavailable</h1>
          <p>{error}</p>
          <button type="button" onClick={loadDashboard}>
            Try Again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboard) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="manager-dashboard-state">Loading dashboard...</div>
      </DashboardLayout>
    );
  }

  const statusData = dashboard.ticketsByStatus || [];
  const agents = dashboard.agentPerformance || [];
  const recentTickets = dashboard.recentTickets || [];
  const statusTotal = statusData.reduce(
    (total, status) => total + status.count,
    0
  );

  return (
    <DashboardLayout activePage="dashboard">
      <header className="manager-dashboard-header">
        <div>
          <p className="manager-eyebrow">Team operations</p>
          <h1>Manager Dashboard</h1>
          <p>
            Monitor team workload, resolution progress, and ticket performance.
          </p>
        </div>

        <div className="manager-header-summary">
          <span>Average resolution</span>
          <strong>
            {dashboard.averageResolutionTime > 0
              ? `${dashboard.averageResolutionTime}h`
              : "No data"}
          </strong>
        </div>
      </header>

      <section className="manager-metrics-grid" aria-label="Team metrics">
        <ManagerMetric
          icon="tickets"
          label="Team Tickets"
          value={dashboard.teamTickets}
          description="All support tickets"
          tone="purple"
        />
        <ManagerMetric
          icon="active"
          label="Active"
          value={dashboard.openTickets}
          description={`${dashboard.unassignedTickets} currently unassigned`}
          tone="blue"
        />
        <ManagerMetric
          icon="overdue"
          label="Overdue"
          value={dashboard.overdueTickets}
          description={`${dashboard.criticalTickets} critical tickets`}
          tone="red"
        />
        <ManagerMetric
          icon="resolved"
          label="Resolved"
          value={dashboard.resolvedTickets}
          description="Resolved or closed"
          tone="green"
        />
      </section>

      <section className="manager-overview-grid">
        <article className="manager-panel">
          <div className="manager-panel-heading">
            <div>
              <p>Workflow overview</p>
              <h2>Tickets by Status</h2>
            </div>
            <span>{dashboard.teamTickets} total</span>
          </div>

          {statusData.length > 0 ? (
            <div className="manager-status-list">
              {statusData.map((status, index) => {
                const percentage = statusTotal
                  ? (status.count / statusTotal) * 100
                  : 0;
                const color =
                  statusColors[status.name] ||
                  ["#8c78cb", "#5b8fd6", "#45a775", "#d4a744"][
                    index % 4
                  ];

                return (
                  <div className="manager-status-item" key={status.name}>
                    <div>
                      <span>
                        <i style={{ backgroundColor: color }} />
                        {status.name}
                      </span>
                      <strong>{status.count}</strong>
                    </div>
                    <div className="manager-progress-track">
                      <span
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="manager-empty-state">No ticket data yet.</p>
          )}
        </article>

        <article className="manager-panel manager-health-panel">
          <div className="manager-panel-heading">
            <div>
              <p>Team capacity</p>
              <h2>Workload Health</h2>
            </div>
          </div>

          <div className="manager-health-grid">
            <div>
              <span>Support agents</span>
              <strong>{dashboard.supportAgents}</strong>
            </div>
            <div>
              <span>Unassigned</span>
              <strong>{dashboard.unassignedTickets}</strong>
            </div>
            <div>
              <span>Critical</span>
              <strong>{dashboard.criticalTickets}</strong>
            </div>
            <div>
              <span>Overdue</span>
              <strong>{dashboard.overdueTickets}</strong>
            </div>
          </div>

          <div className="manager-health-message">
            <strong>
              {dashboard.overdueTickets === 0
                ? "Workload is on track"
                : "Some tickets need attention"}
            </strong>
            <p>
              {dashboard.overdueTickets === 0
                ? "There are no active tickets older than three days."
                : `${dashboard.overdueTickets} active ticket${
                    dashboard.overdueTickets === 1 ? " is" : "s are"
                  } older than three days.`}
            </p>
          </div>
        </article>
      </section>

      <section className="manager-panel manager-assignment-panel">
        <div className="manager-panel-heading">
          <div>
            <p>Ticket distribution</p>
            <h2>Unassigned Tickets</h2>
          </div>
          <span>{assignmentOptions.tickets.length} waiting</span>
        </div>

        {assignmentMessage && (
          <p className="manager-assignment-message success">
            {assignmentMessage}
          </p>
        )}

        {assignmentError && (
          <p className="manager-assignment-message error">
            {assignmentError}
          </p>
        )}

        {assignmentLoading ? (
          <p className="manager-empty-state">
            Loading unassigned tickets...
          </p>
        ) : assignmentOptions.tickets.length === 0 ? (
          <p className="manager-empty-state">
            All available tickets are currently assigned.
          </p>
        ) : (
          <div className="manager-table-wrapper">
            <table className="manager-table manager-assignment-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Select Agent</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assignmentOptions.tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <strong>{ticket.ticketNumber}</strong>
                      <span>{ticket.subject}</span>
                    </td>
                    <td>{ticket.category}</td>
                    <td>
                      <span className="manager-ticket-badge priority">
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span className="manager-ticket-badge status">
                        {ticket.status}
                      </span>
                    </td>
                    <td>{formatDate(ticket.createdAt)}</td>
                    <td>
                      <select
                        className="manager-agent-select"
                        value={selectedAgents[ticket.id] || ""}
                        onChange={(event) =>
                          handleAgentChange(ticket.id, event.target.value)
                        }
                        disabled={assigningTicketId === ticket.id}
                      >
                        <option value="">Choose an agent</option>
                        {assignmentOptions.agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.activeTickets} active)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="manager-assign-button"
                        onClick={() => handleAssignTicket(ticket.id)}
                        disabled={
                          assigningTicketId === ticket.id ||
                          !selectedAgents[ticket.id]
                        }
                      >
                        {assigningTicketId === ticket.id
                          ? "Assigning..."
                          : "Assign"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="manager-panel manager-performance-panel">
        <div className="manager-panel-heading">
          <div>
            <p>Support team</p>
            <h2>Agent Performance</h2>
          </div>
          <span>{agents.length} agents</span>
        </div>

        <div className="manager-table-wrapper">
          <table className="manager-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Assigned</th>
                <th>Resolved</th>
                <th>Active</th>
                <th>Average Resolution</th>
                <th>Completion</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {agents.length > 0 ? (
                agents.map((agent) => (
                  <tr key={agent.agent}>
                    <td>
                      <span className="manager-agent-avatar">
                        {agent.agent.charAt(0).toUpperCase()}
                      </span>
                      <strong>{agent.agent}</strong>
                    </td>
                    <td>{agent.assigned}</td>
                    <td>{agent.resolved}</td>
                    <td>{agent.open}</td>
                    <td>
                      {agent.averageResolutionTime > 0
                        ? `${agent.averageResolutionTime} hours`
                        : "-"}
                    </td>
                    <td>
                      <div className="manager-rate-cell">
                        <div className="manager-rate-track">
                          <span
                            style={{
                              width: `${Math.min(agent.resolutionRate, 100)}%`,
                            }}
                          />
                        </div>
                        <strong>{agent.resolutionRate}%</strong>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`manager-performance-badge ${
                          agent.resolutionRate >= 75
                            ? "excellent"
                            : agent.resolutionRate >= 50
                              ? "good"
                              : "attention"
                        }`}
                      >
                        {performanceLabel(agent.resolutionRate)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="manager-empty-table" colSpan="7">
                    No support-agent performance data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="manager-panel manager-recent-panel">
        <div className="manager-panel-heading">
          <div>
            <p>Latest requests</p>
            <h2>Recent Team Tickets</h2>
          </div>
        </div>

        <div className="manager-table-wrapper">
          <table className="manager-table manager-recent-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Employee</th>
                <th>Assigned To</th>
                <th>Category</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.length > 0 ? (
                recentTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <strong>{ticket.ticketNumber}</strong>
                      <span>{ticket.subject}</span>
                    </td>
                    <td>{ticket.employee}</td>
                    <td>{ticket.assignedTo}</td>
                    <td>{ticket.category}</td>
                    <td>
                      <span className="manager-ticket-badge status">
                        {ticket.status}
                      </span>
                    </td>
                    <td>
                      <span className="manager-ticket-badge priority">
                        {ticket.priority}
                      </span>
                    </td>
                    <td>{formatDate(ticket.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="manager-empty-table" colSpan="7">
                    No recent tickets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default ManagerDashboard;
