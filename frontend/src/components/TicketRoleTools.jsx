import { useEffect, useState } from "react";
import { approveTakeRequest, getAgentTicketHistory, getTakeRequest, rejectTakeRequest } from "../api/ticket";
import "../styles/tickets/TicketRoleTools.css";

const normalize = (value) => String(value || "").trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
const role = () => normalize(localStorage.getItem("role") || sessionStorage.getItem("role"));

export default function TicketRoleTools() {
  const match = window.location.pathname.match(/^\/tickets\/(\d+)$/);
  const ticketId = match?.[1];
  const currentRole = role();
  const isManager = currentRole === "manager" || currentRole === "admin";
  const isAgent = currentRole === "agent" || currentRole === "it support agent";
  const [request, setRequest] = useState(null);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRequest() {
    if (!ticketId || !isManager) return;
    try { setRequest(await getTakeRequest(ticketId)); } catch { setRequest(null); }
  }

  useEffect(() => { loadRequest(); }, [ticketId, currentRole]);
  if (!ticketId || (!isManager && !isAgent)) return null;

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

  async function showHistory() {
    setBusy(true); setMessage("");
    try { setHistory(await getAgentTicketHistory(ticketId)); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  return <>
    {isManager && request?.pending && <section className="ticket-role-tool approval"><div><span>Agent take request</span><strong>{request.agentName} wants to take this ticket</strong><small>Approval is required before the ticket is assigned.</small></div><div className="ticket-role-tool-actions"><button type="button" onClick={reject} disabled={busy}>Reject</button><button type="button" className="primary" onClick={approve} disabled={busy}>Approve & Assign</button></div></section>}
    {isAgent && <section className="ticket-role-tool history"><div><span>Ticket history</span><strong>Your recent involvement</strong><small>History remains available for 7 days after you stop working on the ticket.</small></div><button type="button" className="primary" onClick={showHistory} disabled={busy}>View History</button></section>}
    {message && <div className="ticket-role-tool-message">{message}</div>}
    {history && <div className="ticket-role-history-backdrop" onMouseDown={() => setHistory(null)}><section className="ticket-role-history-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><span>Agent history</span><h3>Ticket Timeline</h3></div><button type="button" onClick={() => setHistory(null)}>×</button></header><div>{history.length ? history.map((item) => <article key={item.id}><time>{new Date(item.createdAt).toLocaleString()}</time><strong>{item.action}</strong><p>{item.oldValue || "—"} → {item.newValue || "—"}</p><small>{item.changedBy?.name}</small></article>) : <p>No history has been recorded yet.</p>}</div></section></div>}
  </>;
}
