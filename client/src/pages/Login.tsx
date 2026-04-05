import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { homeAfterLogin } from "../dashboardPaths";
const IMG_AUTH =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [credentialErr, setCredentialErr] = useState("");

  if (user) return <Navigate to={homeAfterLogin(user)} replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCredentialErr("");
    try {
      const u = await login(email, password);
      nav(homeAfterLogin(u));
    } catch (ex: unknown) {
      setCredentialErr(ex instanceof Error ? ex.message : "Login failed");
    }
  }

  return (
    <main className="main-page">
      <div className="auth-shell">
        <div className="auth-visual" aria-hidden="true">
          <img src={IMG_AUTH} alt="" width="600" height="400" loading="lazy" />
          <p className="auth-visual__caption">Care teams and patients share one front door.</p>
        </div>

        <div className="auth-card">
          <div className="card card--accent-top" id="clinic-sign-in">
            <h1 style={{ marginTop: 0 }}>Clinic coordinator?</h1>
            <p className="muted" style={{ marginTop: 0 }}>
              Use the clinic sign-in page: pick your location, enter your clinic password, then open your dashboard.
            </p>
            <Link to="/clinic-login" className="btn" style={{ width: "100%", justifyContent: "center" }}>
              Open clinic sign-in
            </Link>
          </div>

          <div className="card" style={{ marginTop: "1.15rem" }}>
            <h1 style={{ marginTop: 0 }}>Patient, provider, or admin</h1>
            <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
              Sign in with email and password.
            </p>
            <form onSubmit={onSubmit}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="pw">Password</label>
              <input
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {credentialErr && <p className="error">{credentialErr}</p>}
              <button type="submit">Sign in</button>
            </form>
            <p style={{ marginBottom: 0 }}>
              New patient? <Link to="/register">Register</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
