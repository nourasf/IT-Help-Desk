import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  addInternalNote, addTicketComment, uploadCommentAttachments, assignTicket,
  cancelTicket, closeTicket, escalateTicket, getAssignmentOptions, getInternalNotes,
  getTicketActivity, getTicketAttachments, getTicketById, getTicketComments,
  getTicketHistory, managerReopenTicket, pauseWork, resolveTicket,
  returnTicketToManager, startWork, getAttachmentBlobUrl,
} from "../../api/ticket";
import "../../styles/Tickets.css";
import "../../styles/TicketWorkflow.css";

const normalize = (v) => String(v || "").trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
const badge = (v) => normalize(v).replaceAll(" ", "-");
const initials = (v) => String(v || "NA").trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const role = () => normalize(localStorage.getItem("role") || sessionStorage.getItem("role"));
const author = (c) => c.author?.name || c.user?.name || c.userName || c.authorName || "User";
function date(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString([], { month:"short", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
function bytes(value) { const n = Number(value || 0); return n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`; }

function Attachment({ ticketId, item }) {
  const [busy, setBusy] = useState(false);
  async function open() { setBusy(true); try { const url = await getAttachmentBlobUrl(ticketId, item.id); window.open(url, "_blank", "noopener,noreferrer"); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (e) { window.alert(e.message); } finally { setBusy(false); } }
  return <button className="tw-file" type="button" onClick={open} disabled={busy}><span className="tw-file-icon">{item.contentType?.startsWith("image/") ? "IMG" : "FILE"}</span><span><strong>{item.fileName}</strong><small>{bytes(item.fileSize)} · {date(item.uploadedAt)}</small></span><b>{busy ? "Opening…" : "Open"}</b></button>;
}
function Files({ ticketId, items=[] }) { return items.length ? <div className="tw-files">{items.map((x) => <Attachment key={x.id} ticketId={ticketId} item={x}/>)}</div> : null; }
function ChosenFiles({ files, setFiles }) { return files.length ? <div className="tw-chips">{files.map((f,i)=><span key={`${f.name}-${i}`}>{f.name}<button type="button" onClick={()=>setFiles((a)=>a.filter((_,n)=>n!==i))}>×</button></span>)}</div> : null; }

export default function TicketDetails() {
  const { id } = useParams(); const navigate = useNavigate(); const userRole = role();
  const isManager=userRole==="manager", isAdmin=userRole==="admin", isEmployee=userRole==="employee", isAgent=["agent","it support agent"].includes(userRole);
  const [ticket,setTicket]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [comments,setComments]=useState([]), [notes,setNotes]=useState([]), [activity,setActivity]=useState([]), [history,setHistory]=useState([]), [attachments,setAttachments]=useState([]), [agents,setAgents]=useState([]);
  const [selectedAgent,setSelectedAgent]=useState(""), [working,setWorking]=useState(false), [busy,setBusy]=useState(false), [message,setMessage]=useState(""), [tone,setTone]=useState("success");
  const [comment,setComment]=useState(""), [commentFiles,setCommentFiles]=useState([]), [note,setNote]=useState(""), [noteFiles,setNoteFiles]=useState([]);
  const [action,setAction]=useState(""), [actionNote,setActionNote]=useState(""), [stopChoice,setStopChoice]=useState("no-issue"), [historyOpen,setHistoryOpen]=useState(false);

  const sortedAgents=useMemo(()=>[...agents].sort((a,b)=>Number(a.activeTickets||0)-Number(b.activeTickets||0)||String(a.name).localeCompare(String(b.name))),[agents]);
  const leastBusy=sortedAgents[0];
  const status=normalize(ticket?.status), isResolved=status==="resolved", isClosed=status==="closed", isCancelled=["cancelled","canceled"].includes(status);
  const readOnly=isClosed||isCancelled;
  const timeline=useMemo(()=>[...activity.map(x=>({...x,kind:"Activity",at:x.createdAt})),...history.map(x=>({...x,kind:"History",at:x.createdAt}))].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0)),[activity,history]);

  async function load() {
    setLoading(true); setError("");
    try {
      const jobs=[getTicketById(id),getTicketComments(id),getTicketAttachments(id)];
      const [t,c,a]=await Promise.all(jobs); setTicket(t); setWorking(Boolean(t.activeWorkSession)); setComments(c); setAttachments(a);
      if(isManager){const opts=await getAssignmentOptions();setAgents(opts.agents||[]);}
      if(!isEmployee){try{setActivity(await getTicketActivity(id));}catch{setActivity([]);} try{setNotes(await getInternalNotes(id));}catch{setNotes([]);}}
      if(isManager||isAdmin){try{setHistory(await getTicketHistory(id));}catch{setHistory([]);}}
    } catch(e){setError(e.message||"The ticket could not be loaded.");} finally{setLoading(false);}
  }
  useEffect(()=>{load();},[id]);
  useEffect(()=>{if(!isManager)return; if(ticket?.assignedAgent?.id)setSelectedAgent(String(ticket.assignedAgent.id)); else if(!selectedAgent&&leastBusy)setSelectedAgent(String(leastBusy.id));},[ticket,leastBusy,isManager]);

  async function refreshConversation(){setComments(await getTicketComments(id));setAttachments(await getTicketAttachments(id));if(!isEmployee){try{setNotes(await getInternalNotes(id));}catch{}}}
  async function doWork(){setBusy(true);try{const r=working?await pauseWork(id):await startWork(id);setMessage(r.message||"Work session updated.");setTone("success");await load();}catch(e){setMessage(e.message);setTone("error");}finally{setBusy(false);}}
  async function assign(agentId){if(!agentId)return;setBusy(true);try{const r=await assignTicket(id,agentId);setMessage(r.message||"Ticket assigned.");setTone("success");await load();}catch(e){setMessage(e.message);setTone("error");}finally{setBusy(false);}}
  async function postComment(e){e.preventDefault();if(!comment.trim())return;setBusy(true);try{const r=await addTicketComment(id,comment);if(commentFiles.length&&r.comment?.id)await uploadCommentAttachments(id,r.comment.id,commentFiles);setComment("");setCommentFiles([]);await refreshConversation();}catch(e2){setMessage(e2.message);setTone("error");}finally{setBusy(false);}}
  async function postNote(e){e.preventDefault();if(!note.trim())return;setBusy(true);try{const r=await addInternalNote(id,note);if(noteFiles.length&&r.note?.id)await uploadCommentAttachments(id,r.note.id,noteFiles);setNote("");setNoteFiles([]);await refreshConversation();}catch(e2){setMessage(e2.message);setTone("error");}finally{setBusy(false);}}
  function openAction(name){setAction(name);setActionNote("");if(name==="stop")setStopChoice("no-issue");}
  async function runAction(){const text=actionNote.trim();if(["resolve","escalate","reopen","stop","close"].includes(action)&&!text){setMessage("Please add a reason or note first.");setTone("error");return;}setBusy(true);try{let r,leave=false;if(action==="resolve")r=await resolveTicket(id,text);if(action==="escalate"){r=await escalateTicket(id,text);leave=true;}if(action==="close")r=await closeTicket(id,text);if(action==="reopen")r=await managerReopenTicket(id,text);if(action==="stop"&&stopChoice==="no-issue"){r=await cancelTicket(id,text);leave=true;}if(action==="stop"&&stopChoice==="could-not-solve"){r=await returnTicketToManager(id,text);leave=true;}setAction("");if(leave&&isAgent){navigate("/agent-dashboard",{replace:true});return;}setMessage(r?.message||"Ticket updated.");setTone("success");await load();}catch(e){setMessage(e.message);setTone("error");}finally{setBusy(false);}}

  if(loading)return <DashboardLayout activePage="tickets"><div className="tw-state">Loading ticket…</div></DashboardLayout>;
  if(error||!ticket)return <DashboardLayout activePage="tickets"><div className="tw-state"><h2>Could not load ticket</h2><p>{error}</p><button onClick={load}>Try again</button></div></DashboardLayout>;
  const standalone=attachments.filter(a=>!a.ticketCommentId);

  return <DashboardLayout activePage={isAdmin?"admin-tickets":"tickets"}><main className="tw-page">
    <header className="tw-hero"><div><button className="tw-back" onClick={()=>navigate(-1)}>← Back</button><span className="tw-number">{ticket.ticketNumber}</span><h1>{ticket.subject}</h1><div className="tw-badges"><span className={`priority-${badge(ticket.priority)}`}>{ticket.priority}</span><span className={`status-${badge(ticket.status)}`}>{ticket.status}</span></div></div>{isAgent&&!isResolved&&!readOnly&&<button className={working?"tw-pause":"tw-start"} onClick={doWork} disabled={busy}>{working?"Pause Work":"Start Work"}</button>}</header>
    {message&&<div className={`tw-message ${tone}`}>{message}</div>}

    {(isAgent||isManager||isAdmin)&&<section className="tw-toolbar"><div><span>Ticket controls</span><strong>Workflow & history</strong><small>Only actions valid for the current status are shown.</small></div><div className="tw-toolbar-actions"><button onClick={()=>setHistoryOpen(true)}>View History <b>{timeline.length}</b></button>{isAgent&&!isResolved&&!readOnly&&<button onClick={()=>openAction("resolve")}>Resolve</button>}{isAgent&&!isResolved&&!readOnly&&<button onClick={()=>openAction("escalate")}>Escalate</button>}{isAgent&&!isResolved&&!readOnly&&<button className="danger" onClick={()=>openAction("stop")}>Stop Working</button>}{isAgent&&isResolved&&<button className="primary" onClick={()=>openAction("close")}>Close Ticket</button>}{(isManager||isAdmin)&&(isResolved||readOnly)&&<button onClick={()=>openAction("reopen")}>Reopen</button>}</div></section>}

    {isManager&&!isResolved&&!readOnly&&<section className="tw-assignment"><div><span>Manager action</span><h2>{ticket.assignedAgent?"Assignment":"This ticket needs an owner"}</h2><p>Choose an agent manually or assign to the least busy available agent.</p></div><div className="tw-assign-controls"><select value={selectedAgent} onChange={e=>setSelectedAgent(e.target.value)} disabled={busy||!sortedAgents.length}>{sortedAgents.map(a=><option key={a.id} value={a.id}>{a.name} · {a.activeTickets} active</option>)}</select><button onClick={()=>assign(selectedAgent)} disabled={busy||!selectedAgent}>{ticket.assignedAgent?"Reassign":"Assign"}</button><button className="smart" onClick={()=>assign(leastBusy?.id)} disabled={busy||!leastBusy}>✦ Auto Assign {leastBusy?`to ${leastBusy.name}`:""}</button></div></section>}

    <section className="tw-grid"><article className="tw-card tw-main"><div className="tw-section-title"><span>Ticket details</span><h2>Issue Description</h2></div><p className="tw-description">{ticket.description}</p><div className="tw-info"><div><span>Category</span><strong>{ticket.category}</strong></div><div><span>Priority</span><strong>{ticket.priority}</strong></div><div><span>Status</span><strong>{ticket.status}</strong></div><div><span>Created</span><strong>{date(ticket.createdAt)}</strong></div><div><span>Updated</span><strong>{date(ticket.updatedAt)}</strong></div><div><span>Closed</span><strong>{date(ticket.closedAt)}</strong></div></div>{standalone.length>0&&<div className="tw-attachment-section"><h3>Attachments <span>{standalone.length}</span></h3><Files ticketId={id} items={standalone}/></div>}</article>
      <aside className="tw-side"><article className="tw-card tw-person"><span>Requested by</span><div><b>{initials(ticket.employee?.name)}</b><p><strong>{ticket.employee?.name||"Unknown"}</strong><small>{ticket.employee?.email}</small></p></div></article><article className="tw-card tw-person"><span>Assigned agent</span>{ticket.assignedAgent?<div><b>{initials(ticket.assignedAgent.name)}</b><p><strong>{ticket.assignedAgent.name}</strong><small>{ticket.assignedAgent.email}</small></p></div>:<em>Currently unassigned</em>}</article><article className="tw-card tw-work"><span>Work tracking</span><h3>{working?"Session active":"No active session"}</h3><p>{working?"Working time is being tracked now.":"Time from completed work sessions is preserved."}</p><strong>{ticket.totalWorkMinutes||0} minutes total</strong></article></aside>
    </section>

    <section className="tw-card tw-conversation"><div className="tw-section-title row"><div><span>Conversation</span><h2>Comments</h2></div><b>{comments.length}</b></div><div className="tw-comment-list">{comments.length?comments.map(c=><article className="tw-comment" key={c.id}><b className="avatar">{initials(author(c))}</b><div><header><strong>{author(c)}</strong><time>{date(c.createdAt)}</time></header><p>{c.comment}</p><Files ticketId={id} items={c.attachments||[]}/></div></article>):<div className="tw-empty"><strong>No comments yet</strong><p>The support conversation will appear here.</p></div>}</div>{!readOnly&&(isEmployee||isAgent)&&<form className="tw-form" onSubmit={postComment}><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Write a comment…"/><ChosenFiles files={commentFiles} setFiles={setCommentFiles}/><footer><label>Attach screenshot<input hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>{setCommentFiles(a=>[...a,...Array.from(e.target.files||[])]);e.target.value="";}}/></label><button disabled={busy||!comment.trim()}>Post Comment</button></footer></form>}</section>

    {!isEmployee&&<section className="tw-card tw-notes"><div className="tw-section-title row"><div><span>Support only</span><h2>Internal Notes</h2></div><small>Hidden from employees</small></div><div className="tw-comment-list">{notes.length?notes.map(n=><article className="tw-comment" key={n.id}><b className="avatar">{initials(n.author?.name)}</b><div><header><strong>{n.author?.name||"Support"}</strong><time>{date(n.createdAt)}</time></header><p>{n.note}</p><Files ticketId={id} items={n.attachments||[]}/></div></article>):<div className="tw-empty"><strong>No internal notes</strong><p>Private support notes will appear here.</p></div>}</div>{!readOnly&&<form className="tw-form" onSubmit={postNote}><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Write a private internal note…"/><ChosenFiles files={noteFiles} setFiles={setNoteFiles}/><footer><label>Attach screenshot<input hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>{setNoteFiles(a=>[...a,...Array.from(e.target.files||[])]);e.target.value="";}}/></label><button disabled={busy||!note.trim()}>Add Internal Note</button></footer></form>}</section>}

    {historyOpen&&<div className="tw-modal-bg" onMouseDown={()=>setHistoryOpen(false)}><section className="tw-modal tw-history" onMouseDown={e=>e.stopPropagation()}><header><div><span>Ticket history</span><h2>Activity Timeline</h2></div><button onClick={()=>setHistoryOpen(false)}>×</button></header><div className="tw-timeline">{timeline.length?timeline.map((x,i)=><article key={`${x.kind}-${x.id||i}`}><i/><div><span>{x.kind} · {date(x.at)}</span><strong>{x.description||x.action||x.activityType||"Ticket updated"}</strong>{(x.performedBy?.name||x.changedBy?.name)&&<small>By {x.performedBy?.name||x.changedBy?.name}</small>}</div></article>):<div className="tw-empty">No recorded activity yet.</div>}</div></section></div>}

    {action&&<div className="tw-modal-bg" onMouseDown={()=>!busy&&setAction("")}><section className="tw-modal" onMouseDown={e=>e.stopPropagation()}><header><div><span>Confirm action</span><h2>{action==="stop"?"Stop working on this ticket":`${action[0].toUpperCase()}${action.slice(1)} ticket`}</h2></div><button onClick={()=>setAction("")}>×</button></header>{action==="stop"&&<div className="tw-stop"><button className={stopChoice==="no-issue"?"selected":""} onClick={()=>setStopChoice("no-issue")}><strong>No issue found</strong><small>Cancel the ticket permanently.</small></button><button className={stopChoice==="could-not-solve"?"selected":""} onClick={()=>setStopChoice("could-not-solve")}><strong>Could not solve</strong><small>Return it to the manager for reassignment.</small></button></div>}<textarea value={actionNote} onChange={e=>setActionNote(e.target.value)} placeholder={action==="close"?"Closing note…":action==="resolve"?"Resolution notes…":"Reason / notes…"}/><footer><button onClick={()=>setAction("")} disabled={busy}>Back</button><button className="primary" onClick={runAction} disabled={busy}>{busy?"Updating…":"Confirm"}</button></footer></section></div>}
  </main></DashboardLayout>;
}
