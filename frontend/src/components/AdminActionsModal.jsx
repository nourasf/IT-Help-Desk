import { Link } from "react-router-dom";
import "../styles/Admin.css";

function AdminActionsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="admin-actions-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="admin-actions-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-actions-title"
      >
        <header className="admin-actions-modal-header">
          <div>
            <span>Admin action center</span>
            <h2 id="admin-actions-title">What would you like to do?</h2>
            <p>Choose a management task to continue.</p>
          </div>
          <button
            type="button"
            className="admin-actions-modal-close"
            onClick={onClose}
            aria-label="Close actions"
          >
            ×
          </button>
        </header>

        <div className="admin-actions-modal-grid">
          <Link
            className="admin-modal-action ready"
            to="/admin/users/create"
            onClick={onClose}
          >
            <span className="admin-modal-action-icon">+</span>
            <span className="admin-modal-action-copy">
              <strong>Create User</strong>
              <small>Add an employee, manager, or support agent.</small>
            </span>
            <span className="admin-modal-action-state">Open</span>
          </Link>

          <button type="button" className="admin-modal-action" disabled>
            <span className="admin-modal-action-icon">A</span>
            <span className="admin-modal-action-copy">
              <strong>Assign Tickets</strong>
              <small>Open the manager assignment workflow.</small>
            </span>
            <span className="admin-modal-action-state">Soon</span>
          </button>

          <button type="button" className="admin-modal-action" disabled>
            <span className="admin-modal-action-icon">R</span>
            <span className="admin-modal-action-copy">
              <strong>View Reports</strong>
              <small>Review help desk analytics and exports.</small>
            </span>
            <span className="admin-modal-action-state">Soon</span>
          </button>

          <button type="button" className="admin-modal-action" disabled>
            <span className="admin-modal-action-icon">S</span>
            <span className="admin-modal-action-copy">
              <strong>System Settings</strong>
              <small>Configure roles, categories, and system options.</small>
            </span>
            <span className="admin-modal-action-state">Soon</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default AdminActionsModal;
