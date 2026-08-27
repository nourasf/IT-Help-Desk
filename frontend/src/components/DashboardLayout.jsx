import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import TicketRoleTools from "./TicketRoleTools";
import "../styles/dashboard/Dashboard.css";

function DashboardLayout({ children, activePage }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={`dashboard-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      <Sidebar
        activePage={activePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((currentValue) => !currentValue)}
      />
      <main className="dashboard-main">
        <Topbar />
        <section className="dashboard-content">
          <TicketRoleTools />
          {children}
        </section>
      </main>
    </div>
  );
}

export default DashboardLayout;
