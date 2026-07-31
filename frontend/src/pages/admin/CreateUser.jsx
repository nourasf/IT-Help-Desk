import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { getStoredToken } from "../../utils/authStorage";
import "../../styles/CreateUser.css";

const roles = ["Employee", "IT Support Agent", "Manager", "Admin"];

function CreateUser() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "Employee",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5099/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getStoredToken()}`,
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "The user could not be created.");
      }

      setSuccess(`${form.fullName} was created as ${form.role}.`);
      setForm({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "Employee",
      });
    } catch (requestError) {
      setError(requestError.message || "The user could not be created.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <DashboardLayout activePage="create-user">
      <div className="create-user-heading">
        <div>
          <p className="create-user-eyebrow">User management</p>
          <h1>Create User</h1>
          <p>Add an employee, support agent, manager, or administrator.</p>
        </div>
      </div>

      <section className="create-user-card">
        <form className="create-user-form" onSubmit={handleSubmit}>
          {error && (
            <div className="create-user-message error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="create-user-message success" role="status">
              {success}
            </div>
          )}

          <div className="create-user-field full-width">
            <label htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Enter the user's full name"
              autoComplete="off"
              required
            />
          </div>

          <div className="create-user-field full-width">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="user@company.com"
              autoComplete="off"
              required
            />
          </div>

          <div className="create-user-field full-width">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={form.role}
              onChange={handleChange}
              required
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="create-user-field">
            <label htmlFor="password">Temporary Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 8 characters"
              minLength="8"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="create-user-field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat the password"
              minLength="8"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="create-user-actions full-width">
            <button
              type="button"
              className="create-user-cancel"
              onClick={() => navigate("/admin-dashboard")}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="create-user-submit"
              disabled={isLoading}
            >
              {isLoading ? "Creating User..." : "Create User"}
            </button>
          </div>
        </form>

        <aside className="create-user-note">
          <span className="create-user-note-icon" aria-hidden="true">
            +
          </span>
          <h2>Account access</h2>
          <p>
            The new user can sign in immediately with the email and temporary
            password you provide.
          </p>
          <p>
            Choose roles carefully. Managers and administrators receive
            additional system permissions.
          </p>
        </aside>
      </section>
    </DashboardLayout>
  );
}

export default CreateUser;
