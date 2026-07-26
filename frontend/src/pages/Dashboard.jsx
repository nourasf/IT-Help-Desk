import AdminDashboard from "./AdminDashboard";
import AgentDashboard from "./AgentDashboard";
import EmployeeDashboard from "./EmployeeDashboard";
import ManagerDashboard from "./ManagerDashboard";

function Dashboard() {
  const role =
    localStorage.getItem("role") ||
    sessionStorage.getItem("role");

  switch (role) {
    case "Admin":
      return <AdminDashboard />;

    case "IT Support Agent":
      return <AgentDashboard />;

    case "Manager":
      return <ManagerDashboard />;

    case "Employee":
      return <EmployeeDashboard />;

    default:
      return <EmployeeDashboard />;
  }
}

export default Dashboard;