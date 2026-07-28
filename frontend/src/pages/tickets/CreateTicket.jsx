import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import "../../styles/CreateTicket.css";

function CreateTicket() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    subject: "",
    category: "",
    priority: "",
    description: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log(form);
  };

  const handleApplySuggestion = () => {
    setForm((current) => ({
      ...current,
      category: "hardware",
      priority: "medium",
    }));
  };

  return (
    <DashboardLayout activePage="create-ticket">
      <main className="create-ticket-page">
        <section className="create-ticket-header">
          <div>
            <span className="create-ticket-label">Support request</span>

            <h1>Create new support ticket</h1>

            <p>
              Describe your issue and we&apos;ll assign it to the right IT
              agent.
            </p>
          </div>

          <button
            type="button"
            className="back-dashboard-button"
            onClick={() => navigate("/employee-dashboard")}
          >
            ← Back to dashboard
          </button>
        </section>

        <form className="create-ticket-card" onSubmit={handleSubmit}>
          <section className="ticket-form-section">
            <div className="ticket-section-heading">
              <div className="ticket-section-icon">▤</div>

              <div>
                <h2>Ticket details</h2>
                <p>Give us enough information to understand the issue.</p>
              </div>
            </div>

            <div className="ticket-fields">
              <label className="ticket-field full-width-field">
                <span>Subject</span>

                <input
                  type="text"
                  name="subject"
                  placeholder="Briefly describe the problem"
                  value={form.subject}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="ticket-field">
                <span>Category</span>

                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select category</option>
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                  <option value="network">Network</option>
                  <option value="email">Email</option>
                </select>
              </label>

              <label className="ticket-field">
                <span>Priority</span>

                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>

              <label className="ticket-field full-width-field">
                <span>Description</span>

                <textarea
                  name="description"
                  placeholder="Explain what happened, when it started and what you already tried..."
                  value={form.description}
                  onChange={handleChange}
                  required
                />

                <small>
                  Include any error messages or steps that caused the issue.
                </small>
              </label>

              <label className="ticket-field full-width-field">
                <span>Attachments</span>

                <input
                  id="ticket-attachment"
                  className="attachment-input"
                  type="file"
                  multiple
                />

                <div
                  className="attachment-drop-zone"
                  onClick={() =>
                    document.getElementById("ticket-attachment")?.click()
                  }
                >
                  <div className="attachment-icon">↥</div>

                  <div>
                    <strong>Drag files here or click to browse</strong>
                    <p>PNG, JPG or PDF up to 10 MB</p>
                  </div>
                </div>
              </label>
            </div>
          </section>

          <aside className="ticket-ai-panel">
            <div className="ai-panel-header">
              <div className="ai-panel-icon">✦</div>

              <div>
                <h2>AI Assistant</h2>
                <p>Helping you create a clearer support request.</p>
              </div>
            </div>

            <div className="ai-status-message">
              <span></span>
              AI analyzes your ticket as you type
            </div>

            <div className="ai-suggestion-block">
              <span className="ai-suggestion-label">
                Suggested category
              </span>

              <div className="ai-suggestion-value">
                <span className="suggestion-icon">▣</span>

                <div>
                  <strong>Hardware</strong>
                  <small>Based on your description</small>
                </div>
              </div>
            </div>

            <div className="ai-suggestion-block">
              <span className="ai-suggestion-label">
                Suggested priority
              </span>

              <div className="ai-suggestion-value">
                <span className="priority-dot"></span>

                <div>
                  <strong>Medium</strong>
                  <small>Normal business impact</small>
                </div>
              </div>
            </div>

            <div className="ai-suggestion-block">
              <span className="ai-suggestion-label">
                Recommended action
              </span>

              <div className="recommended-action-box">
                Add the device name, any error message and when the problem
                first started.
              </div>
            </div>

            <button
              type="button"
              className="apply-suggestion-button"
              onClick={handleApplySuggestion}
            >
              ✦ Apply Suggestion
            </button>

            <p className="ai-disclaimer">
              You can review and change all suggested values before sending.
            </p>
          </aside>

          <footer className="create-ticket-footer">
            <p>
              Make sure the details are correct before submitting your ticket.
            </p>

            <div className="create-ticket-actions">
              <button
                type="button"
                className="cancel-ticket-button"
                onClick={() => navigate("/employee-dashboard")}
              >
                Cancel
              </button>

              <button type="submit" className="send-ticket-button">
                Send Ticket
              </button>
            </div>
          </footer>
        </form>
      </main>
    </DashboardLayout>
  );
}

export default CreateTicket;