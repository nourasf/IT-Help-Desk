import DashboardLayout from "../components/DashboardLayout";
import StatCard from "../components/StatCard";
import { useEffect, useState } from "react";
import { getManagerDashboard } from "../api/dashboard";
function ManagerDashboard() {

     const navigate = useNavigate();
const [dashboard, setDashboard] = useState(null);

useEffect(() => {
    loadDashboard();
}, []);

async function loadDashboard() {
    try {
        const data = await getEmployeeDashboard();
        setDashboard(data);
    } catch (err) {
        console.error(err);
    }
}

if (!dashboard)
    return <DashboardLayout>Loading...</DashboardLayout>;
  return (
    <DashboardLayout activePage="dashboard">
      <h1>Welcome back, Manager 👋</h1>

      <div className="stats-grid">
        <StatCard
          dotClass="purple"
          title="Team Tickets"
          value="28"
          description="Total team tickets"
        />

        <StatCard
          dotClass="yellow"
          title="Open"
          value="9"
          description="Currently active"
        />

        <StatCard
          dotClass="red"
          title="Overdue"
          value="3"
          description="Past expected resolution"
        />

        <StatCard
          dotClass="green"
          title="Resolved"
          value="19"
          description="Resolved this month"
        />
      </div>

      <section className="dashboard-table-section">
        <div className="section-heading">
          <h2>Team Performance</h2>
        </div>

        <div className="tickets-panel">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Assigned</th>
                <th>Resolved</th>
                <th>Open</th>
                <th>Average Resolution</th>
                <th>Performance</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Ali Hassan</td>
                <td>12</td>
                <td>9</td>
                <td>3</td>
                <td>2.5 hours</td>
                <td>Excellent</td>
              </tr>

              <tr>
                <td>Maya Fares</td>
                <td>10</td>
                <td>7</td>
                <td>3</td>
                <td>3.2 hours</td>
                <td>Good</td>
              </tr>

              <tr>
                <td>Karim Nasser</td>
                <td>8</td>
                <td>5</td>
                <td>3</td>
                <td>4.1 hours</td>
                <td>Good</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default ManagerDashboard;