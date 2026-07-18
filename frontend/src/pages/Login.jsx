import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("https://localhost:5099/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        setError("Invalid email or password.");
        return;
      }

      const data = await response.json();

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      navigate("/dashboard");
    } catch {
      setError("Unable to connect to the server.");
    }
  }

  return (
    <div>
      <h1>IT Help Desk</h1>

      <form onSubmit={handleSubmit}>
        <h2>Login</h2>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p>{error}</p>}

        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;