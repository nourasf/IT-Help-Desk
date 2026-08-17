import { useEffect, useRef, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { sendAiChatMessage } from "../../api/ai";
import "../../styles/AiAssistant.css";

const QUICK_PROMPTS = [
  "My printer is connected but nothing will print.",
  "I forgot my company password and cannot sign in.",
  "My laptop is connected to Wi-Fi but the VPN will not connect.",
];

function AiAssistant() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      text: "Hi! I’m the SupportHub AI Assistant. Tell me what IT issue you’re having and I’ll suggest a few things to try.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function submitMessage(text) {
    const cleanMessage = String(text || "").trim();
    if (!cleanMessage || isSending) return;

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
      const reply = await sendAiChatMessage(cleanMessage);

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: reply || "I couldn't generate a useful response. Try describing the issue with a little more detail.",
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
    setMessages([
      {
        id: Date.now(),
        role: "assistant",
        text: "Fresh start. What can I help you troubleshoot?",
      },
    ]);
    setError("");
  }

  return (
    <DashboardLayout activePage="ai-assistant">
      <main className="ai-chat-page">
        <section className="ai-chat-header">
          <div>
            <span className="ai-chat-eyebrow">SupportHub intelligence</span>
            <h1>AI Assistant</h1>
            <p>Get quick troubleshooting guidance before opening or updating a support ticket.</p>
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
              <p>Describe the problem in your own words. The assistant will give you concise troubleshooting steps.</p>
            </div>

            <div className="ai-chat-tips">
              <div>
                <span>01</span>
                <p>Include the device or app having the problem.</p>
              </div>
              <div>
                <span>02</span>
                <p>Mention any error message you can see.</p>
              </div>
              <div>
                <span>03</span>
                <p>Say what you already tried.</p>
              </div>
            </div>

            <p className="ai-chat-local-note">Powered locally by Ollama. No OpenAI API key is required.</p>
          </aside>

          <section className="ai-chat-card">
            <div className="ai-chat-card-topbar">
              <div>
                <span className="ai-chat-card-status"><i /> AI ready</span>
                <strong>SupportHub Assistant</strong>
              </div>
              <span className="ai-chat-model">IT troubleshooting</span>
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

            {messages.length === 1 && (
              <div className="ai-chat-quick-prompts">
                <span>Try an example</span>
                <div>
                  {QUICK_PROMPTS.map((prompt) => (
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

            {error && (
              <div className="ai-chat-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => submitMessage(message)} disabled={!message.trim() || isSending}>
                  Try again
                </button>
              </div>
            )}

            <form className="ai-chat-composer" onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your IT problem..."
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
              AI guidance may be imperfect. If the issue continues or involves sensitive access, contact IT support.
            </p>
          </section>
        </section>
      </main>
    </DashboardLayout>
  );
}

export default AiAssistant;
