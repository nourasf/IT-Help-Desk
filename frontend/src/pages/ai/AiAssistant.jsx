import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { sendAiChatMessage } from "../../api/ai";
import { getStoredRole } from "../../utils/authStorage";
import "../../styles/AiAssistant.css";

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
}

const ROLE_CONFIG = {
  employee: {
    label: "Employee support",
    greeting: "Hi! I’m the SupportHub AI Assistant. Tell me what IT issue you’re having and I’ll help you troubleshoot it before you create a ticket.",
    description: "Get quick troubleshooting guidance before opening a support ticket.",
    info: "Describe the problem in your own words. I’ll give you short troubleshooting steps and you can contact an IT agent if you still need help.",
    prompts: [
      "My printer is connected but nothing will print.",
      "I forgot my company password and cannot sign in.",
      "My laptop is connected to Wi-Fi but the VPN will not connect.",
    ],
  },
  agent: {
    label: "Agent copilot",
    greeting: "Hi! I’m your SupportHub AI copilot. Tell me what you’re diagnosing and I’ll suggest likely causes, checks, and useful evidence to collect.",
    description: "Get concise diagnostic ideas while working on support tickets.",
    info: "Describe the symptoms, environment, and what has already been tested. I’ll help narrow down likely causes and next checks.",
    prompts: [
      "A user's VPN connects but internal sites still time out. What should I check next?",
      "A printer is online but jobs stay in the queue. Give me a diagnostic checklist.",
      "A laptop randomly loses Wi-Fi while other devices stay connected. What evidence should I collect?",
    ],
  },
  manager: {
    label: "Manager assistant",
    greeting: "Hi! I’m the SupportHub AI Assistant. I can help you reason about ticket impact, likely causes, categorization, priority, and next steps.",
    description: "Get quick help interpreting support issues and operational impact.",
    info: "Ask about ticket impact, categorization, priority, likely causes, or useful next actions for the support team.",
    prompts: [
      "How should I prioritize a VPN outage affecting one remote employee?",
      "What information should I look for before assigning a recurring printer issue?",
      "What makes an IT incident Critical instead of High priority?",
    ],
  },
  admin: {
    label: "Admin assistant",
    greeting: "Hi! I’m the SupportHub AI Assistant. I can help with practical IT troubleshooting and help-desk administration questions.",
    description: "Get concise operational guidance for SupportHub and general IT issues.",
    info: "Ask about troubleshooting, user-support scenarios, operational checks, or help-desk workflow questions.",
    prompts: [
      "What should I verify when several users suddenly cannot sign in?",
      "Give me a checklist for investigating a spike in high-priority tickets.",
      "What information is useful when reviewing repeated network incidents?",
    ],
  },
};

function getRoleConfig(role) {
  if (role === "it support agent" || role === "agent" || role === "it") {
    return ROLE_CONFIG.agent;
  }

  return ROLE_CONFIG[role] || ROLE_CONFIG.employee;
}

function createGreeting(config) {
  return {
    id: Date.now(),
    role: "assistant",
    text: config.greeting,
    isGreeting: true,
  };
}

function AiAssistant() {
  const navigate = useNavigate();
  const role = normalizeRole(getStoredRole());
  const roleConfig = getRoleConfig(role);
  const canCreateTicket = role === "employee";

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(() => [createGreeting(roleConfig)]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function submitMessage(text) {
    const cleanMessage = String(text || "").trim();
    if (!cleanMessage || isSending) return;

    const conversationHistory = messages
      .filter((item) => !item.isGreeting)
      .filter((item) => item.role === "user" || item.role === "assistant")
      .slice(-10)
      .map((item) => ({ role: item.role, text: item.text }));

    setError("");
    setMessage("");

    const userMessage = {
      id: Date.now(),
      role: "user",
      text: cleanMessage,
    };

    setMessages((current) => [...current, userMessage]);
    setIsSending(true);

    try {
      const result = await sendAiChatMessage(cleanMessage, conversationHistory);

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text:
            result.reply ||
            "I couldn't generate a useful response. Try describing the issue with a little more detail.",
        },
      ]);
    } catch (requestError) {
      console.error("AI chat error:", requestError);
      setError(requestError.message || "The AI assistant could not respond right now.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitMessage(message);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage(message);
    }
  }

  function clearChat() {
    setMessages([createGreeting(roleConfig)]);
    setError("");
    setMessage("");
  }

  const hasConversation = messages.some((item) => !item.isGreeting);
  const lastMessage = messages[messages.length - 1];
  const showEmployeeEscalation =
    canCreateTicket &&
    hasConversation &&
    !isSending &&
    lastMessage?.role === "assistant";

  return (
    <DashboardLayout activePage="ai-assistant">
      <main className="ai-chat-page">
        <section className="ai-chat-header">
          <div>
            <span className="ai-chat-eyebrow">SupportHub intelligence</span>
            <h1>AI Assistant</h1>
            <p>{roleConfig.description}</p>
          </div>

          <button type="button" className="ai-chat-clear" onClick={clearChat}>
            New conversation
          </button>
        </section>

        <section className="ai-chat-shell">
          <aside className="ai-chat-info-card">
            <div className="ai-chat-mascot" aria-hidden="true">
              <span className="ai-chat-mascot-antenna" />
              <div className="ai-chat-mascot-face">
                <span />
                <span />
              </div>
            </div>

            <div className="ai-chat-info-copy">
              <span className="ai-chat-ready"><i /> Online locally</span>
              <h2>Ask SupportHub</h2>
              <span className="ai-chat-role-badge">{roleConfig.label}</span>
              <p>{roleConfig.info}</p>
            </div>

            <div className="ai-chat-tips">
              <div>
                <span>01</span>
                <p>Include the device, app, service, or ticket involved.</p>
              </div>
              <div>
                <span>02</span>
                <p>Mention any error message or unusual behavior you can see.</p>
              </div>
              <div>
                <span>03</span>
                <p>Say what has already been tried so AI does not repeat it.</p>
              </div>
            </div>

            <p className="ai-chat-local-note">Powered locally by Ollama. Conversation context is sent only with the current chat request.</p>
          </aside>

          <section className="ai-chat-card">
            <div className="ai-chat-card-topbar">
              <div>
                <span className="ai-chat-card-status"><i /> AI ready</span>
                <strong>SupportHub Assistant</strong>
              </div>
              <span className="ai-chat-model">{roleConfig.label}</span>
            </div>

            <div className="ai-chat-messages" aria-live="polite">
              {messages.map((chatMessage) => (
                <div
                  key={chatMessage.id}
                  className={`ai-chat-message-row ${chatMessage.role}`}
                >
                  {chatMessage.role === "assistant" && (
                    <div className="ai-chat-avatar" aria-hidden="true">✦</div>
                  )}

                  <div className="ai-chat-message-bubble">
                    {chatMessage.text.split("\n").map((line, index) => (
                      <p key={`${chatMessage.id}-${index}`}>{line || " "}</p>
                    ))}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="ai-chat-message-row assistant">
                  <div className="ai-chat-avatar" aria-hidden="true">✦</div>
                  <div className="ai-chat-message-bubble thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {!hasConversation && (
              <div className="ai-chat-quick-prompts">
                <span>Try an example</span>
                <div>
                  {roleConfig.prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => submitMessage(prompt)}
                      disabled={isSending}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showEmployeeEscalation && (
              <div className="ai-chat-escalation">
                <div>
                  <span className="ai-chat-escalation-eyebrow">Still need help?</span>
                  <strong>Contact an IT agent</strong>
                  <p>If the troubleshooting didn’t solve it, create a support ticket and an IT agent can take it from here.</p>
                </div>
                <button type="button" onClick={() => navigate("/create-ticket")}>Create a Ticket</button>
              </div>
            )}

            {error && (
              <div className="ai-chat-error" role="alert">
                <span>{error}</span>
              </div>
            )}

            <form className="ai-chat-composer" onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={canCreateTicket ? "Describe your IT problem..." : "Ask SupportHub AI..."}
                rows={1}
                maxLength={2000}
                disabled={isSending}
                aria-label="Message SupportHub AI Assistant"
              />

              <div className="ai-chat-composer-bottom">
                <span>Enter to send · Shift + Enter for a new line</span>
                <button type="submit" disabled={!message.trim() || isSending}>
                  {isSending ? "Thinking..." : "Send"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </form>

            <p className="ai-chat-disclaimer">
              AI guidance may be imperfect. Verify important changes before applying them.
            </p>
          </section>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default AiAssistant;
