import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getStoredRole } from "../../utils/authStorage";
import "../../styles/knowledge/KnowledgeBase.css";

const ARTICLES = [
  {
    id: "reset-password",
    category: "Accounts",
    title: "Reset your SupportHub password",
    summary: "Recover access when you forget your password or cannot sign in.",
    time: "2 min",
    popular: true,
    steps: [
      "Open the SupportHub sign-in page and choose Forgot password.",
      "Enter the email address connected to your SupportHub account.",
      "Use the verification code sent to your registered recovery method.",
      "Create a new password, then sign in again with the updated password.",
    ],
  },
  {
    id: "vpn-connect",
    category: "Network",
    title: "VPN will not connect",
    summary: "Quick checks for VPN connection failures while your internet still works.",
    time: "4 min",
    popular: true,
    steps: [
      "Confirm that normal websites load without the VPN connected.",
      "Disconnect the VPN completely, wait a few seconds, and reconnect.",
      "Check that the VPN client is using the expected connection profile.",
      "Restart the VPN client. If the issue continues, create a ticket with the exact error message.",
    ],
  },
  {
    id: "printer-queue",
    category: "Hardware",
    title: "Printer is connected but nothing prints",
    summary: "Clear common printer queue, offline, paper, and connection problems.",
    time: "3 min",
    popular: true,
    steps: [
      "Make sure the printer is powered on and has no paper jam or warning light.",
      "Open the print queue and cancel any jobs that are stuck.",
      "Confirm the correct printer is selected and that it does not show as Offline.",
      "Try one small test print. If it still fails, create a ticket and include the printer name.",
    ],
  },
  {
    id: "wifi-drop",
    category: "Network",
    title: "Wi-Fi keeps disconnecting",
    summary: "Collect the right information before escalating an unstable wireless connection.",
    time: "4 min",
    steps: [
      "Check whether other nearby devices are also losing Wi-Fi.",
      "Turn Wi-Fi off and back on, then reconnect to the network.",
      "Move closer to the access point and check whether the connection becomes stable.",
      "If only your device is affected, create a ticket and mention when the disconnects happen.",
    ],
  },
  {
    id: "email-mobile",
    category: "Software",
    title: "Email is not syncing on mobile",
    summary: "Basic checks when new company email stops appearing on your phone.",
    time: "3 min",
    steps: [
      "Confirm the phone has a working Wi-Fi or mobile-data connection.",
      "Open the mail app and manually refresh the inbox.",
      "Check whether the same mailbox works from another device or web browser.",
      "Restart the mail app. If syncing still fails, create a ticket with the device type and mail app name.",
    ],
  },
  {
    id: "slow-laptop",
    category: "Hardware",
    title: "Laptop suddenly feels very slow",
    summary: "Safe first steps for a slow or unresponsive workstation.",
    time: "3 min",
    steps: [
      "Save your work and close applications you are not using.",
      "Restart the laptop if it has not been restarted recently.",
      "Check whether the problem happens in one application or across the whole device.",
      "If the slowdown continues, create a ticket and mention when it started and which apps are affected.",
    ],
  },
  {
    id: "browser-cache",
    category: "Software",
    title: "Company website is not loading correctly",
    summary: "Rule out a browser-specific problem before reporting an internal website issue.",
    time: "3 min",
    steps: [
      "Refresh the page and confirm the address is correct.",
      "Try opening the site in a private/incognito window.",
      "Try a second supported browser if one is available.",
      "If the site still fails, create a ticket and include the page address and any error message.",
    ],
  },
  {
    id: "security-phishing",
    category: "Security",
    title: "What to do with a suspicious email",
    summary: "Protect your account when a message looks like phishing or impersonation.",
    time: "2 min",
    steps: [
      "Do not click links, open attachments, or reply to the suspicious message.",
      "Check the sender address carefully instead of relying only on the display name.",
      "If you already entered a password after clicking the message, change it immediately.",
      "Report the message to IT so the security risk can be reviewed.",
    ],
  },
];

const CATEGORIES = ["All", "Accounts", "Network", "Hardware", "Software", "Security"];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function ArticleIcon({ category }) {
  const symbols = {
    Accounts: "A",
    Network: "N",
    Hardware: "H",
    Software: "S",
    Security: "!",
  };
  return <span className={`kb-article-icon ${category.toLowerCase()}`}>{symbols[category] || "?"}</span>;
}

function KnowledgeBase() {
  const navigate = useNavigate();
  const role = normalizeRole(getStoredRole());
  const canCreateTicket = role === "employee";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedArticle, setSelectedArticle] = useState(null);

  const filteredArticles = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return ARTICLES.filter((article) => {
      const matchesCategory = category === "All" || article.category === category;
      const matchesQuery = !cleanQuery || [article.title, article.summary, article.category]
        .some((value) => value.toLowerCase().includes(cleanQuery));
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  const popular = ARTICLES.filter((article) => article.popular);

  return (
    <DashboardLayout activePage="knowledge-base">
      <main className="knowledge-page">
        <header className="knowledge-header">
          <div>
            <span className="knowledge-eyebrow">Self-service support</span>
            <h1>Knowledge Base</h1>
            <p>Find clear answers to common IT problems before opening a support ticket.</p>
          </div>
          <button type="button" className="knowledge-ai-button" onClick={() => navigate("/ai-assistant")}>Ask SupportHub AI</button>
        </header>

        <section className="knowledge-hero">
          <div className="knowledge-hero-copy">
            <span className="knowledge-hero-label">How can we help?</span>
            <h2>Search for a quick solution</h2>
            <p>Search by problem, device, or topic. The guides are short and written for everyday troubleshooting.</p>
            <div className="knowledge-search-wrap">
              <span className="knowledge-search-icon" aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try ‘VPN’, ‘printer’, ‘password’..."
                aria-label="Search knowledge base"
              />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
            </div>
          </div>
          <div className="knowledge-hero-visual" aria-hidden="true">
            <div className="knowledge-book"><span /><span /><span /></div>
            <div className="knowledge-orbit one">?</div>
            <div className="knowledge-orbit two">✓</div>
          </div>
        </section>

        {!query && category === "All" && (
          <section className="knowledge-section">
            <div className="knowledge-section-heading">
              <div><span>Start here</span><h2>Popular guides</h2></div>
              <p>Common fixes employees use most often.</p>
            </div>
            <div className="knowledge-popular-grid">
              {popular.map((article, index) => (
                <button type="button" className={`knowledge-popular-card tone-${index + 1}`} key={article.id} onClick={() => setSelectedArticle(article)}>
                  <ArticleIcon category={article.category} />
                  <div><span>{article.category} · {article.time}</span><strong>{article.title}</strong><p>{article.summary}</p></div>
                  <b aria-hidden="true">→</b>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="knowledge-section knowledge-library">
          <div className="knowledge-section-heading">
            <div><span>Browse</span><h2>Support library</h2></div>
            <p>{filteredArticles.length} {filteredArticles.length === 1 ? "guide" : "guides"} available</p>
          </div>

          <div className="knowledge-category-tabs" role="tablist" aria-label="Knowledge base categories">
            {CATEGORIES.map((item) => (
              <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>

          {filteredArticles.length > 0 ? (
            <div className="knowledge-article-grid">
              {filteredArticles.map((article) => (
                <button type="button" className="knowledge-article-card" key={article.id} onClick={() => setSelectedArticle(article)}>
                  <div className="knowledge-article-top"><ArticleIcon category={article.category} /><span>{article.time} read</span></div>
                  <div><span className="knowledge-article-category">{article.category}</span><h3>{article.title}</h3><p>{article.summary}</p></div>
                  <div className="knowledge-article-footer"><span>Open guide</span><b>→</b></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="knowledge-empty">
              <span>⌕</span>
              <h3>No guides found</h3>
              <p>Try another search term or choose a different category.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("All"); }}>Show all guides</button>
            </div>
          )}
        </section>

        <section className="knowledge-help-card">
          <div>
            <span className="knowledge-help-eyebrow">Still stuck?</span>
            <h2>Get help without starting over</h2>
            <p>Ask the AI Assistant for guided troubleshooting, or send the issue to the support team.</p>
          </div>
          <div className="knowledge-help-actions">
            <button type="button" className="secondary" onClick={() => navigate("/ai-assistant")}>Ask AI Assistant</button>
            {canCreateTicket && <button type="button" className="primary" onClick={() => navigate("/create-ticket")}>Create Support Ticket</button>}
          </div>
        </section>

        {selectedArticle && (
          <div className="knowledge-modal-backdrop" role="presentation" onMouseDown={() => setSelectedArticle(null)}>
            <section className="knowledge-article-modal" role="dialog" aria-modal="true" aria-labelledby="knowledge-article-title" onMouseDown={(event) => event.stopPropagation()}>
              <header>
                <ArticleIcon category={selectedArticle.category} />
                <div><span>{selectedArticle.category} · {selectedArticle.time} read</span><h2 id="knowledge-article-title">{selectedArticle.title}</h2><p>{selectedArticle.summary}</p></div>
                <button type="button" className="knowledge-modal-close" onClick={() => setSelectedArticle(null)} aria-label="Close guide">×</button>
              </header>
              <div className="knowledge-steps">
                <span className="knowledge-steps-label">Try these steps</span>
                {selectedArticle.steps.map((step, index) => (
                  <div className="knowledge-step" key={step}><span>{index + 1}</span><p>{step}</p></div>
                ))}
              </div>
              <footer>
                <div><strong>Didn’t solve it?</strong><span>SupportHub can help you continue from here.</span></div>
                <div>
                  <button type="button" className="secondary" onClick={() => navigate("/ai-assistant")}>Ask AI</button>
                  {canCreateTicket && <button type="button" className="primary" onClick={() => navigate("/create-ticket")}>Create Ticket</button>}
                </div>
              </footer>
            </section>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}

export default KnowledgeBase;
