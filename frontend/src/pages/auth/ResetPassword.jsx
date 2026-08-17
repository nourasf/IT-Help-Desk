import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function ResetPassword() {
  const navigate = useNavigate();
  const email = sessionStorage.getItem("resetEmail");
  const resetToken = sessionStorage.getItem("passwordResetToken");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!email) navigate("/forgot-password");
  }, [email, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 8) { setError("Password must contain at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:5099/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetToken, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to reset password.");
      setSuccess("Your password has been changed successfully.");
      sessionStorage.removeItem("resetEmail");
      sessionStorage.removeItem("passwordResetToken");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <div className="recovery-heading"><div className="recovery-icon">✓</div><h1>Create New Password</h1><p>Choose a new password for your SupportHub account.</p></div>
        {error && <div className="recovery-message error">{error}</div>}
        {success && <div className="recovery-message success">{success}</div>}
        <form className="recovery-form" onSubmit={handleSubmit}>
          <div className="recovery-field"><label htmlFor="newPassword">New Password</label><input id="newPassword" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" minLength="8" autoComplete="new-password" required /></div>
          <div className="recovery-field"><label htmlFor="confirmPassword">Confirm New Password</label><input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your new password" minLength="8" autoComplete="new-password" required /></div>
          <button type="submit" className="recovery-primary-button" disabled={isLoading || success}>{isLoading ? "Resetting Password..." : "Reset Password"}</button>
        </form>
      </section>
    </main>
  );
}

export default ResetPassword;
