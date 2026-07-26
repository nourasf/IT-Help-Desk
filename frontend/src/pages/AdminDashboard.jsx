import DashboardLayout from "../components/DashboardLayout";
import StatCard from "../components/StatCard";
import { useEffect, useState } from "react";
import { getAdminDashboard } from "../api/dashboard";
function AdminDashboard() {
    const [dashboard, setDashboard] = useState(null);

useEffect(() => {
    loadDashboard();
}, []);

async function loadDashboard() {
    const data = await getAdminDashboard();
    setDashboard(data);
}

if (!dashboard)
    return <DashboardLayout>Loading...</DashboardLayout>;
  return (
    <DashboardLayout activePage="dashboard">
      <h1>Welcome back, Admin 👋</h1>

      <div className="stats-grid">
        <StatCard
          dotClass="purple"
          title="Total Users"
          value={dashboard.totalUsers}
          description="Registered users"
        />

        <StatCard
          dotClass="yellow"
          title="Support Agents"
          value={dashboard.supportAgents}
          description="Active IT agents"
        />

        <StatCard
          dotClass="green"
          title="Total Tickets"
          value={dashboard.totalTickets}
          description="All system tickets"
        />

        <StatCard
          dotClass="red"
          title="Critical"
          value={dashboard.criticalTickets}
          description="Critical active tickets"
        />
      </div>

      <section className="dashboard-table-section">
        <div className="section-heading">
          <h2>Recent System Activity</h2>
        </div>

        <div className="tickets-panel">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Target</th>
                <th>Date</th>
              </tr>
            </thead>
<tbody>
    {dashboard.recentActivity.map((activity, index) => (
        <tr key={index}>
            <td>{activity.user}</td>
            <td>{activity.role}</td>
            <td>{activity.action}</td>
            <td>{activity.target}</td>
            <td>{new Date(activity.date).toLocaleDateString()}</td>
        </tr>
    ))}
</tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default AdminDashboard;