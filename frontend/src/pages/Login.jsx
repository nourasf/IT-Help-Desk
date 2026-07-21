import { useState } from "react";
import "./Login.css";

import logo from "../assets/logo.png";
import loginIllustration from "../assets/login-illustration.png";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();

    const loginData = {
      email,
      password,
      rememberMe,
    };

    console.log(loginData);

    // Later, connect this to your backend login endpoint.
  };

  return (
    <main className="login-page">
      <section className="login-form-section">
        <div className="login-form-container">
          <img
            src={logo}
            alt="SupportHub logo"
            className="supporthub-logo"
          />

          <div className="login-heading">
            <h1>Welcome Back</h1>
            <p>Sign in to Continue to your account.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>

              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <input
                id="password"
                type="password"
                placeholder="••••••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                />

                <span className="custom-checkbox"></span>
                <span>Remember me</span>
              </label>

              <a href="/forgot-password" className="forgot-password-link">
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="sign-in-button">
              Sign In
            </button>

            <p className="create-account-text">
              Don’t have an account?{" "}
              <a href="/register">Create account.</a>
            </p>
          </form>
        </div>
      </section>

      <section className="login-visual-section">
        <div className="visual-content">
          <div className="visual-heading">
            <h2>IT Support Made Simple</h2>

            <p>
              Resolve tickets faster and collaborate with your team.
            </p>
          </div>

          <img
            src={loginIllustration}
            alt="IT support illustration"
            className="login-illustration"
          />

 <div className="ticket-notification">
  <div className="ticket-icon">🎫</div>

  <div className="ticket-information">
    <strong>New Ticket</strong>
    <span>Printer Not Working</span>
    <div className="priority-badge">High Priority</div>
  </div>
</div>
        </div>
      </section>
    </main>
  );
}

export default Login;