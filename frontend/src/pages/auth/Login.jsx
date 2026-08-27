import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/auth/Auth.css";
import { saveAuthentication } from "../../utils/authStorage";
import { API_ROOT } from "../../config/api";

import loginIllustration from "../../assets/login-illustration.png";

function SupportHubBrand() {
  return (
    <div className="login-brand" aria-label="SupportHub">
      <svg className="login-brand-mark" viewBox="0 0 88 76" fill="none" aria-hidden="true">
        <path d="M44 7C24.1 7 8 20.7 8 37.6c0 8.2 3.8 15.7 10.1 21.2L13.5 70l15.2-6.2c4.7 2.4 9.9 3.7 15.3 3.7 19.9 0 36-13.4 36-29.9S63.9 7 44 7Z" stroke="currentColor" strokeWidth="4.8" strokeLinejoin="round"/>
        <circle cx="27.5" cy="35" r="5.2" fill="currentColor"/><circle cx="60.5" cy="35" r="5.2" fill="currentColor"/><circle cx="44" cy="31" r="8" fill="currentColor"/>
        <path d="M31.5 51.7c1.8-7.6 6.1-11.4 12.5-11.4s10.7 3.8 12.5 11.4c.5 2.2-1.1 4.3-3.4 4.3H34.9c-2.3 0-3.9-2.1-3.4-4.3Z" fill="currentColor"/>
      </svg>
      <div className="login-brand-name">SUPPORTHUB</div><div className="login-brand-year">SINCE 2026</div>
    </div>
  );
}

async function readLoginResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [rememberMe, setRememberMe] = useState(false); const [error, setError] = useState(""); const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault(); setError(""); setIsLoading(true);
    try {
      const response = await fetch(`${API_ROOT}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      const data = await readLoginResponse(response);
      if (!response.ok) throw new Error(data.message || "Invalid email or password.");
      if (!data.role) throw new Error("The backend did not return the user's role.");
      if (!data.token) throw new Error("The backend did not return a login token.");
      const normalizedRole = data.role.trim().toLowerCase(); saveAuthentication(data.token, data.role.trim(), rememberMe);
      switch (normalizedRole) { case "admin": navigate("/admin-dashboard", { replace: true }); break; case "manager": navigate("/manager-dashboard", { replace: true }); break; case "it support agent": case "agent": case "it": navigate("/agent-dashboard", { replace: true }); break; case "employee": navigate("/employee-dashboard", { replace: true }); break; default: throw new Error(`Unknown user role: ${data.role}`); }
    } catch (error) { console.error("Login error:", error); setError(error.message || "Something went wrong while signing in."); }
    finally { setIsLoading(false); }
  };

  return (
    <main className="login-page"><section className="login-form-section"><div className="login-form-container"><SupportHubBrand /><div className="login-heading"><h1>Welcome Back</h1><p>Sign in to continue to your account.</p></div><form className="login-form" onSubmit={handleSubmit}>{error && <div className="login-error" role="alert">{error}</div>}<div className="form-group"><label htmlFor="email">Email Address</label><input id="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div><div className="form-group"><label htmlFor="password">Password</label><input id="password" type="password" placeholder="••••••••••••••" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div><div className="login-options"><label className="remember-option"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span className="custom-checkbox"></span><span>Remember me</span></label><Link to="/forgot-password" className="forgot-password-link">Forgot Password?</Link></div><button type="submit" className="sign-in-button" disabled={isLoading}>{isLoading ? "Signing In..." : "Sign In"}</button></form></div></section><section className="login-visual-section"><div className="visual-content"><div className="visual-heading"><h2>IT Support Made Simple</h2><p>Resolve tickets faster and collaborate with your team.</p></div><img src={loginIllustration} alt="IT support illustration" className="login-illustration" /></div></section></main>
  );
}

export default Login;
