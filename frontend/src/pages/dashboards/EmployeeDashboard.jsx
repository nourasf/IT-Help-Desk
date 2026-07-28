import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getEmployeeDashboard } from "../../api/dashboard";
import "../../styles/EmployeeDashboard.css";

function EmployeeDashboard() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const data = await getEmployeeDashboard();

      setDashboard(data);
    } catch (err) {
      console.error("Failed to load employee dashboard.", err);
      setError(err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const tickets =
    dashboard?.recentTickets ||
    dashboard?.tickets ||
    [];

  const actionRequiredTickets = tickets.filter((ticket) => {
    const status = ticket.status?.toLowerCase();

    return (
      ticket.requiresEmployeeResponse === true ||
      status === "waiting for employee" ||
      status === "action required"
    );
  });

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const subject = ticket.subject?.toLowerCase() || "";
      const ticketNumber =
        ticket.ticketNumber?.toString().toLowerCase() || "";
      const status = ticket.status?.toLowerCase() || "";
      const priority = ticket.priority?.toLowerCase() || "";

      const searchValue = search.toLowerCase().trim();

      const matchesSearch =
        subject.includes(searchValue) ||
        ticketNumber.includes(searchValue);

      const matchesStatus =
        !statusFilter ||
        status === statusFilter.toLowerCase();

      const matchesPriority =
        !priorityFilter ||
        priority === priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const announcements = [
    {
      id: 1,
      title: "Scheduled maintenance",
      description:
        "Some internal services may be unavailable tonight from 9:00 PM.",
      date: "Today",
    },
    {
      id: 2,
      title: "Security reminder",
      description:
        "Never share your password or verification code with another person.",
      date: "This week",
    },
  ];

  const helpfulArticles = [
    {
      id: 1,
      title: "How to reset your password",
      category: "Account",
    },
    {
      id: 2,
      title: "Connect to the company VPN",
      category: "Network",
    },
    {
      id: 3,
      title: "Troubleshoot a printer",
      category: "Hardware",
    },
  ];

  function formatDate(dateValue) {
    if (!dateValue) {
      return "—";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getBadgeClass(value) {
    return value
      ?.toLowerCase()
      .replaceAll(" ", "-")
      .replaceAll("_", "-");
  }

  if (loading) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="employee-page-state">
          <div className="dashboard-loader"></div>
          <p>Loading your dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout activePage="dashboard">
        <div className="employee-page-state error-state">
          <h2>We could not load your dashboard</h2>
          <p>{error}</p>

          <button type="button" onClick={loadDashboard}>
            Try Again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activePage="dashboard">
      <main className="employee-dashboard-page">
        <section className="employee-welcome-section">
          <div>
            <span className="welcome-label">Employee workspace</span>

            <h1>
              Welcome back,{" "}
              {dashboard?.fullName ||
                dashboard?.name ||
                "Nour"}{" "}
              <span className="wave-emoji">👋</span>
            </h1>

            <p>
              Submit support requests, follow ticket updates and find
              quick solutions.
            </p>
          </div>

          <button
            type="button"
            className="main-create-ticket-button"
            onClick={() => navigate("/create-ticket")}
          >
            <span className="button-plus">+</span>
            Create Ticket
          </button>
        </section>

        <section className="quick-actions-section">
          <div className="section-title-row">
            <div>
              <h2>Quick Actions</h2>
              <p>Choose what you would like to do.</p>
            </div>
          </div>

          <div className="quick-actions-grid">
            <button
              type="button"
              className="quick-action-card"
              onClick={() => navigate("/my-tickets")}
            >
              <span className="quick-action-icon ticket-icon">▣</span>

              <span className="quick-action-text">
                <strong>My Tickets</strong>
                <small>View and track your requests</small>
              </span>

              <span className="quick-action-arrow">›</span>
            </button>

            <button
              type="button"
              className="quick-action-card"
              onClick={() => navigate("/ai-assistant")}
            >
              <span className="quick-action-icon ai-icon">✦</span>

              <span className="quick-action-text">
                <strong>Ask AI Assistant</strong>
                <small>Get help before creating a ticket</small>
              </span>

              <span className="quick-action-arrow">›</span>
            </button>

            <button
              type="button"
              className="quick-action-card"
              onClick={() => navigate("/knowledge-base")}
            >
              <span className="quick-action-icon knowledge-icon">▤</span>

              <span className="quick-action-text">
                <strong>Knowledge Base</strong>
                <small>Browse guides and common solutions</small>
              </span>

              <span className="quick-action-arrow">›</span>
            </button>
          </div>
        </section>

        <section className="action-required-section">
          <div className="action-required-header">
            <div className="action-required-title">
              <span className="action-alert-icon">!</span>

              <div>
                <h2>Action Required</h2>
                <p>Tickets waiting for information from you.</p>
              </div>
            </div>

            <span className="action-required-count">
              {actionRequiredTickets.length}
            </span>
          </div>

          {actionRequiredTickets.length > 0 ? (
            <div className="action-required-list">
              {actionRequiredTickets.slice(0, 3).map((ticket) => (
                <button
                  type="button"
                  className="action-ticket-item"
                  key={ticket.id}
                  onClick={() =>
                    navigate(`/tickets/${ticket.id}`)
                  }
                >
                  <div>
                    <span className="action-ticket-number">
                      {ticket.ticketNumber || `#${ticket.id}`}
                    </span>

                    <h3>{ticket.subject}</h3>

                    <p>
                      The IT support team needs more information to
                      continue.
                    </p>
                  </div>

                  <span className="respond-button">
                    View Ticket
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="no-action-required">
              <span>✓</span>

              <div>
                <h3>You are all caught up</h3>
                <p>No tickets currently require your response.</p>
              </div>
            </div>
          )}
        </section>

        <section className="recent-tickets-section">
          <div className="section-title-row tickets-title-row">
            <div>
              <h2>My Recent Tickets</h2>
              <p>Track your latest support requests.</p>
            </div>

            <button
              type="button"
              className="view-all-button"
              onClick={() => navigate("/my-tickets")}
            >
              View all tickets
              <span>›</span>
            </button>
          </div>

          <div className="employee-ticket-filters">
            <div className="employee-ticket-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search by ticket ID or subject..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Pending">Pending</option>
              <option value="Action Required">
                Action Required
              </option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value)
              }
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div className="employee-ticket-table-wrapper">
            <table className="employee-ticket-table">
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
                {filteredTickets.length > 0 ? (
                  filteredTickets.slice(0, 5).map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() =>
                        navigate(`/tickets/${ticket.id}`)
                      }
                    >
                      <td className="ticket-number-cell">
                        {ticket.ticketNumber ||
                          `#${ticket.id}`}
                      </td>

                      <td className="ticket-subject-cell">
                        {ticket.subject}
                      </td>

                      <td>
                        {ticket.category ||
                          ticket.categoryName ||
                          "—"}
                      </td>

                      <td>
                        <span
                          className={`employee-ticket-badge status-${getBadgeClass(
                            ticket.status
                          )}`}
                        >
                          {ticket.status || "Open"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`employee-ticket-badge priority-${getBadgeClass(
                            ticket.priority
                          )}`}
                        >
                          {ticket.priority || "Medium"}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          ticket.updatedAt ||
                            ticket.createdAt
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">
                      <div className="employee-empty-tickets">
                        <div className="empty-ticket-illustration">
                          ▱
                        </div>

                        <h3>No tickets found</h3>

                        <p>
                          Create a new support request or adjust your
                          filters.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            navigate("/create-ticket")
                          }
                        >
                          Create Ticket
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="employee-bottom-grid">
          <article className="employee-info-card">
            <div className="info-card-header">
              <div>
                <h2>Announcements</h2>
                <p>Updates from the IT department.</p>
              </div>

              <span className="header-icon">♧</span>
            </div>

            <div className="announcement-list">
              {announcements.map((announcement) => (
                <div
                  className="announcement-item"
                  key={announcement.id}
                >
                  <span className="announcement-dot"></span>

                  <div>
                    <div className="announcement-title-row">
                      <h3>{announcement.title}</h3>
                      <span>{announcement.date}</span>
                    </div>

                    <p>{announcement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="employee-info-card">
            <div className="info-card-header">
              <div>
                <h2>Helpful Articles</h2>
                <p>Quick solutions for common issues.</p>
              </div>

              <span className="header-icon">?</span>
            </div>

            <div className="helpful-articles-list">
              {helpfulArticles.map((article) => (
                <button
                  type="button"
                  className="helpful-article-item"
                  key={article.id}
                  onClick={() =>
                    navigate(`/knowledge-base/${article.id}`)
                  }
                >
                  <span className="article-icon">▤</span>

                  <span className="article-content">
                    <strong>{article.title}</strong>
                    <small>{article.category}</small>
                  </span>

                  <span className="article-arrow">›</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="browse-articles-button"
              onClick={() => navigate("/knowledge-base")}
            >
              Browse all articles
            </button>
          </article>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default EmployeeDashboard;