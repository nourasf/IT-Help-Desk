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
      const cleanEmail = email.trim();
      const result = await forgotPassword(cleanEmail);

      if (result.devOtp) {
        navigate(`/reset-password?email=${encodeURIComponent(cleanEmail)}`, {
          replace: true,
          state: {
            email: cleanEmail,
            devOtp: result.devOtp,
          },
        });
        return;
      }

      setMessage(
        result.message ||
          "If an account exists for that email, a verification code has been created."
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
          <p>Enter your account email and we&apos;ll create a 6-digit verification code.</p>
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
            {loading ? "Creating code..." : "Send Verification Code"}
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
