import DashboardLayout from "../components/DashboardLayout";
import StatCard from "../components/StatCard";
import { useEffect, useState } from "react";
import { getAgentDashboard } from "../api/dashboard";

function AgentDashboard() {
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
      <h1>Welcome back, Support Agent 👋</h1>

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
          <h2>Assigned Tickets</h2>
        </div>

        <div className="tickets-panel">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Employee</th>
                <th>Subject</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>#1042</td>
                <td>Nour Asfour</td>
                <td>Laptop not booting</td>
                <td>Critical</td>
                <td>In Progress</td>
                <td>Today</td>
              </tr>

              <tr>
                <td>#1043</td>
                <td>Sarah Khalil</td>
                <td>Email not syncing</td>
                <td>Medium</td>
                <td>Open</td>
                <td>Today</td>
              </tr>

              <tr>
                <td>#1044</td>
                <td>Omar Saleh</td>
                <td>VPN connection issue</td>
                <td>High</td>
                <td>Pending</td>
                <td>Yesterday</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default AgentDashboard;