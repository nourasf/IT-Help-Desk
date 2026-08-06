import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getAdminDashboard } from "../../api/dashboard";
import "../../styles/AdminDashboard.css";

const roleColors = ["#6f4bd8", "#9877ea", "#89a6f7", "#f4a5b5"];

function AdminIcon({ name }) {
  const icons = {
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5" /><path d="M17 14a5 5 0 0 1 3.5 5" /></>,
    tickets: <><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 9h8M8 13h5" /></>,
    resolved: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    activity: <path d="M3 12h4l2-6 4 12 2-6h6" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  };

  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function MetricCard({ icon, label, value, detail, tone }) {
  return (
    <article className={`admin-metric-card ${tone}`}>
      <span className="admin-metric-icon"><AdminIcon name={icon} /></span>
      <div className="admin-metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function formatActivityDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setError("");
    try {
      setDashboard(await getAdminDashboard());
    } catch (requestError) {
      setError(requestError.message || "The dashboard could not be loaded.");
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  const roleChart = useMemo(() => {
    const roles = dashboard?.usersByRole || [];
    const total = roles.reduce((sum, role) => sum + Number(role.count || 0), 0) || 1;
    let cursor = 0;
    const stops = roles.map((role, index) => {
      const start = cursor;
      cursor += (Number(role.count || 0) / total) * 100;
      return `${roleColors[index % roleColors.length]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${stops.length ? stops.join(", ") : "#ece7f7 0 100%"})`;
  }, [dashboard]);

  if (error) {
    return <DashboardLayout activePage="dashboard"><div className="admin-dashboard-state"><h1>Dashboard unavailable</h1><p>{error}</p><button type="button" onClick={loadDashboard}>Try Again</button></div></DashboardLayout>;
  }

  if (!dashboard) {
    return <DashboardLayout activePage="dashboard"><div className="admin-dashboard-state">Loading dashboard...</div></DashboardLayout>;
  }

  const roles = dashboard.usersByRole || [];
  const activity = dashboard.recentActivity || [];

  return (
    <DashboardLayout activePage="dashboard">
      <main className="admin-product-dashboard">
        <header className="admin-dashboard-header">
          <div>
            <p className="admin-eyebrow">Administration workspace</p>
            <h1>Good morning, Admin <span aria-hidden="true">👋</span></h1>
            <p>Here&apos;s what&apos;s happening across your help desk today.</p>
          </div>
          <Link className="admin-create-user-button" to="/admin/users/create"><span>+</span>Create New User</Link>
        </header>

        <section className="admin-metrics-grid" aria-label="System metrics">
          <MetricCard icon="users" label="Total Users" value={dashboard.totalUsers} detail={`${dashboard.supportAgents} support agents`} tone="purple" />
          <MetricCard icon="tickets" label="Open Tickets" value={dashboard.activeTickets} detail={`${dashboard.unassignedTickets} unassigned`} tone="red" />
          <MetricCard icon="resolved" label="Resolved Tickets" value={dashboard.resolvedTickets} detail={`${dashboard.totalTickets} total tickets`} tone="green" />
          <MetricCard icon="clock" label="Critical Tickets" value={dashboard.criticalTickets} detail="Needs attention" tone="blue" />
        </section>

        <section className="admin-command-grid">
          <article className="admin-panel admin-activity-feed">
            <div className="admin-panel-heading"><div><p>Live updates</p><h2>Recent Activity</h2></div><span>{activity.length}</span></div>
            <div className="admin-feed-list">
              {activity.length ? activity.slice(0, 6).map((item, index) => (
                <div className="admin-feed-item" key={`${item.target}-${index}`}>
                  <span className={`admin-feed-icon tone-${index % 4}`}><AdminIcon name={index % 2 ? "tickets" : "activity"} /></span>
                  <div><strong>{item.subject || item.target}</strong><small>{item.user} · {item.role}</small></div>
                  <time>{formatActivityDate(item.date)}</time>
                </div>
              )) : <p className="admin-empty-state">No recent activity yet.</p>}
            </div>
          </article>

          <article className="admin-panel admin-role-overview">
            <div className="admin-panel-heading"><div><p>People</p><h2>User Roles Overview</h2></div></div>
            <div className="admin-role-chart-wrap">
              <div className="admin-role-donut" style={{ background: roleChart }}><div><strong>{dashboard.totalUsers}</strong><span>Total Users</span></div></div>
              <div className="admin-role-legend">
                {roles.map((role, index) => <div key={role.name}><span><i style={{ background: roleColors[index % roleColors.length] }} />{role.name}</span><strong>{role.count}</strong></div>)}
              </div>
            </div>
          </article>

          <article className="admin-panel admin-system-snapshot">
            <div className="admin-panel-heading"><div><p>Operations</p><h2>System Snapshot</h2></div><span className="admin-health-pill">Live</span></div>
            <div className="admin-system-list">
              <div><span><AdminIcon name="users" />Support Agents</span><strong>{dashboard.supportAgents}</strong></div>
              <div><span><AdminIcon name="tickets" />Unassigned Tickets</span><strong>{dashboard.unassignedTickets}</strong></div>
              <div><span><AdminIcon name="activity" />Active Tickets</span><strong>{dashboard.activeTickets}</strong></div>
              <div><span><AdminIcon name="resolved" />Resolved Tickets</span><strong>{dashboard.resolvedTickets}</strong></div>
            </div>
          </article>
        </section>

        <section className="admin-bottom-grid">
          <article className="admin-panel admin-recent-tickets">
            <div className="admin-panel-heading"><div><p>Latest requests</p><h2>Recent Tickets</h2></div><span>{activity.length} items</span></div>
            <div className="admin-table-wrapper">
              <table className="admin-activity-table">
                <thead><tr><th>Ticket</th><th>Requester</th><th>Status</th><th>Priority</th><th>Updated</th></tr></thead>
                <tbody>{activity.length ? activity.slice(0, 7).map((item, index) => <tr key={`${item.target}-${index}`}><td><strong>{item.target}</strong><span>{item.subject}</span></td><td><strong>{item.user}</strong><span>{item.role}</span></td><td><span className="admin-table-badge status">{item.status}</span></td><td><span className="admin-table-badge priority">{item.priority}</span></td><td>{formatActivityDate(item.date)}</td></tr>) : <tr><td className="admin-empty-table" colSpan="5">No recent tickets yet.</td></tr>}</tbody>
              </table>
            </div>
          </article>

          <aside className="admin-panel admin-quick-actions">
            <div className="admin-panel-heading"><div><p>Shortcuts</p><h2>Quick Actions</h2></div></div>
            <div className="admin-action-grid">
              <Link to="/admin/users/create"><span>+</span><strong>Create User</strong><small>Add a new account</small></Link>
              <button type="button" disabled><span>↗</span><strong>Assign Tickets</strong><small>Manager workflow</small></button>
              <button type="button" disabled><span>▥</span><strong>View Reports</strong><small>Analytics coming soon</small></button>
              <button type="button" disabled><span>⚙</span><strong>System Settings</strong><small>Configuration</small></button>
            </div>
          </aside>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default AdminDashboard;
