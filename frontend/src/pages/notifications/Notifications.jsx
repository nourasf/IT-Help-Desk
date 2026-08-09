import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../api/notifications";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Notifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const data = await getNotifications(100, 7);

      setNotifications(
        Array.isArray(data.notifications)
          ? data.notifications
          : []
      );

      setUnreadCount(Number(data.unreadCount || 0));
    } catch (requestError) {
      setError(
        requestError.message ||
          "Notifications could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function openNotification(notification) {
    if (!notification.isRead) {
      await markNotificationAsRead(notification.id);

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: true }
            : item
        )
      );

      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    }

    if (notification.ticketId) {
      navigate(`/tickets/${notification.ticketId}`);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;

    await markAllNotificationsAsRead();

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        isRead: true,
      }))
    );

    setUnreadCount(0);
  }

  return (
    <DashboardLayout activePage="notifications">
      <main className="notifications-page">
        <header className="notifications-page-header">
          <div>
            <span>YOUR ACTIVITY</span>
            <h1>Notifications</h1>
            <p>
              Recent ticket updates from the last 7 days.
            </p>
          </div>

          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </button>
        </header>

        {loading ? (
          <p>Loading notifications...</p>
        ) : error ? (
          <div>
            <p>{error}</p>

            <button type="button" onClick={loadNotifications}>
              Try again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div>
            <h2>No recent notifications</h2>
            <p>
              You have no notifications from the last 7 days.
            </p>
          </div>
        ) : (
          <section className="notifications-page-list">
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`notifications-page-item ${
                  notification.isRead
                    ? "is-read"
                    : "is-unread"
                }`}
                onClick={() =>
                  openNotification(notification)
                }
              >
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </div>

                <time>
                  {formatDate(notification.createdAt)}
                </time>
              </button>
            ))}
          </section>
        )}
      </main>
    </DashboardLayout>
  );
}

export default Notifications;