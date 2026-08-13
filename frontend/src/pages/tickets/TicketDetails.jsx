import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  addInternalNote,
  addTicketComment,
  uploadCommentAttachments,
  assignTicket,
  cancelTicket,
  closeTicket,
  escalateTicket,
  getAssignmentOptions,
  getInternalNotes,
  getTicketActivity,
  getTicketById,
  getTicketComments,
  getTicketHistory,
  managerReopenTicket,
  pauseWork,
  resolveTicket,
  returnTicketToManager,
  startWork,
  getAttachmentBlobUrl,
} from "../../api/ticket";
import "../../styles/Tickets.css";
import "../../styles/TicketWorkflow.css";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function normalizeRole(role) { return String(role || "").trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " "); }
function getStoredRole() { return localStorage.getItem("role") || sessionStorage.getItem("role") || ""; }
function getBadgeClass(value) { return String(value || "").trim().toLowerCase().replaceAll(" ", "-"); }
function getInitials(name) { return String(name || "NA").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function getCommentUser(comment) { return comment.author?.name || comment.user?.name || comment.userName || comment.authorName || "User"; }
function timelineText(item) { return item.description || item.action || item.activityType || "Ticket updated"; }
function timelineUser(item) { return item.performedBy?.name || item.changedBy?.name || item.user?.name || ""; }


function TicketAttachmentImage({ ticketId, attachment }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    async function loadImage() {
      try {
        objectUrl = await getAttachmentBlobUrl(
          ticketId,
          attachment.id
        );

        if (!cancelled) {
          setSrc(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [ticketId, attachment.id]);

  if (failed) {
    return (
      <div className="ticket-attachment-failed">
        {attachment.fileName}
      </div>
    );
  }

  if (!src) {
    return (
      <div className="ticket-attachment-loading">
        Loading image...
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={attachment.fileName}
      className="ticket-comment-image"
    />
  );
}

function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = normalizeRole(getStoredRole());
  const isManager = role === "manager";
  const isAdmin = role === "admin";
  const isEmployee = role === "employee";
  const isAgent = role === "it support agent" || role === "agent";

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentFiles, setCommentFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteFiles, setNoteFiles] = useState([]);
  const [activity, setActivity] = useState([]);
  const [history, setHistory] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [workLoading, setWorkLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [action, setAction] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [stopOutcome, setStopOutcome] = useState("no-issue");

  const sortedAgents = useMemo(() => [...agents].sort((a, b) => Number(a.activeTickets || 0) - Number(b.activeTickets || 0) || String(a.name || "").localeCompare(String(b.name || ""))), [agents]);
  const leastBusyAgent = sortedAgents[0] || null;

  async function loadTicket() {
    const data = await getTicketById(id);
    setTicket(data);
    setIsWorking(Boolean(data.activeWorkSession));
  }
  async function loadComments() { setComments(await getTicketComments(id)); }
  async function loadAgents() {
    if (!isManager) return;
    const data = await getAssignmentOptions();
    setAgents(data.agents || []);
  }
  async function loadTimeline() {
    if (isEmployee) { setActivity([]); setHistory([]); return; }
    setActivity(await getTicketActivity(id));
    if (isManager || isAdmin) setHistory(await getTicketHistory(id));
    else setHistory([]);
  }
  async function loadNotes() {
    if (isEmployee) return;
    try { setNotes(await getInternalNotes(id)); } catch { setNotes([]); }
  }
  async function loadPage() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadTicket(), loadComments(), loadAgents(), loadTimeline(), loadNotes()]);
    } catch (requestError) {
      setError(requestError.message || "The ticket could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => { loadPage(); }, [id]);
  useEffect(() => {
    if (ticket?.assignedAgent?.id && isManager) setSelectedAgentId(String(ticket.assignedAgent.id));
    else if (isManager && !selectedAgentId && leastBusyAgent) setSelectedAgentId(String(leastBusyAgent.id));
  }, [ticket, isManager, leastBusyAgent]);

  function showMessage(text, tone = "success") { setMessage(text || ""); setMessageTone(tone); }

  async function performAssignment(agentId, automatic = false) {
    if (!agentId) return;
    setAssigning(true); showMessage("");
    try {
      const result = await assignTicket(id, agentId);
      setAssignmentMessage(automatic ? `Auto-assigned to ${leastBusyAgent?.name || "the least busy agent"}.` : result.message || "Ticket assigned.");
      await Promise.all([loadTicket(), loadAgents(), loadTimeline()]);
    } catch (e) { showMessage(e.message, "error"); } finally { setAssigning(false); }
  }

  async function handleWork() {
    setWorkLoading(true); showMessage("");
    try {
      const result = isWorking ? await pauseWork(id) : await startWork(id);
      showMessage(result.message || "Work session updated.");
      await Promise.all([loadTicket(), loadTimeline()]);
    } catch (e) { showMessage(e.message, "error"); } finally { setWorkLoading(false); }
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!newComment.trim()) return;

    setCommentSubmitting(true);
    showMessage("");

    try {
      const result = await addTicketComment(id, newComment);
      const commentId = result.comment?.id;

      if (commentFiles.length > 0 && commentId) {
        await uploadCommentAttachments(id, commentId, commentFiles);
      }

      setNewComment("");
      setCommentFiles([]);
      await Promise.all([loadComments(), loadTimeline()]);
    } catch (e) {
      showMessage(e.message, "error");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function submitReply(event, parentCommentId) {
    event.preventDefault();
    if (!replyText.trim()) return;

    setReplySubmitting(true);
    showMessage("");

    try {
      const result = await addTicketComment(id, replyText, parentCommentId);
      const replyId = result.comment?.id;

      if (replyFiles.length > 0 && replyId) {
        await uploadCommentAttachments(id, replyId, replyFiles);
      }

      setReplyText("");
      setReplyFiles([]);
      setReplyingTo(null);
      await Promise.all([loadComments(), loadTimeline()]);
    } catch (e) {
      showMessage(e.message, "error");
    } finally {
      setReplySubmitting(false);
    }
  }

  async function submitInternalNote(event) {
    event.preventDefault();
    if (!newNote.trim()) return;

    setNoteSubmitting(true);
    showMessage("");

    try {
      const result = await addInternalNote(id, newNote);
      const noteId = result.note?.id;

      if (noteFiles.length > 0 && noteId) {
        await uploadCommentAttachments(id, noteId, noteFiles);
      }

      setNewNote("");
      setNoteFiles([]);
      await Promise.all([loadNotes(), loadTimeline()]);
    } catch (e) {
      showMessage(e.message, "error");
    } finally {
      setNoteSubmitting(false);
    }
  }

  function openAction(name) {
    setAction(name);
    setActionNote("");
    showMessage("");
    if (name === "stop") setStopOutcome("no-issue");
  }

  async function runAction() {
    if (!action) return;
    const note = actionNote.trim();
    if (["resolve", "escalate", "reopen", "stop"].includes(action) && !note) {
      showMessage("Please add a reason or note first.", "error");
      return;
    }

    setActionLoading(true); showMessage("");
    try {
      let result;
      let returnedToManager = false;

      if (action === "resolve") result = await resolveTicket(id, note);
      if (action === "escalate") result = await escalateTicket(id, note);
      if (action === "close") result = await closeTicket(id);
      if (action === "reopen") result = await managerReopenTicket(id, note);
     if (action === "stop" && stopOutcome === "no-issue") {
  result = await cancelTicket(id, `No issue found: ${note}`);
  returnedToManager = true;
}

if (action === "stop" && stopOutcome === "could-not-solve") {
  result = await returnTicketToManager(id, note);
  returnedToManager = true;
}

      showMessage(result?.message || "Ticket updated.");
      setAction("");
      setActionNote("");

      if (returnedToManager && isAgent) {
        navigate("/agent-dashboard", { replace: true });
        return;
      }

      await loadPage();
    } catch (e) {
      showMessage(e.message, "error");
    } finally { setActionLoading(false); }
  }

  if (loading) return <DashboardLayout activePage="tickets"><div className="ticket-details-state">Loading ticket...</div></DashboardLayout>;
  if (error || !ticket) return <DashboardLayout activePage="tickets"><div className="ticket-details-state error"><h2>Could not load ticket</h2><p>{error || "Ticket not found."}</p><button type="button" onClick={loadPage}>Try Again</button></div></DashboardLayout>;

  const status = String(ticket.status || "").toLowerCase();
  const isResolved = status === "resolved";
  const isClosed = status === "closed";
  const isCancelled = status === "cancelled";
  const assignmentLocked = isClosed || isCancelled || isResolved;
  const canComment = !isClosed && (isEmployee || isAgent);
  const canReopen = (isManager || isAdmin) && (isResolved || isClosed || isCancelled);
  const combinedTimeline = [...activity.map((item) => ({ ...item, source: "Activity", at: item.createdAt })), ...history.map((item) => ({ ...item, source: "History", at: item.createdAt }))]
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  return (
    <DashboardLayout activePage={isAdmin ? "admin-tickets" : "tickets"}>
      <main className="ticket-details-page">
        <header className="ticket-details-header">
          <div>
            <button className="ticket-back-button" type="button" onClick={() => navigate(-1)}>← Back</button>
            <span className="ticket-details-number">{ticket.ticketNumber}</span>
            <h1>{ticket.subject}</h1>
            <div className="ticket-details-badges"><span className={`ticket-details-badge priority-${getBadgeClass(ticket.priority)}`}>{ticket.priority}</span><span className={`ticket-details-badge status-${getBadgeClass(ticket.status)}`}>{ticket.status}</span></div>
          </div>
          {isAgent && !isResolved && !isClosed && !isCancelled && <button type="button" className={isWorking ? "ticket-pause-work-button" : "ticket-start-work-button"} onClick={handleWork} disabled={workLoading || !ticket.canEdit}>{workLoading ? "Please wait..." : isWorking ? "Pause Work" : "Start Work"}</button>}
        </header>

        {message && <div className={`ticket-work-message ${messageTone}`}>{message}</div>}

        {(isAgent || isManager || isAdmin) && (
          <section className="ticket-action-bar">
            <div><span>Ticket actions</span><strong>Manage this ticket safely</strong></div>
            <div className="ticket-action-buttons">
              {isAgent && !isResolved && !isClosed && !isCancelled && <button className="ticket-action resolve" type="button" onClick={() => openAction("resolve")}>Resolve</button>}
              {isAgent && !isResolved && !isClosed && !isCancelled && <button className="ticket-action escalate" type="button" onClick={() => openAction("escalate")}>Escalate</button>}
              {isAgent && !isResolved && !isClosed && !isCancelled && <button className="ticket-action cancel" type="button" onClick={() => openAction("stop")}>Stop Working</button>}
              {(isManager || isAdmin) && isResolved && <button className="ticket-action close" type="button" onClick={() => openAction("close")}>Close Ticket</button>}
              {canReopen && <button className="ticket-action reopen" type="button" onClick={() => openAction("reopen")}>Reopen Ticket</button>}
            </div>
          </section>
        )}

        {action && (
          <div className="ticket-action-modal-backdrop" role="presentation" onMouseDown={() => !actionLoading && setAction("")}>
            <section className="ticket-action-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
              <header><div><span>Confirm action</span><h3>{action === "stop" ? "Stop working on this ticket" : `${action[0].toUpperCase()}${action.slice(1)} ticket`}</h3></div><button type="button" onClick={() => setAction("")} aria-label="Close">×</button></header>
              {action === "stop" && <div className="ticket-stop-options"><button type="button" className={stopOutcome === "no-issue" ? "selected" : ""} onClick={() => setStopOutcome("no-issue")}><strong>No issue found</strong><span>Cancel the ticket because no reproducible issue was found.</span></button><button type="button" className={stopOutcome === "could-not-solve" ? "selected" : ""} onClick={() => setStopOutcome("could-not-solve")}><strong>Could not solve it</strong><span>Return it to the manager, unassign me and preserve the history for reassignment.</span></button></div>}
              {action !== "close" && <textarea value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder={action === "resolve" ? "Resolution notes..." : "Reason / notes..."} />}
              {action === "close" && <p className="ticket-action-confirmation">This closes the resolved ticket and makes it read-only. A manager can reopen it later if the issue returns.</p>}
              <footer><button type="button" className="secondary" onClick={() => setAction("")} disabled={actionLoading}>Back</button><button type="button" className="primary" onClick={runAction} disabled={actionLoading}>{actionLoading ? "Updating..." : "Confirm"}</button></footer>
            </section>
          </div>
        )}

        {isManager && (
          <section className="ticket-manager-assignment-card">
            <div className="ticket-manager-assignment-heading"><div><span>Manager action</span><h2>{ticket.assignedAgent ? "Assignment" : "This ticket needs an owner"}</h2><p>Assign manually or choose the least busy agent. Reopened and returned tickets remain in history and can be assigned again.</p></div>{ticket.assignedAgent && <div className="ticket-current-owner"><small>Current owner</small><strong>{ticket.assignedAgent.name}</strong></div>}</div>
            <div className="ticket-manager-assignment-grid">
              <div className="ticket-manual-assignment"><span>Manual assignment</span><select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} disabled={assigning || assignmentLocked || !sortedAgents.length}>{sortedAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.activeTickets} active</option>)}</select><button type="button" disabled={assigning || assignmentLocked || !selectedAgentId} onClick={() => performAssignment(selectedAgentId)}>{assigning ? "Assigning..." : ticket.assignedAgent ? "Reassign Ticket" : "Assign Ticket"}</button></div>
              <div className="ticket-smart-assignment"><div><span>✦ Smart assignment</span><strong>{leastBusyAgent?.name || "No agent available"}</strong><p>{leastBusyAgent ? `${leastBusyAgent.activeTickets} active ticket${Number(leastBusyAgent.activeTickets) === 1 ? "" : "s"}` : "No support agents available."}</p></div><button type="button" disabled={assigning || assignmentLocked || !leastBusyAgent} onClick={() => performAssignment(leastBusyAgent?.id, true)}>✦ Auto Assign</button></div>
            </div>
            {assignmentMessage && <p className="ticket-assignment-message success">{assignmentMessage}</p>}
          </section>
        )}

        <section className="ticket-details-grid">
          <article className="ticket-details-main-card"><div className="ticket-details-section-heading"><h2>Issue Description</h2></div><p className="ticket-description">{ticket.description}</p><div className="ticket-information-grid"><div><span>Category</span><strong>{ticket.category}</strong></div><div><span>Priority</span><strong>{ticket.priority}</strong></div><div><span>Status</span><strong>{ticket.status}</strong></div><div><span>Created</span><strong>{formatDate(ticket.createdAt)}</strong></div><div><span>Last Updated</span><strong>{formatDate(ticket.updatedAt)}</strong></div><div><span>Closed</span><strong>{formatDate(ticket.closedAt)}</strong></div></div></article>
          <aside className="ticket-details-sidebar"><article className="ticket-person-card"><span className="ticket-person-label">Requested by</span><div className="ticket-person-details"><span className="ticket-person-avatar">{getInitials(ticket.employee?.name)}</span><div><strong>{ticket.employee?.name || "Unknown employee"}</strong><small>{ticket.employee?.email || "No email"}</small></div></div></article><article className="ticket-person-card"><span className="ticket-person-label">Assigned agent</span>{ticket.assignedAgent ? <div className="ticket-person-details"><span className="ticket-person-avatar agent">{getInitials(ticket.assignedAgent.name)}</span><div><strong>{ticket.assignedAgent.name}</strong><small>{ticket.assignedAgent.email}</small></div></div> : <p className="ticket-unassigned-text">This ticket is currently unassigned.</p>}</article><article className="ticket-work-card"><h2>Work Session</h2><div className={isWorking ? "ticket-work-active" : "ticket-work-empty"}><strong>{isWorking ? "Work session active" : "No active work session"}</strong><p>{isWorking ? "Working time is being tracked." : "Real working time is preserved across sessions and assignments."}</p></div><div className="ticket-total-work-time"><span>Total working time</span><strong>{ticket.totalWorkMinutes ?? 0} minutes</strong></div></article></aside>
        </section>

        <section className="ticket-details-bottom-grid">
          <article className="ticket-details-placeholder-card ticket-comments-card">
            <div className="ticket-bottom-card-heading">
              <div>
                <span>Conversation</span>
                <h2>Comments</h2>
              </div>
              <small>
                {comments.length} comment{comments.length === 1 ? "" : "s"}
              </small>
            </div>

            <div className="ticket-comments-list">
              {comments.filter((comment) => !comment.parentCommentID).length ? (
                comments
                  .filter((comment) => !comment.parentCommentID)
                  .map((comment) => {
                    const replies = comments.filter(
                      (reply) => reply.parentCommentID === comment.id
                    );

                    return (
                      <div className="ticket-comment-item" key={comment.id}>
                        <span className="ticket-comment-avatar">
                          {getInitials(getCommentUser(comment))}
                        </span>

                        <div className="ticket-comment-body">
                          <div className="ticket-comment-meta">
                            <strong>{getCommentUser(comment)}</strong>
                            <time>{formatDate(comment.createdAt)}</time>
                          </div>

                          <p>{comment.comment}</p>

                          {comment.attachments?.length > 0 && (
                            <div className="ticket-comment-attachments">
                              {comment.attachments.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={`http://localhost:5099${attachment.downloadUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ticket-comment-attachment"
                                >
                                  {attachment.contentType?.startsWith("image/") ? (
                                   <TicketAttachmentImage
  ticketId={id}
  attachment={attachment}
/>
                                  ) : (
                                    <span>{attachment.fileName}</span>
                                  )}
                                </a>
                              ))}
                            </div>
                          )}

                          {canComment && (
                            <button
                              type="button"
                              className="ticket-comment-reply-button"
                              onClick={() => {
                                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                setReplyText("");
                                setReplyFiles([]);
                              }}
                            >
                              Reply
                            </button>
                          )}

                          {replyingTo === comment.id && canComment && (
                            <form
                              className="ticket-reply-form"
                              onSubmit={(event) => submitReply(event, comment.id)}
                            >
                              <textarea
                                value={replyText}
                                onChange={(event) => setReplyText(event.target.value)}
                                placeholder={`Reply to ${getCommentUser(comment)}...`}
                              />

                              {replyFiles.length > 0 && (
                                <div className="ticket-comment-files">
                                  {replyFiles.map((file, index) => (
                                    <div
                                      className="ticket-comment-file"
                                      key={`${file.name}-${index}`}
                                    >
                                      <span>{file.name}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReplyFiles((current) =>
                                            current.filter((_, i) => i !== index)
                                          )
                                        }
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="ticket-reply-actions">
                                <label className="ticket-attach-button">
                                  Attach screenshot
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    multiple
                                    hidden
                                    onChange={(event) => {
                                      const files = Array.from(event.target.files || []);
                                      setReplyFiles((current) => [...current, ...files]);
                                      event.target.value = "";
                                    }}
                                  />
                                </label>

                                <button
                                  type="button"
                                  className="ticket-reply-cancel"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText("");
                                    setReplyFiles([]);
                                  }}
                                >
                                  Cancel
                                </button>

                                <button
                                  type="submit"
                                  disabled={replySubmitting || !replyText.trim()}
                                >
                                  {replySubmitting ? "Replying..." : "Reply"}
                                </button>
                              </div>
                            </form>
                          )}

                          {replies.length > 0 && (
                            <div className="ticket-comment-replies">
                              {replies.map((reply) => (
                                <div className="ticket-comment-item reply" key={reply.id}>
                                  <span className="ticket-comment-avatar">
                                    {getInitials(getCommentUser(reply))}
                                  </span>

                                  <div className="ticket-comment-body">
                                    <div className="ticket-comment-meta">
                                      <strong>{getCommentUser(reply)}</strong>
                                      <time>{formatDate(reply.createdAt)}</time>
                                    </div>

                                    <p>{reply.comment}</p>

                                    {reply.attachments?.length > 0 && (
                                      <div className="ticket-comment-attachments">
                                        {reply.attachments.map((attachment) => (
                                          <a
                                            key={attachment.id}
                                            href={`http://localhost:5099${attachment.downloadUrl}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="ticket-comment-attachment"
                                          >
                                            {attachment.contentType?.startsWith("image/") ? (
                                            <TicketAttachmentImage
  ticketId={id}
  attachment={attachment}
/>
                                            ) : (
                                              <span>{attachment.fileName}</span>
                                            )}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="ticket-empty-section">
                  <strong>No comments yet</strong>
                  <p>Start the support conversation below.</p>
                </div>
              )}
            </div>

            {canComment && (
              <form className="ticket-comment-form" onSubmit={submitComment}>
                <textarea
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Write a comment..."
                />

                {commentFiles.length > 0 && (
                  <div className="ticket-comment-files">
                    {commentFiles.map((file, index) => (
                      <div className="ticket-comment-file" key={`${file.name}-${index}`}>
                        <span>{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCommentFiles((current) =>
                              current.filter((_, i) => i !== index)
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="ticket-comment-form-footer">
                  <div>
                    <label className="ticket-attach-button">
                      Attach screenshot
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        hidden
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          setCommentFiles((current) => [...current, ...files]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <small>Visible to the employee and assigned IT agent.</small>
                  </div>

                  <button
                    type="submit"
                    disabled={commentSubmitting || !newComment.trim()}
                  >
                    {commentSubmitting ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </form>
            )}
          </article>

          {!isEmployee && (
            <article className="ticket-details-placeholder-card ticket-timeline-card">
              <div className="ticket-bottom-card-heading">
                <div>
                  <span>Ticket history</span>
                  <h2>Activity Timeline</h2>
                </div>
                <small>{combinedTimeline.length} updates</small>
              </div>
              <div className="ticket-timeline-list">
                {combinedTimeline.length ? (
                  combinedTimeline.map((item, index) => (
                    <div className="ticket-timeline-item" key={`${item.source}-${item.id || index}`}>
                      <span className="ticket-timeline-dot" />
                      <div className="ticket-timeline-content">
                        <div className="ticket-timeline-meta">
                          <span>{item.source}</span>
                          <time>{formatDate(item.at)}</time>
                        </div>
                        <strong>{timelineText(item)}</strong>
                        {timelineUser(item) && <p>By {timelineUser(item)}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="ticket-empty-section">
                    <strong>No activity yet</strong>
                    <p>Ticket changes will appear here.</p>
                  </div>
                )}
              </div>
            </article>
          )}
        </section>

        {!isEmployee && (
          <section className="ticket-internal-notes-card">
            <div className="ticket-bottom-card-heading">
              <div>
                <span>Support only</span>
                <h2>Internal Notes</h2>
              </div>
              <small>Hidden from employees</small>
            </div>

            <div className="ticket-comments-list">
              {notes.length ? (
                notes.map((note) => (
                  <div className="ticket-comment-item" key={note.id}>
                    <span className="ticket-comment-avatar">
                      {getInitials(note.author?.name)}
                    </span>
                    <div className="ticket-comment-body">
                      <div className="ticket-comment-meta">
                        <strong>{note.author?.name || "Support"}</strong>
                        <time>{formatDate(note.createdAt)}</time>
                      </div>
                      <p>{note.note}</p>

                      {note.attachments?.length > 0 && (
                        <div className="ticket-comment-attachments">
                          {note.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={`http://localhost:5099${attachment.downloadUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ticket-comment-attachment"
                            >
                              {attachment.contentType?.startsWith("image/") ? (
                              <TicketAttachmentImage
  ticketId={id}
  attachment={attachment}
/>
                              ) : (
                                <span>{attachment.fileName}</span>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="ticket-empty-section">
                  <strong>No internal notes</strong>
                  <p>Private support notes stay hidden from the employee.</p>
                </div>
              )}
            </div>

            {!isClosed && (
              <form className="ticket-comment-form" onSubmit={submitInternalNote}>
                <textarea
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Write a private internal note..."
                />

                {noteFiles.length > 0 && (
                  <div className="ticket-comment-files">
                    {noteFiles.map((file, index) => (
                      <div className="ticket-comment-file" key={`${file.name}-${index}`}>
                        <span>{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setNoteFiles((current) =>
                              current.filter((_, i) => i !== index)
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="ticket-comment-form-footer">
                  <div>
                    <label className="ticket-attach-button">
                      Attach screenshot
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        hidden
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          setNoteFiles((current) => [...current, ...files]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <small>Only IT agents, managers and admins can see this.</small>
                  </div>

                  <button
                    type="submit"
                    disabled={noteSubmitting || !newNote.trim()}
                  >
                    {noteSubmitting ? "Saving..." : "Add Internal Note"}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
      </main>
    </DashboardLayout>
  );
}

export default TicketDetails;