import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";

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

  return (
    <DashboardLayout activePage="create-ticket">
      <div className="create-ticket-heading">
        <h1>Create new support ticket</h1>
        <p>Describe your issue and we'll assign it to the right IT agent.</p>
      </div>

      <form className="create-ticket-card" onSubmit={handleSubmit}>
        <div className="ticket-form-column">
          <label>
            Subject
            <input
              type="text"
              name="subject"
              placeholder="Title"
              value={form.subject}
              onChange={handleChange}
            />
          </label>

          <label>
            Category
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
            >
              <option value="">Select Category</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="network">Network</option>
              <option value="email">Email</option>
            </select>
          </label>

          <label>
            Priority
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
            >
              <option value="">Select Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label>
            Description
            <textarea
              name="description"
              placeholder="What’s the problem?"
              value={form.description}
              onChange={handleChange}
            />
          </label>

          <label>
            Attachments
            <div className="attachment-box">
              <span>◒</span>
              Drag & Drop
            </div>
          </label>
        </div>

        <aside className="ai-assistant-card">
          <div className="ai-heading">
            <h2>AI Assistant</h2>
            <p>AI analyzes your ticket as you type</p>
          </div>

          <label>
            Suggested Category
            <input type="text" value="Hardware" readOnly />
          </label>

          <label>
            Suggested Priority
            <input type="text" value="Medium" readOnly />
          </label>

          <label>
            Recommended Action
            <textarea value="..." readOnly />
          </label>

          <button type="button" className="primary-pill-button">
            Apply Suggestion
          </button>
        </aside>

        <div className="create-ticket-actions">
          <button
            type="button"
            className="secondary-pill-button"
            onClick={() => navigate("/dashboard")}
          >
            Cancel
          </button>

          <button type="submit" className="primary-pill-button">
            Send Ticket
          </button>
        </div>
      </form>
    </DashboardLayout>
  );
}

export default CreateTicket;