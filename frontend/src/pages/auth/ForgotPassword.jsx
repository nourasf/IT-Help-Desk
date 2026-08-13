import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../../api/auth";
import logo from "../../assets/logo.png";
import "../../styles/PasswordRecovery.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const result = await forgotPassword(email);

      if (result.token) {
        navigate(`/reset-password?token=${encodeURIComponent(result.token)}`, {
          replace: true,
          state: { email: email.trim() },
        });
        return;
      }

      setMessage(
        result.message ||
          "If an account exists for that email, password recovery instructions have been created."
      );
    } catch (requestError) {
      setError(requestError.message || "Password recovery could not be started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="password-recovery-page">
      <section className="password-recovery-card">
        <Link to="/login" className="password-back-link">← Back to sign in</Link>
        <img src={logo} alt="SupportHub logo" className="password-recovery-logo" />

        <div className="password-recovery-heading">
          <span>Account recovery</span>
          <h1>Forgot your password?</h1>
          <p>Enter the email address connected to your SupportHub account.</p>
        </div>

        <form className="password-recovery-form" onSubmit={handleSubmit}>
          {error && <div className="password-message error" role="alert">{error}</div>}
          {message && <div className="password-message success" role="status">{message}</div>}

          <label htmlFor="recovery-email">Email address</label>
          <input
            id="recovery-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <button type="submit" disabled={loading || !email.trim()}>
            {loading ? "Checking account..." : "Continue"}
          </button>
        </form>

        <p className="password-recovery-footnote">
          Remembered your password? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default ForgotPassword;
