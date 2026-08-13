import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/Auth.css";
import { saveAuthentication } from "../../utils/authStorage";

import logo from "../../assets/logo.png";
import loginIllustration from "../../assets/login-illustration.png";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5099/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Invalid email or password.");
      if (!data.role) throw new Error("The backend did not return the user's role.");
      if (!data.token) throw new Error("The backend did not return a login token.");

      const normalizedRole = data.role.trim().toLowerCase();
      saveAuthentication(data.token, data.role.trim(), rememberMe);

      switch (normalizedRole) {
        case "admin": navigate("/admin-dashboard", { replace: true }); break;
        case "manager": navigate("/manager-dashboard", { replace: true }); break;
        case "it support agent":
        case "agent":
        case "it": navigate("/agent-dashboard", { replace: true }); break;
        case "employee": navigate("/employee-dashboard", { replace: true }); break;
        default: throw new Error(`Unknown user role: ${data.role}`);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(error.message || "Something went wrong while signing in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-form-section">
        <div className="login-form-container">
          <img src={logo} alt="SupportHub logo" className="supporthub-logo" />
          <div className="login-heading"><h1>Welcome Back</h1><p>Sign in to continue to your account.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error" role="alert">{error}</div>}
            <div className="form-group"><label htmlFor="email">Email Address</label><input id="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
            <div className="form-group"><label htmlFor="password">Password</label><input id="password" type="password" placeholder="••••••••••••••" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div>
            <div className="login-options">
              <label className="remember-option"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span className="custom-checkbox"></span><span>Remember me</span></label>
              <Link to="/forgot-password" className="forgot-password-link" onClick={()=>navigate ("/forgot-password")}>Forgot Password?</Link>
            </div>
            <button type="submit" className="sign-in-button" disabled={isLoading}>{isLoading ? "Signing In..." : "Sign In"}</button>
          </form>
        </div>
      </section>
      <section className="login-visual-section">
        <div className="visual-content">
          <div className="visual-heading"><h2>IT Support Made Simple</h2><p>Resolve tickets faster and collaborate with your team.</p></div>
          <img src={loginIllustration} alt="IT support illustration" className="login-illustration" />
          <div className="ticket-notification"><div className="ticket-icon">🎫</div><div className="ticket-information"><strong>New Ticket</strong><span>Printer Not Working</span><div className="priority-badge">High Priority</div></div></div>
        </div>
      </section>
    </main>
  );
}

export default Login;
