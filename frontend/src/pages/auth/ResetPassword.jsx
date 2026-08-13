import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import logo from "../../assets/logo.png";
import "../../styles/PasswordRecovery.css";

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const email = searchParams.get("email") || location.state?.email || "";
  const devOtp = location.state?.devOtp || "";

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordIssue = useMemo(() => {
    if (!password) return "";
    if (password.length < 8) return "Use at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
    if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
    if (!/[0-9]/.test(password)) return "Add at least one number.";
    return "";
  }, [password]);

  function handleOtpChange(event) {
    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Your recovery email is missing. Start again from Forgot Password.");
      return;
    }

    if (otp.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    if (passwordIssue) {
      setError(passwordIssue);
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(email, otp, password);
      setSuccess(result.message || "Password reset successfully.");
      setOtp("");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (requestError) {
      setError(requestError.message || "The password could not be reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="password-recovery-page">
      <section className="password-recovery-card">
        <Link to="/forgot-password" className="password-back-link">← Request another code</Link>
        <img src={logo} alt="SupportHub logo" className="password-recovery-logo" />

        <div className="password-recovery-heading">
          <span>Verify your account</span>
          <h1>Enter your verification code</h1>
          <p>
            {email
              ? `Enter the 6-digit code for ${email}, then choose your new password.`
              : "Enter your verification code and choose a new password."}
          </p>
        </div>

        {devOtp && (
          <div className="password-dev-otp" role="status">
            <span>Development verification code</span>
            <strong>{devOtp}</strong>
            <small>Email delivery is not connected yet. This code expires in 10 minutes.</small>
          </div>
        )}

        {!email ? (
          <div className="password-message error" role="alert">
            Recovery information is missing. <Link to="/forgot-password">Start again.</Link>
          </div>
        ) : (
          <form className="password-recovery-form" onSubmit={handleSubmit}>
            {error && <div className="password-message error" role="alert">{error}</div>}
            {success && <div className="password-message success" role="status">{success}</div>}

            <label htmlFor="verification-code">Verification code</label>
            <input
              id="verification-code"
              className="password-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={handleOtpChange}
              placeholder="000000"
              maxLength={6}
              required
            />

            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
            {passwordIssue && <small className="password-requirement warning">{passwordIssue}</small>}

            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your new password"
              autoComplete="new-password"
              required
            />

            <button
              type="submit"
              disabled={loading || otp.length !== 6 || !password || !confirmPassword || Boolean(success)}
            >
              {loading ? "Resetting password..." : success ? "Password changed" : "Verify & Reset Password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default ResetPassword;
