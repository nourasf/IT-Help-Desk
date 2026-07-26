import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import StatCard from "../components/StatCard";
import { useEffect, useState } from "react";
import { getEmployeeDashboard } from "../api/dashboard";

function EmployeeDashboard() {
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

  const tickets = [
    {
      id: 1024,
      subject: "Printer Not Working",
      category: "Hardware",
      status: "Pending",
      priority: "High",
      updated: "Today",
    },
    {
      id: 1025,
      subject: "VPN Connection",
      category: "Network",
      status: "Open",
      priority: "Low",
      updated: "Yesterday",
    },
    {
      id: 1026,
      subject: "Outlook Login Issue",
      category: "Email",
      status: "Resolved",
      priority: "Medium",
      updated: "01/02/2026",
    },
    {
      id: 1027,
      subject: "Mouse Not Working",
      category: "Hardware",
      status: "Critical",
      priority: "Low",
      updated: "03/05/2026",
    },
  ];

  return (
    <DashboardLayout activePage="dashboard">
      <div className="dashboard-heading-row">
        <div>
          <h1>Welcome back, Nour 👋</h1>
        </div>
      </div>

      <div className="stats-grid">
       <StatCard
    dotClass="purple"
    title="Open Tickets"
    value={dashboard.openTickets}
    description="Currently active"
/>

<StatCard
    dotClass="yellow"
    title="Pending"
    value={dashboard.pendingTickets}
    description="Awaiting response"
/>

<StatCard
    dotClass="green"
    title="Resolved"
    value={dashboard.resolvedTickets}
    description="Successfully resolved"
/>

<StatCard
    dotClass="red"
    title="Critical"
    value={dashboard.criticalTickets}
    description="Needs immediate attention"
/>
      </div>

      <div className="tickets-section-header">
        <h2>My Recent Tickets</h2>

        <button
          className="primary-pill-button"
          type="button"
          onClick={() => navigate("/create-ticket")}
        >
          <span>＋</span>
          Create ticket
        </button>
      </div>

      <section className="tickets-panel">
        <div className="ticket-filters">
          <div className="table-search">
            <span>⌕</span>
            <input type="text" placeholder="Search..." />
          </div>

          <select defaultValue="">
            <option value="" disabled>
              Status
            </option>
            <option>Open</option>
            <option>Pending</option>
            <option>Resolved</option>
            <option>Critical</option>
          </select>

          <select defaultValue="">
            <option value="" disabled>
              Priority
            </option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Critical</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Updated</th>
              </tr>
            </thead>

          <tbody>
    {dashboard.recentTickets.map((ticket) => (
        <tr key={ticket.id}>
            <td>{ticket.ticketNumber}</td>
            <td>{ticket.subject}</td>
            <td>{ticket.category}</td>
            <td>{ticket.status}</td>
            <td>{ticket.priority}</td>
            <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
        </tr>
    ))}
</tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default EmployeeDashboard;