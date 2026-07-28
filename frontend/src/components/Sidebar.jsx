import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

function SidebarIcon({ name }) {
  const icons = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),

    tickets: (
      <>
        <path d="M4 6h16v12H4z" />
        <path d="M8 6v12" />
        <path d="M16 6v12" />
      </>
    ),

    create: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),

    notification: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),

    knowledge: (
      <>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23z" />
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23z" />
      </>
    ),

    ai: (
      <>
        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      </>
    ),

    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),

    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
      </>
    ),

    collapse: (
      <>
        <path d="M15 18l-6-6 6-6" />
      </>
    ),
  };

  return (
    <svg
      className="sidebar-svg-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

function Sidebar({ activePage, collapsed, onToggle }) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");

    navigate("/login", { replace: true });
  }

  const links = [
    {
      name: "dashboard",
      label: "Dashboard",
      path: "/agent-dashboard",
      icon: "dashboard",
    },
    {
      name: "tickets",
      label: "My Tickets",
      path: "/my-tickets",
      icon: "tickets",
    },
    {
      name: "create-ticket",
      label: "Create Ticket",
      path: "/create-ticket",
      icon: "create",
    },
    {
      name: "notifications",
      label: "Notifications",
      path: "/notifications",
      icon: "notification",
    },
    {
      name: "knowledge-base",
      label: "Knowledge Base",
      path: "/knowledge-base",
      icon: "knowledge",
    },
    {
      name: "ai-assistant",
      label: "AI Assistant",
      path: "/ai-assistant",
      icon: "ai",
    },
  ];

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <img
            src={logo}
            alt="SupportHub"
            className="sidebar-logo"
          />
        </div>

        <button
          type="button"
          className="sidebar-collapse"
          onClick={onToggle}
          aria-label={
            collapsed ? "Open sidebar" : "Close sidebar"
          }
        >
          <SidebarIcon name="collapse" />
        </button>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) =>
              `nav-item ${
                activePage === link.name || isActive
                  ? "active"
                  : ""
              }`
            }
          >
            <span className="nav-icon">
              <SidebarIcon name={link.icon} />
            </span>

            <span className="nav-label">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <NavLink
          to="/profile"
          className="nav-item"
          title={collapsed ? "My Profile" : undefined}
        >
          <span className="nav-icon">
            <SidebarIcon name="profile" />
          </span>

          <span className="nav-label">My Profile</span>
        </NavLink>

        <button
          type="button"
          className="nav-item logout-button"
          onClick={handleLogout}
          title={collapsed ? "Log Out" : undefined}
        >
          <span className="nav-icon">
            <SidebarIcon name="logout" />
          </span>

          <span className="nav-label">Log Out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;