import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";

const IMG_REGISTER =
  "https://images.unsplash.com/photo-1579684385127-1ef15d29a1ce?auto=format&fit=crop&w=900&q=80";

export default function Register() {
  const { register, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (user) return <Navigate to="/patient" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await register(name, email, password);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Registration failed");
    }
  }

  return (
    <main className="main-page">
      <div className="auth-shell">
        <div className="auth-visual" aria-hidden="true">
          <img src={IMG_REGISTER} alt="" width="600" height="400" loading="lazy" />
          <p className="auth-visual__caption">Join in seconds—book care at a clinic near you.</p>
        </div>

        <div className="auth-card">
          <div className="card">
            <h1>Patient registration</h1>
            <p className="muted">Create an account to book appointments (FR 1.1).</p>
            <form onSubmit={onSubmit}>
              <label htmlFor="name">Full name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="pw">Password</label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              {err && <p className="error">{err}</p>}
              <button type="submit">Register</button>
            </form>
            <p style={{ marginBottom: 0 }}>
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
