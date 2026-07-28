import DashboardLayout from "../../components/DashboardLayout";
import StatCard from "../../components/StatCard";
import { useEffect, useState } from "react";
import { getAgentDashboard } from "../../api/dashboard";

function AgentDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const data = await getAgentDashboard();
      setDashboard(data);
    } catch (error) {
      console.error("Agent dashboard error:", error);
      setError(error.message);
    }
  }

  if (error) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="dashboard-error">
          <h2>Could not load dashboard</h2>
          <p>{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboard) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="dashboard-loading">
          Loading dashboard...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activePage="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="dashboard-welcome-label">
            Support Agent Dashboard
          </p>

          <h1>Welcome back, Support Agent 👋</h1>

          <p className="dashboard-subtitle">
            Review assigned tickets and resolve employee issues.
          </p>
        </div>

        <button className="new-ticket-button">
          + New Ticket
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          dotClass="purple"
          title="Assigned to Me"
          value="8"
          description="Active assigned tickets"
        />

        <StatCard
          dotClass="yellow"
          title="Unassigned"
          value="5"
          description="Waiting for an agent"
        />

        <StatCard
          dotClass="red"
          title="Critical"
          value="2"
          description="Needs immediate action"
        />

        <StatCard
          dotClass="green"
          title="Resolved Today"
          value="6"
          description="Completed today"
        />
      </div>

      <section className="dashboard-table-section">
        <div className="section-heading">
          <div>
            <h2>Assigned Tickets</h2>

            <p>
              Tickets currently assigned to your account
            </p>
          </div>

          <button className="view-all-button">
            View All Tickets
          </button>
        </div>

        <div className="tickets-panel">
          <div className="ticket-filters">
            <div className="table-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search tickets..."
              />
            </div>

            <select defaultValue="">
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select defaultValue="">
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="progress">In Progress</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Employee</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td className="ticket-number">#1042</td>

                  <td>
                    <div className="employee-cell">
                      <span className="employee-avatar">NA</span>

                      <span>Nour Asfour</span>
                    </div>
                  </td>

                  <td>Laptop not booting</td>

                  <td>
                    <span className="priority-badge priority-critical">
                      Critical
                    </span>
                  </td>

                  <td>
                    <span className="status-badge status-progress">
                      In Progress
                    </span>
                  </td>

                  <td>Today</td>

                  <td>
                    <button className="ticket-action-button">
                      View
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="ticket-number">#1043</td>

                  <td>
                    <div className="employee-cell">
                      <span className="employee-avatar">SK</span>

                      <span>Sarah Khalil</span>
                    </div>
                  </td>

                  <td>Email not syncing</td>

                  <td>
                    <span className="priority-badge priority-medium">
                      Medium
                    </span>
                  </td>

                  <td>
                    <span className="status-badge status-open">
                      Open
                    </span>
                  </td>

                  <td>Today</td>

                  <td>
                    <button className="ticket-action-button">
                      View
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="ticket-number">#1044</td>

                  <td>
                    <div className="employee-cell">
                      <span className="employee-avatar">OS</span>

                      <span>Omar Saleh</span>
                    </div>
                  </td>

                  <td>VPN connection issue</td>

                  <td>
                    <span className="priority-badge priority-high">
                      High
                    </span>
                  </td>

                  <td>
                    <span className="status-badge status-pending">
                      Pending
                    </span>
                  </td>

                  <td>Yesterday</td>

                  <td>
                    <button className="ticket-action-button">
                      View
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default AgentDashboard;