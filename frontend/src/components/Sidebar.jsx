import { Link, useNavigate } from "react-router-dom";

function Sidebar({ activePage }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="brand-icon">◎</div>

          <div>
            <h2>SUPPORTHUB</h2>
            <span>SINCE 2026</span>
          </div>
        </div>

        <button className="sidebar-collapse" type="button">
          ◧
        </button>
      </div>

      <nav className="sidebar-nav">
        <Link
          to="/dashboard"
          className={activePage === "dashboard" ? "nav-item active" : "nav-item"}
        >
          <span className="nav-icon">▦</span>
          Dashboard
        </Link>

        <Link
          to="/tickets"
          className={activePage === "tickets" ? "nav-item active" : "nav-item"}
        >
          <span className="nav-icon">▧</span>
          My Tickets
        </Link>

        <Link
          to="/create-ticket"
          className={
            activePage === "create-ticket" ? "nav-item active" : "nav-item"
          }
        >
          <span className="nav-icon">＋</span>
          Create Ticket
        </Link>

        <Link to="/notifications" className="nav-item">
          <span className="nav-icon">♧</span>
          Notifications
        </Link>

        <Link to="/knowledge-base" className="nav-item">
          <span className="nav-icon">▰</span>
          Knowledge Base
        </Link>

        <Link to="/ai-assistant" className="nav-item">
          <span className="nav-icon">✧</span>
          AI Assistant
        </Link>
      </nav>

      <div className="sidebar-bottom">
        <Link to="/profile" className="nav-item">
          <span className="nav-icon">♙</span>
          My Profile
        </Link>

        <button className="nav-item logout-button" onClick={handleLogout}>
          <span className="nav-icon">⇥</span>
          Log Out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;