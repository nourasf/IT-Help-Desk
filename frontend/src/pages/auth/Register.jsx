import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/Register.css";

import logo from "../../assets/logo.png";
import registerIllustration from "../../assets/login-illustration.png";

function Register() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:5099/api/auth/register",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            fullName,
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Registration failed."
        );
      }

      navigate("/login");
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="register-page">
      <section className="register-form-section">
        <div className="register-form-container">
          <img
            src={logo}
            alt="SupportHub logo"
            className="supporthub-logo"
          />

          <div className="register-heading">
            <h1>Create Account</h1>
            <p>Create your employee account.</p>
          </div>

          <form
            className="register-form"
            onSubmit={handleSubmit}
          >
            {error && (
              <div className="register-error">
                {error}
              </div>
            )}

            <div className="register-field">
              <label htmlFor="fullName">Full Name</label>

              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="email">Email Address</label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="password">Password</label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="confirmPassword">
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm your password"
                required
              />
            </div>

            <button
              type="submit"
              className="register-button"
              disabled={isLoading}
            >
              {isLoading
                ? "Creating Account..."
                : "Create Account"}
            </button>

            <p className="login-text">
              Already have an account?{" "}
              <Link to="/login">Sign in</Link>
            </p>
          </form>
        </div>
      </section>

      <section className="register-image-section">
        <div className="register-image-content">
          <img
            src={registerIllustration}
            alt="IT support illustration"
          />

          <h2>Join SupportHub</h2>

          <p>
            Create your account and get quick support for
            your technical issues.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Register;