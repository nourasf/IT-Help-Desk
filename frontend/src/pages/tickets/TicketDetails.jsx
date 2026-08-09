import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  assignTicket,
  getAssignmentOptions,
  getTicketById,
  pauseWork,
  startWork,
} from "../../api/ticket";
import "../../styles/Tickets.css";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}
function getBadgeClass(value){return String(value||"").trim().toLowerCase().replaceAll(" ","-");}
function getInitials(name){if(!name)return"NA";return name.trim().split(/\s+/).map((part)=>part[0]).join("").slice(0,2).toUpperCase();}
function normalizeRole(role){return String(role||"").trim().toLowerCase().replaceAll("_"," ").replaceAll("-"," ");}
function getStoredRole(){return localStorage.getItem("role")||sessionStorage.getItem("role")||"";}

function TicketDetails(){
  const { id }=useParams();
  const navigate=useNavigate();
  const currentRole=normalizeRole(getStoredRole());
  const isManager=currentRole==="manager";
  const isAgent=currentRole==="it support agent"||currentRole==="agent";
  const [ticket,setTicket]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [workLoading,setWorkLoading]=useState(false);
  const [workMessage,setWorkMessage]=useState("");
  const [workError,setWorkError]=useState("");
  const [isWorking,setIsWorking]=useState(false);
  const [agents,setAgents]=useState([]);
  const [selectedAgentId,setSelectedAgentId]=useState("");
  const [assigning,setAssigning]=useState(false);
  const [assignmentMessage,setAssignmentMessage]=useState("");
  const [assignmentError,setAssignmentError]=useState("");

  const sortedAgents=useMemo(()=>[...agents].sort((a,b)=>Number(a.activeTickets||0)-Number(b.activeTickets||0)||String(a.name||"").localeCompare(String(b.name||""))),[agents]);
  const leastBusyAgent=sortedAgents[0]||null;

  useEffect(()=>{loadPage();},[id]);
  async function loadPage(){await Promise.all([loadTicket(),isManager?loadAgents():Promise.resolve()]);}
  async function loadTicket(){setLoading(true);setError("");try{const data=await getTicketById(id);setTicket(data);setIsWorking(Boolean(data.activeWorkSession));}catch(requestError){setError(requestError.message||"The ticket could not be loaded.");}finally{setLoading(false);}}
  async function loadAgents(){try{const data=await getAssignmentOptions();const availableAgents=Array.isArray(data.agents)?data.agents:[];setAgents(availableAgents);const currentAgentId=ticket?.assignedAgent?.id;if(currentAgentId){setSelectedAgentId(String(currentAgentId));}else if(availableAgents.length>0){const ordered=[...availableAgents].sort((a,b)=>Number(a.activeTickets||0)-Number(b.activeTickets||0));setSelectedAgentId(String(ordered[0].id));}}catch(requestError){setAssignmentError(requestError.message||"Agents could not be loaded.");}}
  useEffect(()=>{if(ticket?.assignedAgent?.id&&isManager)setSelectedAgentId(String(ticket.assignedAgent.id));},[ticket,isManager]);

  async function handleStartWork(){setWorkLoading(true);setWorkMessage("");setWorkError("");try{const result=await startWork(id);setIsWorking(true);setWorkMessage(result.message||"Work session started successfully.");await loadTicket();}catch(requestError){setWorkError(requestError.message||"The work session could not be started.");}finally{setWorkLoading(false);}}
  async function handlePauseWork(){setWorkLoading(true);setWorkMessage("");setWorkError("");try{const result=await pauseWork(id);setIsWorking(false);setWorkMessage(result.message||"Work session paused successfully.");await loadTicket();}catch(requestError){setWorkError(requestError.message||"The work session could not be paused.");}finally{setWorkLoading(false);}}
  async function performAssignment(agentId,automatic=false){if(!agentId){setAssignmentError("Choose an available support agent first.");return;}setAssigning(true);setAssignmentMessage("");setAssignmentError("");try{const result=await assignTicket(id,agentId);const agent=sortedAgents.find((item)=>Number(item.id)===Number(agentId));setAssignmentMessage(automatic?`Auto-assigned to ${agent?.name||"the least busy agent"}.`:result.message||`Assigned to ${agent?.name||"support agent"}.`);await Promise.all([loadTicket(),loadAgents()]);}catch(requestError){setAssignmentError(requestError.message||"The ticket could not be assigned.");}finally{setAssigning(false);}}

  if(loading)return <DashboardLayout activePage="tickets"><div className="ticket-details-state">Loading ticket...</div></DashboardLayout>;
  if(error)return <DashboardLayout activePage="tickets"><div className="ticket-details-state error"><h2>Could not load ticket</h2><p>{error}</p><button type="button" onClick={loadPage}>Try Again</button></div></DashboardLayout>;
  if(!ticket)return <DashboardLayout activePage="tickets"><div className="ticket-details-state error">Ticket not found.</div></DashboardLayout>;

  const assignmentLocked=["closed","cancelled"].includes(String(ticket.status||"").toLowerCase());

  return (
    <DashboardLayout activePage="tickets">
      <main className="ticket-details-page">
        <header className="ticket-details-header">
          <div>
            <button type="button" className="ticket-back-button" onClick={()=>navigate(-1)}>← Back</button>
            <span className="ticket-details-number">{ticket.ticketNumber}</span>
            <h1>{ticket.subject}</h1>
            <div className="ticket-details-badges">
              <span className={`ticket-details-badge priority-${getBadgeClass(ticket.priority)}`}>{ticket.priority}</span>
              <span className={`ticket-details-badge status-${getBadgeClass(ticket.status)}`}>{ticket.status}</span>
            </div>
          </div>
          <div className="ticket-details-header-actions">
            {isAgent&&<button type="button" className={isWorking?"ticket-pause-work-button":"ticket-start-work-button"} disabled={!ticket.canEdit||workLoading} onClick={isWorking?handlePauseWork:handleStartWork}>{workLoading?"Please wait...":isWorking?"Pause Work":"Start Work"}</button>}
          </div>
        </header>
        {workMessage&&<div className="ticket-work-message success">{workMessage}</div>}
        {workError&&<div className="ticket-work-message error">{workError}</div>}
        {ticket.isClosed&&<div className="ticket-closed-banner">This ticket is closed and is now read-only.</div>}

        {isManager&&(
          <section className="ticket-manager-assignment-card">
            <div className="ticket-manager-assignment-heading">
              <div><span>Manager action</span><h2>{ticket.assignedAgent?"Assignment":"This ticket needs an owner"}</h2><p>Review the request, assign it manually, or let SupportHub choose the agent with the lightest active workload.</p></div>
              {ticket.assignedAgent&&<div className="ticket-current-owner"><small>Current owner</small><strong>{ticket.assignedAgent.name}</strong></div>}
            </div>
            <div className="ticket-manager-assignment-grid">
              <div className="ticket-manual-assignment">
                <span>Manual assignment</span>
                <select value={selectedAgentId} onChange={(event)=>setSelectedAgentId(event.target.value)} disabled={assigning||assignmentLocked||sortedAgents.length===0}>
                  {sortedAgents.map((agent)=><option key={agent.id} value={agent.id}>{agent.name} · {agent.activeTickets} active</option>)}
                </select>
                <button type="button" disabled={assigning||assignmentLocked||!selectedAgentId} onClick={()=>performAssignment(selectedAgentId)}>{assigning?"Assigning...":ticket.assignedAgent?"Reassign Ticket":"Assign Ticket"}</button>
              </div>
              <div className="ticket-smart-assignment">
                <div><span>✦ Smart assignment</span><strong>{leastBusyAgent?.name||"No agent available"}</strong><p>{leastBusyAgent?`${leastBusyAgent.activeTickets} active ticket${Number(leastBusyAgent.activeTickets)===1?"":"s"} — currently the lightest workload.`:"There are no support agents available to receive this ticket."}</p></div>
                <button type="button" disabled={assigning||assignmentLocked||!leastBusyAgent} onClick={()=>performAssignment(leastBusyAgent?.id,true)}>{assigning?"Assigning...":"✦ Auto Assign"}</button>
              </div>
            </div>
            {assignmentMessage&&<p className="ticket-assignment-message success">{assignmentMessage}</p>}
            {assignmentError&&<p className="ticket-assignment-message error">{assignmentError}</p>}
          </section>
        )}

        <section className="ticket-details-grid">
          <article className="ticket-details-main-card">
            <div className="ticket-details-section-heading"><h2>Issue Description</h2></div>
            <p className="ticket-description">{ticket.description}</p>
            <div className="ticket-information-grid">
              <div><span>Category</span><strong>{ticket.category}</strong></div><div><span>Priority</span><strong>{ticket.priority}</strong></div><div><span>Status</span><strong>{ticket.status}</strong></div><div><span>Created</span><strong>{formatDate(ticket.createdAt)}</strong></div><div><span>Last Updated</span><strong>{formatDate(ticket.updatedAt)}</strong></div><div><span>Closed</span><strong>{formatDate(ticket.closedAt)}</strong></div>
            </div>
          </article>
          <aside className="ticket-details-sidebar">
            <article className="ticket-person-card"><span className="ticket-person-label">Requested by</span><div className="ticket-person-details"><span className="ticket-person-avatar">{getInitials(ticket.employee?.name)}</span><div><strong>{ticket.employee?.name||"Unknown employee"}</strong><small>{ticket.employee?.email||"No email"}</small></div></div></article>
            <article className="ticket-person-card"><span className="ticket-person-label">Assigned agent</span>{ticket.assignedAgent?<div className="ticket-person-details"><span className="ticket-person-avatar agent">{getInitials(ticket.assignedAgent.name)}</span><div><strong>{ticket.assignedAgent.name}</strong><small>{ticket.assignedAgent.email}</small></div></div>:<p className="ticket-unassigned-text">This ticket is currently unassigned.</p>}</article>
            <article className="ticket-work-card"><h2>Work Session</h2>{isWorking?<div className="ticket-work-active"><span className="ticket-work-active-dot"/><div><strong>Work session active</strong><p>Your working time is currently being tracked.</p></div></div>:<div className="ticket-work-empty"><strong>No active work session</strong><p>{isAgent?"Start work to track the real time spent on this ticket.":"Work time appears here when an assigned agent starts a session."}</p></div>}<div className="ticket-total-work-time"><span>Total working time</span><strong>{ticket.totalWorkMinutes??0} minutes</strong></div></article>
          </aside>
        </section>
        <section className="ticket-details-bottom-grid"><article className="ticket-details-placeholder-card"><h2>Comments</h2><p>Ticket comments and support conversation will appear here.</p></article><article className="ticket-details-placeholder-card"><h2>Activity Timeline</h2><p>Status changes, assignments and work sessions will appear here.</p></article></section>
      </main>
    </DashboardLayout>
  );
}

export default TicketDetails;
