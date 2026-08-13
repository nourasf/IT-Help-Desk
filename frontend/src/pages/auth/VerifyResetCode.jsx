import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/PasswordRecovery.css";

function VerifyResetCode() {
  const navigate = useNavigate();

  const email = sessionStorage.getItem("resetEmail");

  const [digits, setDigits] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) {
      navigate("/forgot-password");
    }
  }, [email, navigate]);

  function handleChange(index, value) {
    const cleanValue = value.replace(/\D/g, "");

    if (!cleanValue) {
      const updated = [...digits];
      updated[index] = "";
      setDigits(updated);
      return;
    }

    const updated = [...digits];
    updated[index] = cleanValue[cleanValue.length - 1];

    setDigits(updated);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, event) {
    if (
      event.key === "Backspace" &&
      !digits[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event) {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    const updated = ["", "", "", "", "", ""];

    pasted.split("").forEach((digit, index) => {
      updated[index] = digit;
    });

    setDigits(updated);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    const otp = digits.join("");

    if (otp.length !== 6) {
      setError("Enter the complete 6-digit code.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5099/api/auth/verify-reset-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            otp,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "The verification code is invalid."
        );
      }

      if (data.resetToken) {
        sessionStorage.setItem(
          "passwordResetToken",
          data.resetToken
        );
      }

      navigate("/reset-password");
    } catch (err) {
      setError(
        err.message || "The verification code is invalid."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <button
          type="button"
          className="recovery-back"
          onClick={() => navigate("/forgot-password")}
        >
          ← Change email
        </button>

        <div className="recovery-heading">
          <div className="recovery-icon">#</div>

          <h1>Enter Verification Code</h1>

          <p>
            Enter the 6-digit code sent to the phone number
            linked to your account.
          </p>

          <strong className="recovery-email">
            {email}
          </strong>
        </div>

        {error && (
          <div className="recovery-message error">
            {error}
          </div>
        )}

        <form
          className="recovery-form"
          onSubmit={handleSubmit}
        >
          <div
            className="otp-inputs"
            onPaste={handlePaste}
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                maxLength="1"
                className={digit ? "filled" : ""}
                value={digit}
                onChange={(event) =>
                  handleChange(index, event.target.value)
                }
                onKeyDown={(event) =>
                  handleKeyDown(index, event)
                }
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          <button
            type="submit"
            className="recovery-primary-button"
            disabled={isLoading}
          >
            {isLoading ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        <button
          type="button"
          className="recovery-link-button"
          onClick={() => navigate("/forgot-password")}
        >
          Didn't receive a code? Send another
        </button>
      </section>
    </main>
  );
}

export default VerifyResetCode;