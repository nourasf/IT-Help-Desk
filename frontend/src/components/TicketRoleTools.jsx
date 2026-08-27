import { useEffect, useState } from "react";
import { approveTakeRequest, getAgentTicketHistory, getAssignmentOptions, getTakeRequest, rejectTakeRequest } from "../api/ticket";
import "../styles/tickets/TicketRoleTools.css";

const normalize = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
const role = () => normalize(localStorage.getItem("role") || sessionStorage.getItem("role"));

export default function TicketRoleTools() {
  const match = window.location.pathname.match(/^\/tickets\/(\d+)$/);
  const ticketId = match?.[1];
  const onManagerDashboard = window.location.pathname === "/manager-dashboard";
  const currentRole = role();
  const isManager = currentRole === "manager" || currentRole === "admin";
  const isAgent = currentRole === "agent" || currentRole === "it support agent";
  const [request, setRequest] = useState(null);
  const [dashboardRequests, setDashboardRequests] = useState([]);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadRequest() {
    if (!ticketId || !isManager) return;
    try { setRequest(await getTakeRequest(ticketId)); } catch { setRequest(null); }
  }

  async function loadDashboardRequests() {
    if (!onManagerDashboard || !isManager) return;
    try {
      const options = await getAssignmentOptions();
      const tickets = Array.isArray(options?.tickets) ? options.tickets : [];
      const results = await Promise.all(tickets.map(async (ticket) => {
        try {
          const pending = await getTakeRequest(ticket.id);
          return pending?.pending ? { ...pending, ticket } : null;
        } catch { return null; }
      }));
      setDashboardRequests(results.filter(Boolean));
    } catch { setDashboardRequests([]); }
  }

  useEffect(() => { loadRequest(); loadDashboardRequests(); }, [ticketId, currentRole, onManagerDashboard]);
  if ((!ticketId && !onManagerDashboard) || (!isManager && !isAgent)) return null;

  async function approve() {
    setBusy(true); setMessage("");
    try { const result = await approveTakeRequest(ticketId, request.agentId); setMessage(result.message); setRequest({ pending:false }); window.setTimeout(() => window.location.reload(), 650); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  async function reject() {
    setBusy(true); setMessage("");
    try { const result = await rejectTakeRequest(ticketId, request.agentId, "Manager declined the take request."); setMessage(result.message); setRequest({ pending:false }); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  async function decideDashboardRequest(item, accepted) {
    setBusyRequestId(item.requestId); setMessage("");
    try {
      const result = accepted
        ? await approveTakeRequest(item.ticket.id, item.agentId)
        : await rejectTakeRequest(item.ticket.id, item.agentId, "Manager declined the take request.");
      setMessage(result.message);
      setDashboardRequests((current) => current.filter((entry) => entry.requestId !== item.requestId));
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) { setMessage(error.message); }
    finally { setBusyRequestId(null); }
  }

  async function showHistory() {
    setBusy(true); setMessage("");
    try { setHistory(await getAgentTicketHistory(ticketId)); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  return <>
    {onManagerDashboard && isManager && dashboardRequests.length > 0 && <section className="manager-take-requests-panel">
      <div className="manager-take-requests-heading"><div><span>Approval queue</span><h2>Agent Take Requests</h2><p>Agents need your approval before an unassigned ticket becomes theirs.</p></div><b>{dashboardRequests.length}</b></div>
      <div className="manager-take-requests-list">{dashboardRequests.map((item) => <article key={item.requestId} className="manager-take-request-card">
        <button type="button" className="manager-take-request-ticket" onClick={() => { window.location.href = `/tickets/${item.ticket.id}`; }}><span>{item.ticket.ticketNumber}</span><strong>{item.ticket.subject}</strong><small>{item.ticket.category || "Support request"} · {item.ticket.priority || "Normal"} priority</small></button>
        <div className="manager-take-request-agent"><span>Requested by</span><strong>{item.agentName}</strong><small>{item.requestedAt ? new Date(item.requestedAt).toLocaleString() : "Waiting for approval"}</small></div>
        <div className="manager-take-request-actions"><button type="button" className="reject" disabled={busyRequestId === item.requestId} onClick={() => decideDashboardRequest(item, false)}>Reject</button><button type="button" className="accept" disabled={busyRequestId === item.requestId} onClick={() => decideDashboardRequest(item, true)}>{busyRequestId === item.requestId ? "Working..." : "Accept Request"}</button></div>
      </article>)}</div>
    </section>}
    {isManager && request?.pending && <section className="ticket-role-tool approval"><div><span>Agent take request</span><strong>{request.agentName} wants to take this ticket</strong><small>Approval is required before the ticket is assigned.</small></div><div className="ticket-role-tool-actions"><button type="button" onClick={reject} disabled={busy}>Reject</button><button type="button" className="primary" onClick={approve} disabled={busy}>Approve & Assign</button></div></section>}
    {ticketId && isAgent && <section className="ticket-role-tool history"><div><span>Ticket history</span><strong>Your recent involvement</strong><small>History remains available for 7 days after you stop working on the ticket.</small></div><button type="button" className="primary" onClick={showHistory} disabled={busy}>View History</button></section>}
    {message && <div className="ticket-role-tool-message">{message}</div>}
    {history && <div className="ticket-role-history-backdrop" onMouseDown={() => setHistory(null)}><section className="ticket-role-history-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><span>Agent history</span><h3>Ticket Timeline</h3></div><button type="button" onClick={() => setHistory(null)}>×</button></header><div>{history.length ? history.map((item) => <article key={item.id}><time>{new Date(item.createdAt).toLocaleString()}</time><strong>{item.action}</strong><p>{item.oldValue || "—"} → {item.newValue || "—"}</p><small>{item.changedBy?.name}</small></article>) : <p>No history has been recorded yet.</p>}</div></section></div>}
  </>;
}
