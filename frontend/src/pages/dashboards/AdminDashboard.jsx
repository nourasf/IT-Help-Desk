import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardLayout from "../../components/DashboardLayout";
import AdminActionsModal from "../../components/AdminActionsModal";
import { getAdminDashboard, getAdminResolvedAnalytics } from "../../api/dashboard";
import "../../styles/AdminDashboard.css";

const roleColors = ["#6f4bd8", "#9877ea", "#89a6f7", "#f4a5b5"];

function AdminIcon({ name }) {
  const icons = {
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5" /><path d="M17 14a5 5 0 0 1 3.5 5" /></>,
    tickets: <><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 9h8M8 13h5" /></>,
    resolved: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    activity: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function MetricCard({ icon, label, value, detail, tone }) {
  return <article className={`admin-metric-card ${tone}`}><span className="admin-metric-icon"><AdminIcon name={icon} /></span><div className="admin-metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function formatActivityDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ResolutionChart({ analytics }) {
  const points = (analytics?.points || []).map((point) => ({ ...point, count: Number(point.count || 0) }));
  return (
    <article className="admin-panel" style={{ marginBottom: 22 }}>
      <div className="admin-panel-heading"><div><p>Last 30 days</p><h2>Resolved Ticket Analytics</h2></div><span>{analytics?.total || 0} resolved</span></div>
      <div style={{ width: "100%", height: 230, paddingTop: 14 }} aria-label="Tickets resolved in the last 30 days">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
            <defs><linearGradient id="resolvedTicketFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8d6bd5" stopOpacity={0.34} /><stop offset="95%" stopColor="#8d6bd5" stopOpacity={0.03} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee9f4" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} tick={{ fill: "#938aa0", fontSize: 10 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#938aa0", fontSize: 10 }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5deed", boxShadow: "0 10px 28px rgba(62,44,102,.10)", fontSize: 12 }} formatter={(value) => [`${value} ticket${Number(value) === 1 ? "" : "s"}`, "Resolved"]} />
            <Area type="monotone" dataKey="count" stroke="#7d5bc5" strokeWidth={3} fill="url(#resolvedTicketFill)" activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function AdminDashboard() {
  const [actionsOpen, setActionsOpen] = useState(false);

  const dashboardQuery = useQuery({ queryKey: ["dashboard", "admin"], queryFn: getAdminDashboard });
  const analyticsQuery = useQuery({ queryKey: ["dashboard", "admin", "resolved-analytics"], queryFn: getAdminResolvedAnalytics });

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const isLoading = dashboardQuery.isLoading || analyticsQuery.isLoading;
  const error = dashboardQuery.error || analyticsQuery.error;

  const roleChart = useMemo(() => {
    const roles = dashboard?.usersByRole || [];
    const total = roles.reduce((sum, role) => sum + Number(role.count || 0), 0) || 1;
    let cursor = 0;
    const stops = roles.map((role, index) => { const start = cursor; cursor += (Number(role.count || 0) / total) * 100; return `${roleColors[index % roleColors.length]} ${start}% ${cursor}%`; });
    return `conic-gradient(${stops.length ? stops.join(", ") : "#ece7f7 0 100%"})`;
  }, [dashboard]);

  if (error) return <DashboardLayout activePage="dashboard"><div className="admin-dashboard-state"><h1>Dashboard unavailable</h1><p>{error.message || "The dashboard could not be loaded."}</p><button type="button" onClick={() => { dashboardQuery.refetch(); analyticsQuery.refetch(); }}>Try Again</button></div></DashboardLayout>;
  if (isLoading || !dashboard) return <DashboardLayout activePage="dashboard"><div className="admin-dashboard-state">Loading dashboard...</div></DashboardLayout>;

  const roles = dashboard.usersByRole || [];
  const activity = dashboard.recentActivity || [];

  return (
    <DashboardLayout activePage="dashboard">
      <main className="admin-product-dashboard">
        <header className="admin-dashboard-header"><div><p className="admin-eyebrow">Administration workspace</p><h1>Admin Control Center</h1><p>Monitor users, tickets, analytics and system activity.</p></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link className="admin-create-user-button" to="/admin/tickets">View All Tickets</Link><Link className="admin-create-user-button" to="/admin/users/create"><span>+</span>Create New User</Link></div></header>
        <section className="admin-metrics-grid" aria-label="System metrics"><MetricCard icon="users" label="Total Users" value={dashboard.totalUsers} detail={`${dashboard.supportAgents} support agents`} tone="purple" /><MetricCard icon="tickets" label="Open Tickets" value={dashboard.activeTickets} detail={`${dashboard.unassignedTickets} unassigned`} tone="red" /><MetricCard icon="resolved" label="Resolved Tickets" value={dashboard.resolvedTickets} detail={`${dashboard.totalTickets} total tickets`} tone="green" /><MetricCard icon="clock" label="Critical Tickets" value={dashboard.criticalTickets} detail="Needs attention" tone="blue" /></section>
        <ResolutionChart analytics={analytics} />
        <section className="admin-command-grid"><article className="admin-panel admin-activity-feed"><div className="admin-panel-heading"><div><p>Live updates</p><h2>Recent Activity</h2></div><span>{activity.length}</span></div><div className="admin-feed-list">{activity.length ? activity.slice(0, 6).map((item, index) => <div className="admin-feed-item" key={`${item.target}-${index}`}><span className={`admin-feed-icon tone-${index % 4}`}><AdminIcon name={index % 2 ? "tickets" : "activity"} /></span><div><strong>{item.subject || item.target}</strong><small>{item.user} · {item.role}</small></div><time>{formatActivityDate(item.date)}</time></div>) : <p className="admin-empty-state">No recent activity yet.</p>}</div></article><article className="admin-panel admin-role-overview"><div className="admin-panel-heading"><div><p>People</p><h2>User Roles Overview</h2></div></div><div className="admin-role-chart-wrap"><div className="admin-role-donut" style={{ background: roleChart }}><div><strong>{dashboard.totalUsers}</strong><span>Total Users</span></div></div><div className="admin-role-legend">{roles.map((role, index) => <div key={role.name}><span><i style={{ background: roleColors[index % roleColors.length] }} />{role.name}</span><strong>{role.count}</strong></div>)}</div></div></article><article className="admin-panel admin-system-snapshot"><div className="admin-panel-heading"><div><p>Operations</p><h2>System Snapshot</h2></div><span className="admin-health-pill">Live</span></div><div className="admin-system-list"><div><span><AdminIcon name="users" />Support Agents</span><strong>{dashboard.supportAgents}</strong></div><div><span><AdminIcon name="tickets" />Unassigned Tickets</span><strong>{dashboard.unassignedTickets}</strong></div><div><span><AdminIcon name="activity" />Active Tickets</span><strong>{dashboard.activeTickets}</strong></div><div><span><AdminIcon name="resolved" />Resolved Tickets</span><strong>{dashboard.resolvedTickets}</strong></div></div></article></section>
        <section className="admin-bottom-grid"><article className="admin-panel admin-recent-tickets"><div className="admin-panel-heading"><div><p>Latest requests</p><h2>Recent Tickets</h2></div><Link to="/admin/tickets">See all</Link></div><div className="admin-table-wrapper"><table className="admin-activity-table"><thead><tr><th>Ticket</th><th>Requester</th><th>Status</th><th>Priority</th><th>Updated</th></tr></thead><tbody>{activity.length ? activity.slice(0, 7).map((item, index) => <tr key={`${item.target}-${index}`}><td><strong>{item.target}</strong><span>{item.subject}</span></td><td><strong>{item.user}</strong><span>{item.role}</span></td><td><span className="admin-table-badge status">{item.status}</span></td><td><span className="admin-table-badge priority">{item.priority}</span></td><td>{formatActivityDate(item.date)}</td></tr>) : <tr><td className="admin-empty-table" colSpan="5">No recent tickets yet.</td></tr>}</tbody></table></div></article><aside className="admin-panel admin-quick-actions"><div className="admin-panel-heading"><div><p>Shortcuts</p><h2>Quick Actions</h2></div></div><div className="admin-actions-launch"><div className="admin-actions-launch-copy"><span>Action center</span><strong>Manage the help desk</strong><small>Open one clean action menu instead of showing every shortcut at once.</small></div><button type="button" className="admin-actions-open-button" onClick={() => setActionsOpen(true)}>Open Actions</button></div></aside></section>
      </main>
      <AdminActionsModal open={actionsOpen} onClose={() => setActionsOpen(false)} />
    </DashboardLayout>
  );
}

export default AdminDashboard;
