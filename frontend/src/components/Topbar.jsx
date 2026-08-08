import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../api/notifications";
import "../styles/NotificationCenter.css";

function formatRelativeTime(value) {
  if (!value) return "";

  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function getNotificationVisual(type) {
  const normalized = String(type || "").toLowerCase();

  if (normalized.includes("resolved")) return { icon: "✓", tone: "success", label: "Resolved" };
  if (normalized.includes("assigned") || normalized.includes("reassigned")) return { icon: "↗", tone: "purple", label: "Assignment" };
  if (normalized.includes("escalat")) return { icon: "!", tone: "warning", label: "Escalated" };
  if (normalized.includes("cancel")) return { icon: "×", tone: "danger", label: "Cancelled" };
  if (normalized.includes("reopen")) return { icon: "↻", tone: "blue", label: "Reopened" };
  if (normalized.includes("comment")) return { icon: "✎", tone: "blue", label: "Comment" };
  if (normalized.includes("created")) return { icon: "+", tone: "purple", label: "New ticket" };
  if (normalized.includes("closed")) return { icon: "✓", tone: "neutral", label: "Closed" };

  return { icon: "•", tone: "purple", label: "Update" };
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Topbar() {
  const navigate = useNavigate();
  const notificationRef = useRef(null);
  const knownNotificationIdsRef = useRef(new Set());
  const toastTimerRef = useRef(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [toastNotification, setToastNotification] = useState(null);

  function showNotificationToast(notification) {
    if (!notification) return;

    setToastNotification(notification);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastNotification(null);
    }, 6500);
  }

  async function loadUnreadCount() {
    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(Number(data.unreadCount || 0));
    } catch {
      // Keep the topbar quiet if the session is changing or the API is offline.
    }
  }

  async function loadNotifications() {
    setNotificationsLoading(true);
    setNotificationError("");

    try {
      const data = await getNotifications(20);
      const items = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications(items);
      setUnreadCount(Number(data.unreadCount || 0));
      items.forEach((item) => knownNotificationIdsRef.current.add(item.id));
    } catch (error) {
      setNotificationError(error.message || "Notifications could not be loaded.");
    } finally {
      setNotificationsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeNotifications() {
      try {
        const data = await getNotifications(20);
        if (cancelled) return;

        const items = Array.isArray(data.notifications) ? data.notifications : [];
        setNotifications(items);
        setUnreadCount(Number(data.unreadCount || 0));
        items.forEach((item) => knownNotificationIdsRef.current.add(item.id));
      } catch {
        await loadUnreadCount();
      }
    }

    async function checkForNewNotifications() {
      try {
        const data = await getNotifications(20);
        if (cancelled) return;

        const items = Array.isArray(data.notifications) ? data.notifications : [];
        const newUnread = items.find(
          (item) => !item.isRead && !knownNotificationIdsRef.current.has(item.id)
        );

        items.forEach((item) => knownNotificationIdsRef.current.add(item.id));
        setNotifications(items);
        setUnreadCount(Number(data.unreadCount || 0));

        if (newUnread) {
          showNotificationToast(newUnread);
        }
      } catch {
        // Polling should never interrupt the rest of the dashboard.
      }
    }

    initializeNotifications();
    const timer = window.setInterval(checkForNewNotifications, 12000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        notificationsOpen &&
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setToastNotification(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  const recentUnread = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  async function toggleNotifications() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);

    if (nextOpen) {
      setToastNotification(null);
      await loadNotifications();
    }
  }

  async function openNotification(notification) {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item
          )
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } finally {
      setNotificationsOpen(false);
      setToastNotification(null);

      if (notification.ticketId) {
        navigate(`/tickets/${notification.ticketId}`);
      }
    }
  }

  async function handleNotificationClick(notification) {
    await openNotification(notification);
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;

    try {
      await markAllNotificationsAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      setToastNotification(null);
    } catch (error) {
      setNotificationError(error.message || "Could not mark notifications as read.");
    }
  }

  const toastVisual = toastNotification
    ? getNotificationVisual(toastNotification.type)
    : null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-search">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Search anything..." />
        </div>

        <div className="topbar-user">
          <div className="notification-center" ref={notificationRef}>
            <button
              className={`topbar-icon-button notification-bell ${unreadCount > 0 ? "has-unread" : ""}`}
              type="button"
              onClick={toggleNotifications}
              aria-label="Open notifications"
              aria-expanded={notificationsOpen}
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>

            {notificationsOpen && (
              <section className="notification-popover" aria-label="Notifications">
                <div className="notification-popover-glow" aria-hidden="true" />

                <header className="notification-header">
                  <div>
                    <span className="notification-kicker">Your activity</span>
                    <h2>Notifications</h2>
                    <p>
                      {unreadCount > 0
                        ? `${unreadCount} update${unreadCount === 1 ? "" : "s"} waiting for you`
                        : "You’re all caught up"}
                    </p>
                  </div>
                  <div className="notification-header-orb" aria-hidden="true"><span>✦</span></div>
                </header>

                <div className="notification-toolbar">
                  <span>{recentUnread > 0 ? `${recentUnread} unread in this list` : "Latest activity"}</span>
                  <button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0}>Mark all read</button>
                </div>

                <div className="notification-list">
                  {notificationsLoading ? (
                    <div className="notification-loading"><span /><span /><span /></div>
                  ) : notificationError ? (
                    <div className="notification-state error">
                      <strong>Couldn’t load notifications</strong>
                      <p>{notificationError}</p>
                      <button type="button" onClick={loadNotifications}>Try again</button>
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map((notification) => {
                      const visual = getNotificationVisual(notification.type);
                      return (
                        <button
                          type="button"
                          className={`notification-item ${notification.isRead ? "is-read" : "is-unread"}`}
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <span className={`notification-icon ${visual.tone}`}>{visual.icon}</span>
                          <span className="notification-copy">
                            <span className="notification-item-topline">
                              <small>{visual.label}</small>
                              <time>{formatRelativeTime(notification.createdAt)}</time>
                            </span>
                            <strong>{notification.title}</strong>
                            <p>{notification.message}</p>
                            {notification.ticketId && (
                              <span className="notification-ticket-link">Open ticket <b>→</b></span>
                            )}
                          </span>
                          {!notification.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="notification-empty-state">
                      <div className="notification-empty-orbit" aria-hidden="true">
                        <span className="orbit-dot one" /><span className="orbit-dot two" /><b>✓</b>
                      </div>
                      <strong>Inbox zero. Nice.</strong>
                      <p>No new ticket drama right now. Enjoy the quiet ✦</p>
                    </div>
                  )}
                </div>

                <footer className="notification-footer">
                  <span className="notification-live-dot" />
                  <span>Checks for new updates automatically</span>
                </footer>
              </section>
            )}
          </div>

          <div className="user-avatar">♟</div>
          <span className="user-name">Nour Asfour</span>
          <button className="topbar-arrow" type="button">⌄</button>
        </div>
      </header>

      {toastNotification && toastVisual && (
        <div className="notification-toast-wrap" role="status" aria-live="polite">
          <article className={`notification-toast ${toastVisual.tone}`}>
            <span className={`notification-toast-icon ${toastVisual.tone}`}>{toastVisual.icon}</span>

            <button
              type="button"
              className="notification-toast-main"
              onClick={() => openNotification(toastNotification)}
            >
              <span className="notification-toast-topline">
                <small>{toastVisual.label}</small>
                <time>Just now</time>
              </span>
              <strong>{toastNotification.title}</strong>
              <p>{toastNotification.message}</p>
              {toastNotification.ticketId && <span className="notification-toast-link">View ticket →</span>}
            </button>

            <button
              type="button"
              className="notification-toast-close"
              aria-label="Dismiss notification"
              onClick={() => setToastNotification(null)}
            >
              ×
            </button>
          </article>
        </div>
      )}
    </>
  );
}

export default Topbar;
