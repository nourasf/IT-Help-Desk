import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import AiArtifactPanel from "../../components/ai/AiArtifactPanel";
import {
  clearAiConversations,
  deleteAiConversation,
  getAiConversation,
  getAiConversations,
  sendAiChatMessage,
} from "../../api/ai";
import { getStoredRole } from "../../utils/authStorage";
import "../../styles/ai/AiAssistant.css";
import "../../styles/ai/AiArtifacts.css";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
}

const ROLE_CONFIG = {
  employee: {
    label: "Employee support",
    greeting: "Hi! I’m the SupportHub AI Assistant. What can I help you with?",
    description: "Troubleshoot issues, create support tickets, and open your ticket workspace from one place.",
    prompts: [
      "My printer is connected but nothing will print.",
      "I forgot my company password and cannot sign in.",
      "My laptop is connected to Wi-Fi but the VPN will not connect.",
    ],
    actions: [
      { label: "Create ticket", prompt: "Create a support ticket" },
      { label: "My tickets", prompt: "Show my tickets" },
    ],
  },
  agent: {
    label: "Agent copilot",
    greeting: "Hi! I’m your SupportHub AI copilot. What are you working on?",
    description: "Get diagnostic help and open your active or available ticket queues instantly.",
    prompts: [
      "A user's VPN connects but internal sites still time out. What should I check next?",
      "A printer is online but jobs stay in the queue. Give me a diagnostic checklist.",
      "A laptop randomly loses Wi-Fi while other devices stay connected. What evidence should I collect?",
    ],
    actions: [
      { label: "Available tickets", prompt: "Show available tickets" },
      { label: "My active tickets", prompt: "Show my active tickets" },
    ],
  },
  manager: {
    label: "Manager assistant",
    greeting: "Hi! I’m the SupportHub AI Assistant. What would you like help with?",
    description: "Review ticket queues, assign work, open reports, and get operational guidance.",
    prompts: [
      "How should I prioritize a VPN outage affecting one remote employee?",
      "What information should I look for before assigning a recurring printer issue?",
      "What makes an IT incident Critical instead of High priority?",
    ],
    actions: [
      { label: "Assignment center", prompt: "Show unassigned tickets for assignment" },
      { label: "Critical tickets", prompt: "Show critical tickets" },
      { label: "Reports", prompt: "Open reports" },
    ],
  },
  admin: {
    label: "Admin assistant",
    greeting: "Hi! I’m the SupportHub AI Assistant. What can I help you with today?",
    description: "Manage users, review tickets, open reports, and get concise operational guidance.",
    prompts: [
      "What should I verify when several users suddenly cannot sign in?",
      "Give me a checklist for investigating a spike in high-priority tickets.",
      "What information is useful when reviewing repeated network incidents?",
    ],
    actions: [
      { label: "Create user", prompt: "Add a new employee" },
      { label: "User directory", prompt: "Show all users" },
      { label: "All tickets", prompt: "Show all tickets" },
      { label: "Reports", prompt: "Open reports" },
    ],
  },
};

function getRoleConfig(role) {
  if (role === "it support agent" || role === "agent" || role === "it") return ROLE_CONFIG.agent;
  return ROLE_CONFIG[role] || ROLE_CONFIG.employee;
}

function createGreeting(config) {
  return { id: `g-${Date.now()}`, role: "assistant", text: config.greeting, isGreeting: true };
}

function AiAssistant() {
  const navigate = useNavigate();
  const role = normalizeRole(getStoredRole());
  const roleConfig = getRoleConfig(role);
  const canCreateTicket = role === "employee";
  const messagesEndRef = useRef(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(() => [createGreeting(roleConfig)]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isSending]);

  async function loadConversations() {
    try { setIsHistoryLoading(true); setConversations(await getAiConversations()); }
    catch (requestError) { console.error("AI history error:", requestError); }
    finally { setIsHistoryLoading(false); }
  }

  async function openConversation(id) {
    if (isSending) return;
    try {
      setError("");
      setActiveArtifact(null);
      const data = await getAiConversation(id);
      setConversationId(data.id);
      setMessages([createGreeting(roleConfig), ...(Array.isArray(data.messages) ? data.messages : [])]);
      setMessage("");
    } catch (requestError) { setError(requestError.message || "Could not open that conversation."); }
  }

  function newConversation() {
    setConversationId(null);
    setMessages([createGreeting(roleConfig)]);
    setActiveArtifact(null);
    setMessage("");
    setError("");
  }

  async function removeConversation(event, id) {
    event.stopPropagation();
    try { await deleteAiConversation(id); if (conversationId === id) newConversation(); await loadConversations(); }
    catch (requestError) { setError(requestError.message || "Could not delete that conversation."); }
  }

  async function clearHistory() {
    if (conversations.length === 0) return;
    try { await clearAiConversations(); newConversation(); setConversations([]); }
    catch (requestError) { setError(requestError.message || "Could not clear chat history."); }
  }

  async function submitMessage(text) {
    const cleanMessage = String(text || "").trim();
    if (!cleanMessage || isSending) return;
    setError("");
    setMessage("");
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: cleanMessage }]);
    setIsSending(true);
    try {
      const result = await sendAiChatMessage(cleanMessage, conversationId);
      setConversationId(result.conversationId);
      setMessages((current) => [...current, { id: `a-${Date.now()}`, role: "assistant", text: result.reply || "I couldn't generate a useful response. Try describing the issue with a little more detail." }]);
      if (result.artifact) setActiveArtifact(result.artifact);
      await loadConversations();
    } catch (requestError) {
      console.error("AI chat error:", requestError);
      setError(requestError.message || "The AI assistant could not respond right now.");
    } finally { setIsSending(false); }
  }

  function handleSubmit(event) { event.preventDefault(); submitMessage(message); }
  function handleKeyDown(event) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(message); } }

  const hasConversation = messages.some((item) => !item.isGreeting);
  const lastMessage = messages[messages.length - 1];
  const showEmployeeEscalation = canCreateTicket && hasConversation && !isSending && lastMessage?.role === "assistant" && !activeArtifact;

  return (
    <DashboardLayout activePage="ai-assistant">
      <main className={`ai-chat-page ${activeArtifact ? "has-artifact" : ""}`}>
        <section className="ai-chat-header">
          <div><span className="ai-chat-eyebrow">SupportHub intelligence</span><h1>AI Assistant</h1><p>{roleConfig.description}</p></div>
          <button type="button" className="ai-chat-clear" onClick={newConversation}>+ New conversation</button>
        </section>

        <section className={`ai-chat-workspace ${activeArtifact ? "artifact-open" : ""}`}>
          <aside className="ai-chat-history-panel">
            <div className="ai-chat-history-header"><div><span>History</span><strong>Recent chats</strong></div>{conversations.length > 0 && <button type="button" onClick={clearHistory}>Clear all</button>}</div>
            <div className="ai-chat-history-list">
              {isHistoryLoading && <p className="ai-history-empty">Loading chats...</p>}
              {!isHistoryLoading && conversations.length === 0 && <p className="ai-history-empty">No saved conversations yet.</p>}
              {!isHistoryLoading && conversations.map((conversation) => (
                <button type="button" key={conversation.id} className={`ai-history-item ${conversationId === conversation.id ? "active" : ""}`} onClick={() => openConversation(conversation.id)}>
                  <span className="ai-history-icon">✦</span>
                  <span className="ai-history-copy"><strong>{conversation.title}</strong><small>{conversation.messageCount} messages</small></span>
                  <span role="button" tabIndex={0} className="ai-history-delete" onClick={(event) => removeConversation(event, conversation.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") removeConversation(event, conversation.id); }} aria-label={`Delete ${conversation.title}`}>×</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="ai-chat-shell">
            <aside className="ai-chat-info-card">
              <div className="ai-chat-mascot" aria-hidden="true"><span className="ai-chat-mascot-antenna" /><div className="ai-chat-mascot-face"><span /><span /></div></div>
              <div className="ai-chat-info-copy"><span className="ai-chat-ready"><i /> Online locally</span><h2>Ask SupportHub</h2><span className="ai-chat-role-badge">{roleConfig.label}</span><p>Ask a question or tell the assistant what you want to do. Supported actions open beside the chat.</p></div>
              <div className="ai-chat-action-menu">
                <span>Quick actions</span>
                <div>{roleConfig.actions.map((action) => <button type="button" key={action.label} onClick={() => submitMessage(action.prompt)} disabled={isSending}>{action.label}<b>↗</b></button>)}</div>
              </div>
            </aside>

            <section className="ai-chat-card">
              <div className="ai-chat-card-topbar"><div><span className="ai-chat-card-status"><i /> AI ready</span><strong>SupportHub Assistant</strong></div><span className="ai-chat-model">{roleConfig.label}</span></div>
              <div className="ai-chat-messages" aria-live="polite">
                {messages.map((chatMessage) => <div key={chatMessage.id} className={`ai-chat-message-row ${chatMessage.role}`}>{chatMessage.role === "assistant" && <div className="ai-chat-avatar" aria-hidden="true">✦</div>}<div className="ai-chat-message-bubble">{String(chatMessage.text || "").split("\n").map((line, index) => <p key={`${chatMessage.id}-${index}`}>{line || " "}</p>)}</div></div>)}
                {isSending && <div className="ai-chat-message-row assistant"><div className="ai-chat-avatar" aria-hidden="true">✦</div><div className="ai-chat-message-bubble thinking"><span /><span /><span /></div></div>}
                <div ref={messagesEndRef} />
              </div>
              {!hasConversation && <div className="ai-chat-quick-prompts"><span>Try an example</span><div>{roleConfig.prompts.map((prompt) => <button key={prompt} type="button" onClick={() => submitMessage(prompt)} disabled={isSending}>{prompt}</button>)}</div></div>}
              {showEmployeeEscalation && <div className="ai-chat-escalation"><div><span className="ai-chat-escalation-eyebrow">Still need help?</span><strong>Contact an IT agent</strong><p>If troubleshooting didn’t solve it, I can open a support ticket form right here.</p></div><button type="button" onClick={() => submitMessage("Create a support ticket")}>Create a Ticket</button></div>}
              {error && <div className="ai-chat-error" role="alert"><span>{error}</span></div>}
              <form className="ai-chat-composer" onSubmit={handleSubmit}><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={handleKeyDown} placeholder="Message SupportHub AI..." rows={1} maxLength={2000} disabled={isSending} aria-label="Message SupportHub AI Assistant" /><div className="ai-chat-composer-bottom"><span>Enter to send · Shift + Enter for a new line</span><button type="submit" disabled={!message.trim() || isSending}>{isSending ? "Thinking..." : "Send"}<span aria-hidden="true">↗</span></button></div></form>
              <p className="ai-chat-disclaimer">Your 10 most recent conversations are saved to your SupportHub account and can be deleted anytime.</p>
            </section>
          </section>

          {activeArtifact && <AiArtifactPanel artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />}
        </section>
      </main>
    </DashboardLayout>
  );
}

export default AiAssistant;
