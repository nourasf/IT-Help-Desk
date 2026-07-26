import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "../styles/dashboard.css";

function DashboardLayout({ children, activePage }) {
  return (
    <div className="dashboard-shell">
      <Sidebar activePage={activePage} />

      <main className="dashboard-main">
        <Topbar />

        <section className="dashboard-content">
          {children}
        </section>
      </main>
    </div>
  );
}

export default DashboardLayout;