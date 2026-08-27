import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { forgotPassword } from "../../api/auth";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await forgotPassword(email);
      sessionStorage.setItem("resetEmail", email.trim());
      navigate("/verify-reset-code");
    } catch (err) {
      setError(err.message || "Unable to send verification code.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <button type="button" className="recovery-back" onClick={() => navigate("/login")}>← Back to login</button>
        <div className="recovery-heading">
          <div className="recovery-icon">?</div>
          <h1>Forgot Password?</h1>
          <p>Enter your SupportHub email address and we'll send a 6-digit verification code.</p>
        </div>
        {error && <div className="recovery-message error">{error}</div>}
        <form className="recovery-form" onSubmit={handleSubmit}>
          <div className="recovery-field">
            <label htmlFor="email">Email Address</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@supporthub.com" autoComplete="email" required />
          </div>
          <button type="submit" className="recovery-primary-button" disabled={isLoading}>{isLoading ? "Sending Code..." : "Send Verification Code"}</button>
        </form>
        <p className="recovery-security-note">For security, we won't reveal whether an account exists for the email entered.</p>
      </section>
    </main>
  );
}

export default ForgotPassword;
