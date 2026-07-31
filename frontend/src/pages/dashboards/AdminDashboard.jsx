import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getAdminDashboard } from "../../api/dashboard";
import "../../styles/AdminDashboard.css";

const chartColors = {
  Open: "#8d79ce",
  "In Progress": "#5d8fd8",
  Pending: "#d3a83f",
  Resolved: "#44a876",
  Closed: "#7f8799",
  Low: "#6fa9d8",
  Medium: "#d3a83f",
  High: "#db7b58",
  Critical: "#cc5664",
};

function AdminIcon({ name }) {
  const icons = {
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.5a3 3 0 0 1 0 5.5" />
        <path d="M17 14a5 5 0 0 1 3.5 5" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </>
    ),
    resolved: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16.5 9" />
      </>
    ),
    critical: (
      <>
        <path d="M12 4 3.5 19h17z" />
        <path d="M12 9v4" />
        <path d="M12 16h.01" />
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

function MetricCard({ icon, label, value, description, tone }) {
  return (
    <article className={`admin-metric-card ${tone}`}>
      <div className="admin-metric-icon">
        <AdminIcon name={icon} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{description}</span>
      </div>
    </article>
  );
}

function DistributionList({ items, emptyMessage }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (items.length === 0) {
    return <p className="admin-empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="admin-distribution-list">
      {items.map((item, index) => {
        const percentage = total === 0 ? 0 : (item.count / total) * 100;
        const color = chartColors[item.name] || [
          "#8d79ce",
          "#5d8fd8",
          "#44a876",
          "#d3a83f",
          "#db7b58",
          "#7f8799",
        ][index % 6];

        return (
          <div className="admin-distribution-item" key={item.name}>
            <div className="admin-distribution-label">
              <span>
                <i style={{ backgroundColor: color }} />
                {item.name}
              </span>
              <strong>{item.count}</strong>
            </div>
            <div className="admin-progress-track">
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
  );
}

function formatActivityDate(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setError("");

    try {
      const data = await getAdminDashboard();
      setDashboard(data);
    } catch (requestError) {
      setError(requestError.message || "The dashboard could not be loaded.");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (error) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="admin-dashboard-state">
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
        <div className="admin-dashboard-state">Loading dashboard...</div>
      </DashboardLayout>
    );
  }

  const statusData = dashboard.ticketsByStatus || [];
  const priorityData = dashboard.ticketsByPriority || [];
  const categoryData = dashboard.ticketsByCategory || [];
  const userRoleData = dashboard.usersByRole || [];
  const recentActivity = dashboard.recentActivity || [];

  return (
    <DashboardLayout activePage="dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-eyebrow">System overview</p>
          <h1>Admin Control Center</h1>
          <p>Monitor support activity and manage the help desk from one place.</p>
        </div>

        <Link className="admin-create-user-button" to="/admin/users/create">
          <span aria-hidden="true">+</span>
          Create User
        </Link>
      </header>

      <section className="admin-metrics-grid" aria-label="System metrics">
        <MetricCard
          icon="users"
          label="Total Users"
          value={dashboard.totalUsers}
          description={`${dashboard.supportAgents} support agents`}
          tone="purple"
        />
        <MetricCard
          icon="activity"
          label="Active Tickets"
          value={dashboard.activeTickets}
          description={`${dashboard.unassignedTickets} currently unassigned`}
          tone="blue"
        />
        <MetricCard
          icon="resolved"
          label="Resolved"
          value={dashboard.resolvedTickets}
          description={`${dashboard.totalTickets} tickets overall`}
          tone="green"
        />
        <MetricCard
          icon="critical"
          label="Critical"
          value={dashboard.criticalTickets}
          description="Active critical tickets"
          tone="red"
        />
      </section>

      <section className="admin-analytics-grid">
        <article className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p>Ticket workflow</p>
              <h2>Tickets by Status</h2>
            </div>
            <span>{dashboard.totalTickets} total</span>
          </div>
          <DistributionList
            items={statusData}
            emptyMessage="No ticket status data yet."
          />
        </article>

        <article className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p>Urgency overview</p>
              <h2>Tickets by Priority</h2>
            </div>
          </div>
          <DistributionList
            items={priorityData}
            emptyMessage="No ticket priority data yet."
          />
        </article>

        <article className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p>Request patterns</p>
              <h2>Top Categories</h2>
            </div>
          </div>
          <DistributionList
            items={categoryData.slice(0, 5)}
            emptyMessage="No category data yet."
          />
        </article>

        <article className="admin-panel admin-team-panel">
          <div className="admin-panel-heading">
            <div>
              <p>Access overview</p>
              <h2>Users by Role</h2>
            </div>
          </div>

          <div className="admin-role-grid">
            {userRoleData.length > 0 ? (
              userRoleData.map((role) => (
                <div className="admin-role-card" key={role.name}>
                  <span>{role.name}</span>
                  <strong>{role.count}</strong>
                </div>
              ))
            ) : (
              <p className="admin-empty-state">No user role data yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="admin-lower-grid">
        <article className="admin-panel admin-activity-panel">
          <div className="admin-panel-heading">
            <div>
              <p>Audit snapshot</p>
              <h2>Recent System Activity</h2>
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-activity-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <tr key={activity.target}>
                      <td>
                        <strong>{activity.target}</strong>
                        <span>{activity.subject}</span>
                      </td>
                      <td>
                        <strong>{activity.user}</strong>
                        <span>{activity.role}</span>
                      </td>
                      <td>
                        <span className="admin-table-badge status">
                          {activity.status}
                        </span>
                      </td>
                      <td>
                        <span className="admin-table-badge priority">
                          {activity.priority}
                        </span>
                      </td>
                      <td>{formatActivityDate(activity.date)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="admin-empty-table" colSpan="5">
                      No recent activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="admin-panel admin-tools-panel">
          <div className="admin-panel-heading">
            <div>
              <p>Administration</p>
              <h2>Management Tools</h2>
            </div>
          </div>

          <Link className="admin-tool-row ready" to="/admin/users/create">
            <span className="admin-tool-mark">+</span>
            <span>
              <strong>Create User</strong>
              <small>Add accounts and assign roles</small>
            </span>
            <b>Open</b>
          </Link>

          <div className="admin-tool-row">
            <span className="admin-tool-mark">R</span>
            <span>
              <strong>Role Management</strong>
              <small>Manage system permissions</small>
            </span>
            <b>Coming soon</b>
          </div>

          <div className="admin-tool-row">
            <span className="admin-tool-mark">C</span>
            <span>
              <strong>Ticket Categories</strong>
              <small>Configure support categories</small>
            </span>
            <b>Coming soon</b>
          </div>

          <div className="admin-tool-row">
            <span className="admin-tool-mark">P</span>
            <span>
              <strong>Reports</strong>
              <small>Export system analytics</small>
            </span>
            <b>Coming soon</b>
          </div>
        </aside>
      </section>
    </DashboardLayout>
  );
}

export default AdminDashboard;
