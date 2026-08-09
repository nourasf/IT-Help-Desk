import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";

import {
  assignTicket,
  getAssignmentOptions,
  getTicketById,

  startWork,
  pauseWork,

  getTicketComments,
  addTicketComment,

  getTicketActivity,
  getTicketHistory,

  resolveTicket,
  escalateTicket,
  cancelTicket,
  reopenTicket,
  closeTicket,
} from "../../api/ticket";

import "../../styles/Tickets.css";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBadgeClass(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-");
}

function getInitials(name) {
  if (!name) return "NA";

  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
}

function getStoredRole() {
  return (
    localStorage.getItem("role") ||
    sessionStorage.getItem("role") ||
    ""
  );
}

function getCommentUser(comment) {
  return (
    comment.user?.name ||
    comment.userName ||
    comment.authorName ||
    comment.createdBy ||
    "User"
  );
}

function getTimelineText(item) {
  return (
    item.description ||
    item.details ||
    item.action ||
    item.message ||
    item.change ||
    item.status ||
    "Ticket updated"
  );
}

function getTimelineUser(item) {
  return (
    item.user?.name ||
    item.userName ||
    item.performedBy ||
    item.changedBy ||
    ""
  );
}

function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const currentRole = normalizeRole(getStoredRole());

  const isManager = currentRole === "manager";
  const isAgent =
    currentRole === "it support agent" ||
    currentRole === "agent";

  const isEmployee = currentRole === "employee";
  const isAdmin = currentRole === "admin";

  // =========================
  // TICKET
  // =========================

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =========================
  // WORK SESSION
  // =========================

  const [workLoading, setWorkLoading] = useState(false);
  const [workMessage, setWorkMessage] = useState("");
  const [workError, setWorkError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  // =========================
  // ASSIGNMENT
  // =========================

  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] =
    useState("");

  const [assigning, setAssigning] = useState(false);
  const [assignmentMessage, setAssignmentMessage] =
    useState("");
  const [assignmentError, setAssignmentError] =
    useState("");

  // =========================
  // COMMENTS
  // =========================

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] =
    useState(false);

  const [commentsError, setCommentsError] = useState("");
  const [newComment, setNewComment] = useState("");

  const [commentSubmitting, setCommentSubmitting] =
    useState(false);

  // =========================
  // ACTIVITY / HISTORY
  // =========================

  const [activity, setActivity] = useState([]);
  const [history, setHistory] = useState([]);

  const [timelineLoading, setTimelineLoading] =
    useState(false);

  // =========================
  // TICKET ACTIONS
  // =========================

  const [actionLoading, setActionLoading] =
    useState(false);

  const [actionMessage, setActionMessage] =
    useState("");

  const [actionError, setActionError] = useState("");

  const [selectedAction, setSelectedAction] =
    useState("");

  const [actionNote, setActionNote] = useState("");

  // =========================
  // AGENTS
  // =========================

  const sortedAgents = useMemo(() => {
    return [...agents].sort(
      (a, b) =>
        Number(a.activeTickets || 0) -
          Number(b.activeTickets || 0) ||
        String(a.name || "").localeCompare(
          String(b.name || "")
        )
    );
  }, [agents]);

  const leastBusyAgent = sortedAgents[0] || null;

  // =========================
  // LOAD PAGE
  // =========================

  useEffect(() => {
    loadPage();
  }, [id]);

  async function loadPage() {
    await Promise.all([
      loadTicket(),
      loadComments(),
      loadTimeline(),
      isManager ? loadAgents() : Promise.resolve(),
    ]);
  }

  async function loadTicket() {
    setLoading(true);
    setError("");

    try {
      const data = await getTicketById(id);

      setTicket(data);
      setIsWorking(Boolean(data.activeWorkSession));
    } catch (requestError) {
      setError(
        requestError.message ||
          "The ticket could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAgents() {
    try {
      const data = await getAssignmentOptions();

      const availableAgents = Array.isArray(data.agents)
        ? data.agents
        : [];

      setAgents(availableAgents);

      if (
        availableAgents.length > 0 &&
        !selectedAgentId
      ) {
        const ordered = [...availableAgents].sort(
          (a, b) =>
            Number(a.activeTickets || 0) -
            Number(b.activeTickets || 0)
        );

        setSelectedAgentId(String(ordered[0].id));
      }
    } catch (requestError) {
      setAssignmentError(
        requestError.message ||
          "Agents could not be loaded."
      );
    }
  }

  useEffect(() => {
    if (
      ticket?.assignedAgent?.id &&
      isManager
    ) {
      setSelectedAgentId(
        String(ticket.assignedAgent.id)
      );
    }
  }, [ticket, isManager]);

  // =========================
  // COMMENTS
  // =========================

  async function loadComments() {
    setCommentsLoading(true);
    setCommentsError("");

    try {
      const data = await getTicketComments(id);

      setComments(
        Array.isArray(data) ? data : []
      );
    } catch (requestError) {
      setCommentsError(
        requestError.message ||
          "Comments could not be loaded."
      );
    } finally {
      setCommentsLoading(false);
    }
  }

  async function handleAddComment(event) {
    event.preventDefault();

    const comment = newComment.trim();

    if (!comment) return;

    setCommentSubmitting(true);
    setCommentsError("");

    try {
      await addTicketComment(id, comment);

      setNewComment("");

      await Promise.all([
        loadComments(),
        loadTimeline(),
      ]);
    } catch (requestError) {
      setCommentsError(
        requestError.message ||
          "The comment could not be added."
      );
    } finally {
      setCommentSubmitting(false);
    }
  }

  // =========================
  // TIMELINE
  // =========================

  async function loadTimeline() {
    setTimelineLoading(true);

    try {
      const [activityData, historyData] =
        await Promise.all([
          getTicketActivity(id),
          getTicketHistory(id),
        ]);

      setActivity(
        Array.isArray(activityData)
          ? activityData
          : []
      );

      setHistory(
        Array.isArray(historyData)
          ? historyData
          : []
      );
    } catch (requestError) {
      console.error(
        "Timeline load error:",
        requestError
      );
    } finally {
      setTimelineLoading(false);
    }
  }

  // =========================
  // WORK
  // =========================

  async function handleStartWork() {
    setWorkLoading(true);
    setWorkMessage("");
    setWorkError("");

    try {
      const result = await startWork(id);

      setWorkMessage(
        result.message ||
          "Work session started successfully."
      );

      await Promise.all([
        loadTicket(),
        loadTimeline(),
      ]);
    } catch (requestError) {
      setWorkError(
        requestError.message ||
          "The work session could not be started."
      );
    } finally {
      setWorkLoading(false);
    }
  }

  async function handlePauseWork() {
    setWorkLoading(true);
    setWorkMessage("");
    setWorkError("");

    try {
      const result = await pauseWork(id);

      setWorkMessage(
        result.message ||
          "Work session paused successfully."
      );

      await Promise.all([
        loadTicket(),
        loadTimeline(),
      ]);
    } catch (requestError) {
      setWorkError(
        requestError.message ||
          "The work session could not be paused."
      );
    } finally {
      setWorkLoading(false);
    }
  }

  // =========================
  // ASSIGNMENT
  // =========================

  async function performAssignment(
    agentId,
    automatic = false
  ) {
    if (!agentId) {
      setAssignmentError(
        "Choose an available support agent first."
      );
      return;
    }

    setAssigning(true);
    setAssignmentMessage("");
    setAssignmentError("");

    try {
      const result = await assignTicket(
        id,
        agentId
      );

      const agent = sortedAgents.find(
        (item) =>
          Number(item.id) === Number(agentId)
      );

      setAssignmentMessage(
        automatic
          ? `Auto-assigned to ${
              agent?.name ||
              "the least busy agent"
            }.`
          : result.message ||
              `Assigned to ${
                agent?.name ||
                "support agent"
              }.`
      );

      await Promise.all([
        loadTicket(),
        loadAgents(),
        loadTimeline(),
      ]);
    } catch (requestError) {
      setAssignmentError(
        requestError.message ||
          "The ticket could not be assigned."
      );
    } finally {
      setAssigning(false);
    }
  }

  // =========================
  // ACTIONS
  // =========================

  function openAction(action) {
    setSelectedAction(action);
    setActionNote("");
    setActionMessage("");
    setActionError("");
  }

  function closeActionPanel() {
    if (actionLoading) return;

    setSelectedAction("");
    setActionNote("");
    setActionError("");
  }

  async function refreshAfterAction() {
    await Promise.all([
      loadTicket(),
      loadComments(),
      loadTimeline(),
      isManager
        ? loadAgents()
        : Promise.resolve(),
    ]);
  }

  async function handleTicketAction() {
    if (!selectedAction) return;

    const note = actionNote.trim();

    if (
      [
        "resolve",
        "escalate",
        "cancel",
        "reopen",
      ].includes(selectedAction) &&
      !note
    ) {
      setActionError(
        selectedAction === "resolve"
          ? "Add resolution notes first."
          : "Add a reason first."
      );

      return;
    }

    setActionLoading(true);
    setActionError("");
    setActionMessage("");

    try {
      let result;

      switch (selectedAction) {
        case "resolve":
          result = await resolveTicket(
            id,
            note
          );
          break;

        case "escalate":
          result = await escalateTicket(
            id,
            note
          );
          break;

        case "cancel":
          result = await cancelTicket(
            id,
            note
          );
          break;

        case "reopen":
          result = await reopenTicket(
            id,
            note
          );
          break;

        case "close":
          result = await closeTicket(id);
          break;

        default:
          return;
      }

      setActionMessage(
        result?.message ||
          "Ticket updated successfully."
      );

      setSelectedAction("");
      setActionNote("");

      await refreshAfterAction();
    } catch (requestError) {
      setActionError(
        requestError.message ||
          "The ticket could not be updated."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // =========================
  // STATES
  // =========================

  if (loading) {
    return (
      <DashboardLayout activePage="tickets">
        <div className="ticket-details-state">
          Loading ticket...
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout activePage="tickets">
        <div className="ticket-details-state error">
          <h2>Could not load ticket</h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={loadPage}
          >
            Try Again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!ticket) {
    return (
      <DashboardLayout activePage="tickets">
        <div className="ticket-details-state error">
          Ticket not found.
        </div>
      </DashboardLayout>
    );
  }

  // =========================
  // STATUS PERMISSIONS
  // =========================

  const normalizedStatus = String(
    ticket.status || ""
  ).toLowerCase();

  const isResolved =
    normalizedStatus === "resolved";

  const isClosed =
    normalizedStatus === "closed";

  const isCancelled =
    normalizedStatus === "cancelled";

  const assignmentLocked =
    isClosed || isCancelled;

  const canComment =
    !isClosed && !isCancelled;

  const canResolve =
    isAgent &&
    !isResolved &&
    !isClosed &&
    !isCancelled;

  const canEscalate =
    (isAgent || isManager) &&
    !isClosed &&
    !isCancelled &&
    !isResolved;

  const canCancel =
    (isManager || isAdmin) &&
    !isClosed &&
    !isCancelled;

  const canClose =
    (isManager || isAdmin) &&
    isResolved;

  const canReopen =
    (isManager || isAdmin) &&
    (isResolved ||
      isClosed ||
      isCancelled);

  const combinedTimeline = [
    ...activity.map((item) => ({
      ...item,
      timelineType: "activity",
      timelineDate:
        item.createdAt ||
        item.timestamp ||
        item.date,
    })),

    ...history.map((item) => ({
      ...item,
      timelineType: "history",
      timelineDate:
        item.createdAt ||
        item.changedAt ||
        item.timestamp ||
        item.date,
    })),
  ].sort((a, b) => {
    return (
      new Date(b.timelineDate || 0) -
      new Date(a.timelineDate || 0)
    );
  });

  // =========================
  // UI
  // =========================

  return (
    <DashboardLayout activePage="tickets">
      <main className="ticket-details-page">

        {/* HEADER */}

        <header className="ticket-details-header">
          <div>
            <button
              type="button"
              className="ticket-back-button"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>

            <span className="ticket-details-number">
              {ticket.ticketNumber}
            </span>

            <h1>{ticket.subject}</h1>

            <div className="ticket-details-badges">
              <span
                className={`ticket-details-badge priority-${getBadgeClass(
                  ticket.priority
                )}`}
              >
                {ticket.priority}
              </span>

              <span
                className={`ticket-details-badge status-${getBadgeClass(
                  ticket.status
                )}`}
              >
                {ticket.status}
              </span>
            </div>
          </div>

          <div className="ticket-details-header-actions">

            {isAgent && !isClosed && !isCancelled && (
              <button
                type="button"
                className={
                  isWorking
                    ? "ticket-pause-work-button"
                    : "ticket-start-work-button"
                }
                disabled={
                  !ticket.canEdit ||
                  workLoading
                }
                onClick={
                  isWorking
                    ? handlePauseWork
                    : handleStartWork
                }
              >
                {workLoading
                  ? "Please wait..."
                  : isWorking
                    ? "Pause Work"
                    : "Start Work"}
              </button>
            )}
          </div>
        </header>

        {/* ACTION BUTTONS */}

        {(isAgent || isManager || isAdmin) && (
          <section className="ticket-action-bar">
            <div>
              <span>Ticket actions</span>

              <strong>
                Manage the current ticket status
              </strong>
            </div>

            <div className="ticket-action-buttons">
              {canResolve && (
                <button
                  type="button"
                  className="ticket-action resolve"
                  onClick={() =>
                    openAction("resolve")
                  }
                >
                  Resolve
                </button>
              )}

              {canEscalate && (
                <button
                  type="button"
                  className="ticket-action escalate"
                  onClick={() =>
                    openAction("escalate")
                  }
                >
                  Escalate
                </button>
              )}

              {canClose && (
                <button
                  type="button"
                  className="ticket-action close"
                  onClick={() =>
                    openAction("close")
                  }
                >
                  Close Ticket
                </button>
              )}

              {canReopen && (
                <button
                  type="button"
                  className="ticket-action reopen"
                  onClick={() =>
                    openAction("reopen")
                  }
                >
                  Reopen
                </button>
              )}

              {canCancel && (
                <button
                  type="button"
                  className="ticket-action cancel"
                  onClick={() =>
                    openAction("cancel")
                  }
                >
                  Cancel
                </button>
              )}
            </div>
          </section>
        )}

        {/* ACTION PANEL */}

        {selectedAction && (
          <section className="ticket-action-panel">
            <div className="ticket-action-panel-heading">
              <div>
                <span>
                  Confirm action
                </span>

                <h3>
                  {selectedAction === "resolve" &&
                    "Resolve ticket"}

                  {selectedAction === "escalate" &&
                    "Escalate ticket"}

                  {selectedAction === "cancel" &&
                    "Cancel ticket"}

                  {selectedAction === "reopen" &&
                    "Reopen ticket"}

                  {selectedAction === "close" &&
                    "Close ticket"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeActionPanel}
              >
                ×
              </button>
            </div>

            {selectedAction !== "close" && (
              <textarea
                value={actionNote}
                onChange={(event) =>
                  setActionNote(
                    event.target.value
                  )
                }
                placeholder={
                  selectedAction === "resolve"
                    ? "Enter resolution notes..."
                    : "Enter the reason for this action..."
                }
              />
            )}

            {selectedAction === "close" && (
              <p className="ticket-action-confirmation">
                This will close the resolved ticket
                and make it read-only.
              </p>
            )}

            {actionError && (
              <p className="ticket-action-message error">
                {actionError}
              </p>
            )}

            <div className="ticket-action-panel-buttons">
              <button
                type="button"
                className="secondary"
                onClick={closeActionPanel}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary"
                onClick={handleTicketAction}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Updating..."
                  : "Confirm"}
              </button>
            </div>
          </section>
        )}

        {actionMessage && (
          <div className="ticket-work-message success">
            {actionMessage}
          </div>
        )}

        {actionError && !selectedAction && (
          <div className="ticket-work-message error">
            {actionError}
          </div>
        )}

        {workMessage && (
          <div className="ticket-work-message success">
            {workMessage}
          </div>
        )}

        {workError && (
          <div className="ticket-work-message error">
            {workError}
          </div>
        )}

        {isClosed && (
          <div className="ticket-closed-banner">
            This ticket is closed and is now read-only.
          </div>
        )}

        {/* MANAGER ASSIGNMENT */}

        {isManager && (
          <section className="ticket-manager-assignment-card">
            <div className="ticket-manager-assignment-heading">
              <div>
                <span>Manager action</span>

                <h2>
                  {ticket.assignedAgent
                    ? "Assignment"
                    : "This ticket needs an owner"}
                </h2>

                <p>
                  Assign manually or let SupportHub
                  choose the agent with the lightest
                  workload.
                </p>
              </div>

              {ticket.assignedAgent && (
                <div className="ticket-current-owner">
                  <small>
                    Current owner
                  </small>

                  <strong>
                    {
                      ticket.assignedAgent
                        .name
                    }
                  </strong>
                </div>
              )}
            </div>

            <div className="ticket-manager-assignment-grid">
              <div className="ticket-manual-assignment">
                <span>
                  Manual assignment
                </span>

                <select
                  value={selectedAgentId}
                  onChange={(event) =>
                    setSelectedAgentId(
                      event.target.value
                    )
                  }
                  disabled={
                    assigning ||
                    assignmentLocked ||
                    sortedAgents.length === 0
                  }
                >
                  {sortedAgents.map(
                    (agent) => (
                      <option
                        key={agent.id}
                        value={agent.id}
                      >
                        {agent.name} ·{" "}
                        {agent.activeTickets}{" "}
                        active
                      </option>
                    )
                  )}
                </select>

                <button
                  type="button"
                  disabled={
                    assigning ||
                    assignmentLocked ||
                    !selectedAgentId
                  }
                  onClick={() =>
                    performAssignment(
                      selectedAgentId
                    )
                  }
                >
                  {assigning
                    ? "Assigning..."
                    : ticket.assignedAgent
                      ? "Reassign Ticket"
                      : "Assign Ticket"}
                </button>
              </div>

              <div className="ticket-smart-assignment">
                <div>
                  <span>
                    ✦ Smart assignment
                  </span>

                  <strong>
                    {leastBusyAgent?.name ||
                      "No agent available"}
                  </strong>

                  <p>
                    {leastBusyAgent
                      ? `${leastBusyAgent.activeTickets} active ticket${
                          Number(
                            leastBusyAgent.activeTickets
                          ) === 1
                            ? ""
                            : "s"
                        } — lightest workload.`
                      : "No support agent is currently available."}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    assigning ||
                    assignmentLocked ||
                    !leastBusyAgent
                  }
                  onClick={() =>
                    performAssignment(
                      leastBusyAgent?.id,
                      true
                    )
                  }
                >
                  {assigning
                    ? "Assigning..."
                    : "✦ Auto Assign"}
                </button>
              </div>
            </div>

            {assignmentMessage && (
              <p className="ticket-assignment-message success">
                {assignmentMessage}
              </p>
            )}

            {assignmentError && (
              <p className="ticket-assignment-message error">
                {assignmentError}
              </p>
            )}
          </section>
        )}

        {/* DETAILS */}

        <section className="ticket-details-grid">
          <article className="ticket-details-main-card">
            <div className="ticket-details-section-heading">
              <h2>
                Issue Description
              </h2>
            </div>

            <p className="ticket-description">
              {ticket.description}
            </p>

            <div className="ticket-information-grid">
              <div>
                <span>Category</span>
                <strong>
                  {ticket.category}
                </strong>
              </div>

              <div>
                <span>Priority</span>
                <strong>
                  {ticket.priority}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {ticket.status}
                </strong>
              </div>

              <div>
                <span>Created</span>
                <strong>
                  {formatDate(
                    ticket.createdAt
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Last Updated
                </span>

                <strong>
                  {formatDate(
                    ticket.updatedAt
                  )}
                </strong>
              </div>

              <div>
                <span>Closed</span>

                <strong>
                  {formatDate(
                    ticket.closedAt
                  )}
                </strong>
              </div>
            </div>
          </article>

          <aside className="ticket-details-sidebar">

            <article className="ticket-person-card">
              <span className="ticket-person-label">
                Requested by
              </span>

              <div className="ticket-person-details">
                <span className="ticket-person-avatar">
                  {getInitials(
                    ticket.employee?.name
                  )}
                </span>

                <div>
                  <strong>
                    {ticket.employee?.name ||
                      "Unknown employee"}
                  </strong>

                  <small>
                    {ticket.employee?.email ||
                      "No email"}
                  </small>
                </div>
              </div>
            </article>

            <article className="ticket-person-card">
              <span className="ticket-person-label">
                Assigned agent
              </span>

              {ticket.assignedAgent ? (
                <div className="ticket-person-details">
                  <span className="ticket-person-avatar agent">
                    {getInitials(
                      ticket.assignedAgent
                        .name
                    )}
                  </span>

                  <div>
                    <strong>
                      {
                        ticket.assignedAgent
                          .name
                      }
                    </strong>

                    <small>
                      {
                        ticket.assignedAgent
                          .email
                      }
                    </small>
                  </div>
                </div>
              ) : (
                <p className="ticket-unassigned-text">
                  This ticket is currently
                  unassigned.
                </p>
              )}
            </article>

            <article className="ticket-work-card">
              <h2>Work Session</h2>

              {isWorking ? (
                <div className="ticket-work-active">
                  <span className="ticket-work-active-dot" />

                  <div>
                    <strong>
                      Work session active
                    </strong>

                    <p>
                      Working time is currently
                      being tracked.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="ticket-work-empty">
                  <strong>
                    No active work session
                  </strong>

                  <p>
                    {isAgent
                      ? "Start work to track the real time spent on this ticket."
                      : "Work time appears here when the assigned agent starts a session."}
                  </p>
                </div>
              )}

              <div className="ticket-total-work-time">
                <span>
                  Total working time
                </span>

                <strong>
                  {ticket.totalWorkMinutes ??
                    0}{" "}
                  minutes
                </strong>
              </div>
            </article>
          </aside>
        </section>

        {/* COMMENTS + TIMELINE */}

        <section className="ticket-details-bottom-grid">

          {/* COMMENTS */}

          <article className="ticket-details-placeholder-card ticket-comments-card">
            <div className="ticket-bottom-card-heading">
              <div>
                <span>
                  Conversation
                </span>

                <h2>Comments</h2>
              </div>

              <small>
                {comments.length} comment
                {comments.length === 1
                  ? ""
                  : "s"}
              </small>
            </div>

            <div className="ticket-comments-list">
              {commentsLoading ? (
                <p className="ticket-empty-copy">
                  Loading comments...
                </p>
              ) : commentsError ? (
                <p className="ticket-inline-error">
                  {commentsError}
                </p>
              ) : comments.length === 0 ? (
                <div className="ticket-empty-section">
                  <strong>
                    No comments yet
                  </strong>

                  <p>
                    Start the support conversation
                    below.
                  </p>
                </div>
              ) : (
                comments.map(
                  (comment, index) => (
                    <div
                      className="ticket-comment-item"
                      key={
                        comment.id ??
                        `${comment.createdAt}-${index}`
                      }
                    >
                      <span className="ticket-comment-avatar">
                        {getInitials(
                          getCommentUser(
                            comment
                          )
                        )}
                      </span>

                      <div className="ticket-comment-body">
                        <div className="ticket-comment-meta">
                          <strong>
                            {getCommentUser(
                              comment
                            )}
                          </strong>

                          <time>
                            {formatDate(
                              comment.createdAt
                            )}
                          </time>
                        </div>

                        <p>
                          {comment.comment ||
                            comment.text ||
                            comment.message}
                        </p>
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            {canComment && (
              <form
                className="ticket-comment-form"
                onSubmit={
                  handleAddComment
                }
              >
                <textarea
                  value={newComment}
                  onChange={(event) =>
                    setNewComment(
                      event.target.value
                    )
                  }
                  placeholder="Write a comment..."
                  maxLength={2000}
                />

                <div className="ticket-comment-form-footer">
                  <small>
                    Visible to everyone who can
                    access this ticket.
                  </small>

                  <button
                    type="submit"
                    disabled={
                      commentSubmitting ||
                      !newComment.trim()
                    }
                  >
                    {commentSubmitting
                      ? "Posting..."
                      : "Post Comment"}
                  </button>
                </div>
              </form>
            )}

            {!canComment && (
              <p className="ticket-readonly-note">
                Comments are read-only because
                this ticket is closed or
                cancelled.
              </p>
            )}
          </article>

          {/* ACTIVITY */}

          <article className="ticket-details-placeholder-card ticket-timeline-card">
            <div className="ticket-bottom-card-heading">
              <div>
                <span>
                  Ticket history
                </span>

                <h2>
                  Activity Timeline
                </h2>
              </div>

              <small>
                {combinedTimeline.length}{" "}
                update
                {combinedTimeline.length === 1
                  ? ""
                  : "s"}
              </small>
            </div>

            <div className="ticket-timeline-list">
              {timelineLoading ? (
                <p className="ticket-empty-copy">
                  Loading activity...
                </p>
              ) : combinedTimeline.length ===
                0 ? (
                <div className="ticket-empty-section">
                  <strong>
                    No activity yet
                  </strong>

                  <p>
                    Ticket changes will appear
                    here.
                  </p>
                </div>
              ) : (
                combinedTimeline.map(
                  (item, index) => (
                    <div
                      className="ticket-timeline-item"
                      key={
                        item.id ??
                        `${item.timelineType}-${index}`
                      }
                    >
                      <span className="ticket-timeline-dot" />

                      <div className="ticket-timeline-content">
                        <div className="ticket-timeline-meta">
                          <span>
                            {item.timelineType ===
                            "history"
                              ? "History"
                              : "Activity"}
                          </span>

                          <time>
                            {formatDate(
                              item.timelineDate
                            )}
                          </time>
                        </div>

                        <strong>
                          {getTimelineText(
                            item
                          )}
                        </strong>

                        {getTimelineUser(
                          item
                        ) && (
                          <p>
                            By{" "}
                            {getTimelineUser(
                              item
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </article>
        </section>

        {/* INTERNAL NOTES */}

        {!isEmployee && (
          <section className="ticket-internal-notes-card">
            <div className="ticket-bottom-card-heading">
              <div>
                <span>
                  Support only
                </span>

                <h2>
                  Internal Notes
                </h2>
              </div>
            </div>

            <div className="ticket-internal-note-warning">
              <strong>
                Internal notes need their own
                backend storage.
              </strong>

              <p>
                We are not sending these through
                normal comments because employees
                must never be able to see internal
                IT notes.
              </p>
            </div>
          </section>
        )}
      </main>
    </DashboardLayout>
  );
}

export default TicketDetails;