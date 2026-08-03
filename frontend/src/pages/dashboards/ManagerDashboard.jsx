import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { getManagerDashboard } from "../../api/dashboard";
import { assignTicket, getAssignmentOptions } from "../../api/ticket";
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

function getAgentWorkload(activeTicketsValue) {
  const activeTickets = Number(activeTicketsValue) || 0;

  if (activeTickets <= 2) {
    return { label: "Available", tone: "available" };
  }

  if (activeTickets <= 4) {
    return { label: "Moderate workload", tone: "moderate" };
  }

  return { label: "Busy", tone: "busy" };
}

function formatDate(value) {
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTicketAge(value) {
  const createdDate = new Date(value);
  const today = new Date();
  const difference = today.getTime() - createdDate.getTime();
  const daysWaiting = Math.max(
    0,
    Math.floor(difference / (1000 * 60 * 60 * 24)),
  );

  if (daysWaiting === 0) return "Created today";
  if (daysWaiting === 1) return "Waiting 1 day";
  return `Waiting ${daysWaiting} days`;
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
  async function loadAssignmentOptions() {
    setAssignmentLoading(true);
    setAssignmentError("");

    try {
      const data = await getAssignmentOptions();
      setAssignmentOptions(data);
    } catch (requestError) {
      setAssignmentError(
        requestError.message || "The assignment options could not be loaded.",
      );
    } finally {
      setAssignmentLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    loadAssignmentOptions();
  }, []);

  function handleAgentChange(ticketId, agentUserId) {
    setSelectedAgents((currentSelections) => ({
      ...currentSelections,
      [ticketId]: agentUserId,
    }));

    setAssignmentError("");
    setAssignmentMessage("");
  }

  async function handleAssignTicket(ticketId, recommendedAgentId = null) {
    const agentUserId = recommendedAgentId || selectedAgents[ticketId];

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
        result.message || "The ticket was assigned successfully.",
      );

      setSelectedAgents((currentSelections) => {
        const updatedSelections = { ...currentSelections };
        delete updatedSelections[ticketId];
        return updatedSelections;
      });

      await Promise.all([loadDashboard(), loadAssignmentOptions()]);
    } catch (requestError) {
      setAssignmentError(
        requestError.message || "The ticket could not be assigned.",
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
  const assignmentAgents = [...(assignmentOptions.agents || [])].sort(
    (firstAgent, secondAgent) =>
      Number(firstAgent.activeTickets) - Number(secondAgent.activeTickets) ||
      firstAgent.name.localeCompare(secondAgent.name),
  );
  const recommendedAgent = assignmentAgents[0] || null;
  const statusTotal = statusData.reduce(
    (total, status) => total + status.count,
    0,
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

      <section className="manager-panel manager-assignment-panel">
        <div className="manager-panel-heading">
          <div>
            <p>Needs your attention</p>
            <h2>Tickets Waiting for an Agent</h2>
            <p className="manager-panel-description">
              Review each request and assign it to an agent with enough
              capacity.
            </p>
          </div>
          <span>{assignmentOptions.tickets.length} waiting</span>
        </div>

        {assignmentMessage && (
          <p className="manager-assignment-message success">
            {assignmentMessage}
          </p>
        )}

        {assignmentError && (
          <p className="manager-assignment-message error">{assignmentError}</p>
        )}

        {assignmentLoading ? (
          <p className="manager-empty-state">Loading unassigned tickets...</p>
        ) : assignmentOptions.tickets.length === 0 ? (
          <div className="manager-clear-state">
            <strong>Everything is assigned</strong>
            <p>There are no tickets waiting for an agent right now.</p>
          </div>
        ) : (
          <div className="manager-assignment-list">
            {assignmentOptions.tickets.map((ticket) => {
              const selectedAgent = assignmentAgents.find(
                (agent) =>
                  String(agent.id) === String(selectedAgents[ticket.id]),
              );
              const selectedWorkload = selectedAgent
                ? getAgentWorkload(selectedAgent.activeTickets)
                : null;
              const recommendedWorkload = recommendedAgent
                ? getAgentWorkload(recommendedAgent.activeTickets)
                : null;

              return (
                <article className="manager-assignment-card" key={ticket.id}>
                  <div className="manager-ticket-summary">
                    <div className="manager-ticket-title-row">
                      <span className="manager-ticket-number">
                        {ticket.ticketNumber}
                      </span>
                      <div className="manager-ticket-badges">
                        <span className="manager-ticket-badge priority">
                          {ticket.priority}
                        </span>
                        <span className="manager-ticket-badge status">
                          {ticket.status}
                        </span>
                      </div>
                    </div>

                    <h3>{ticket.subject}</h3>

                    <div className="manager-ticket-meta">
                      <div>
                        <span>Category</span>
                        <strong>{ticket.category}</strong>
                      </div>
                      <div>
                        <span>Created</span>
                        <strong>{formatDate(ticket.createdAt)}</strong>
                      </div>
                      <div>
                        <span>Queue time</span>
                        <strong>{formatTicketAge(ticket.createdAt)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="manager-assignment-action">
                    {recommendedAgent ? (
                      <div className="manager-recommended-agent">
                        <div>
                          <span>Recommended · lightest workload</span>
                          <strong>{recommendedAgent.name}</strong>
                          <small>
                            {recommendedAgent.activeTickets} active ticket
                            {Number(recommendedAgent.activeTickets) === 1
                              ? ""
                              : "s"}
                            {" · "}
                            {recommendedWorkload.label}
                          </small>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleAssignTicket(ticket.id, recommendedAgent.id)
                          }
                          disabled={assigningTicketId === ticket.id}
                        >
                          {assigningTicketId === ticket.id
                            ? "Assigning..."
                            : `Assign ${recommendedAgent.name}`}
                        </button>
                      </div>
                    ) : (
                      <div className="manager-no-agent-note">
                        No support agents are available for assignment.
                      </div>
                    )}

                    <div className="manager-choice-divider">
                      <span>or choose manually</span>
                    </div>

                    <label htmlFor={`agent-${ticket.id}`}>
                      Choose another agent
                    </label>
                    <p>
                      Agents are ordered from the lightest to heaviest workload.
                    </p>
                    <select
                      id={`agent-${ticket.id}`}
                      className="manager-agent-select"
                      value={selectedAgents[ticket.id] || ""}
                      onChange={(event) =>
                        handleAgentChange(ticket.id, event.target.value)
                      }
                      disabled={
                        assigningTicketId === ticket.id ||
                        assignmentAgents.length === 0
                      }
                    >
                      <option value="">Select an agent</option>
                      {assignmentAgents.map((agent, index) => {
                        const workload = getAgentWorkload(agent.activeTickets);

                        return (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} — {agent.activeTickets} active —{" "}
                            {workload.label}
                            {index === 0 ? " (Recommended)" : ""}
                          </option>
                        );
                      })}
                    </select>

                    {selectedAgent && selectedWorkload && (
                      <div
                        className={`manager-workload-notice ${selectedWorkload.tone}`}
                      >
                        <strong>
                          {selectedAgent.name}: {selectedWorkload.label}
                        </strong>
                        <span>
                          {selectedWorkload.tone === "busy"
                            ? `This agent already has ${selectedAgent.activeTickets} active tickets. You can still assign this ticket if needed.`
                            : `${selectedAgent.activeTickets} active ticket${
                                Number(selectedAgent.activeTickets) === 1
                                  ? ""
                                  : "s"
                              } right now.`}
                        </span>
                      </div>
                    )}

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
                        ? "Assigning ticket..."
                        : selectedAgent
                          ? `Assign to ${selectedAgent.name}`
                          : "Select an agent to continue"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="manager-overview-grid">
        <article className="manager-panel">
          <div className="manager-panel-heading">
            <div>
              <p>Workflow overview</p>
              <h2>Where Tickets Stand</h2>
              <p className="manager-panel-description">
                A quick view of the team&apos;s current ticket pipeline.
              </p>
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
                  ["#8c78cb", "#5b8fd6", "#45a775", "#d4a744"][index % 4];

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
              <p className="manager-panel-description">
                Numbers that may require a manager&apos;s attention.
              </p>
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

      <section className="manager-panel manager-performance-panel">
        <div className="manager-panel-heading">
          <div>
            <p>Team workload</p>
            <h2>Agent Capacity and Performance</h2>
            <p className="manager-panel-description">
              Compare active workload and completion before assigning more work.
            </p>
          </div>
          <span>
            {agents.length} agent{agents.length === 1 ? "" : "s"}
          </span>
        </div>

        {agents.length > 0 ? (
          <div className="manager-agent-grid">
            {agents.map((agent) => {
              const resolutionRate = Number(agent.resolutionRate) || 0;

              return (
                <article className="manager-agent-card" key={agent.agent}>
                  <div className="manager-agent-card-header">
                    <div className="manager-agent-identity">
                      <span className="manager-agent-avatar">
                        {agent.agent.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <strong>{agent.agent}</strong>
                        <span>{agent.open} active tickets</span>
                      </div>
                    </div>
                    <span
                      className={`manager-performance-badge ${
                        resolutionRate >= 75
                          ? "excellent"
                          : resolutionRate >= 50
                            ? "good"
                            : "attention"
                      }`}
                    >
                      {performanceLabel(resolutionRate)}
                    </span>
                  </div>

                  <div className="manager-agent-stats">
                    <div>
                      <span>Active now</span>
                      <strong>{agent.open}</strong>
                    </div>
                    <div>
                      <span>Resolved</span>
                      <strong>{agent.resolved}</strong>
                    </div>
                    <div>
                      <span>Total assigned</span>
                      <strong>{agent.assigned}</strong>
                    </div>
                  </div>

                  <div className="manager-agent-progress">
                    <div>
                      <span>Completion rate</span>
                      <strong>{resolutionRate}%</strong>
                    </div>
                    <div className="manager-rate-track">
                      <span
                        style={{ width: `${Math.min(resolutionRate, 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className="manager-agent-resolution">
                    Average resolution:{" "}
                    <strong>
                      {agent.averageResolutionTime > 0
                        ? `${agent.averageResolutionTime} hours`
                        : "No completed tickets yet"}
                    </strong>
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="manager-empty-state">
            No support-agent performance data yet.
          </p>
        )}
      </section>

      <section className="manager-panel manager-recent-panel">
        <div className="manager-panel-heading">
          <div>
            <p>Latest requests</p>
            <h2>Recent Team Tickets</h2>
            <p className="manager-panel-description">
              The newest requests and who currently owns them.
            </p>
          </div>
        </div>

        {recentTickets.length > 0 ? (
          <div className="manager-recent-list">
            {recentTickets.map((ticket) => (
              <article className="manager-recent-item" key={ticket.id}>
                <div className="manager-recent-ticket">
                  <span>{ticket.ticketNumber}</span>
                  <strong>{ticket.subject}</strong>
                  <small>Requested by {ticket.employee}</small>
                </div>

                <div className="manager-recent-detail">
                  <span>Current owner</span>
                  <strong
                    className={
                      ticket.assignedTo === "Unassigned" ? "unassigned" : ""
                    }
                  >
                    {ticket.assignedTo}
                  </strong>
                </div>

                <div className="manager-recent-detail">
                  <span>Ticket details</span>
                  <div className="manager-recent-badges">
                    <span className="manager-ticket-badge status">
                      {ticket.status}
                    </span>
                    <span className="manager-ticket-badge priority">
                      {ticket.priority}
                    </span>
                    <small>{ticket.category}</small>
                  </div>
                </div>

                <div className="manager-recent-date">
                  <span>Created</span>
                  <strong>{formatDate(ticket.createdAt)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="manager-empty-state">No recent tickets yet.</p>
        )}
      </section>
    </DashboardLayout>
  );
}
export default ManagerDashboard;