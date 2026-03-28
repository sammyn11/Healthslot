import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const IMG_AUTH =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80";

function homeForRole(role: string) {
  if (role === "patient") return "/patient";
  if (role === "admin") return "/admin";
  return "/staff";
}

type ClinicBrief = { name: string; address: string | null };

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [bookingClinics, setBookingClinics] = useState<ClinicBrief[]>([]);

  useEffect(() => {
    fetch("/api/clinics")
      .then((r) => r.json())
      .then((j: { clinics: ClinicBrief[] }) => {
        setBookingClinics(j.clinics ?? []);
        if (window.location.hash === "#clinic-sign-in") {
          setTimeout(() => {
            document.getElementById("clinic-sign-in")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
        }
      })
      .catch(() => {});
  }, []);

  if (user) return <Navigate to={homeForRole(user.role)} replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      const r = await fetch("/api/auth/me", { credentials: "include" });
      const j = await r.json();
      nav(homeForRole(j.user?.role ?? "staff"));
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Login failed");
    }
  }

  return (
    <main className="main-page">
      <div className="auth-shell">
        <div className="auth-visual" aria-hidden="true">
          <img src={IMG_AUTH} alt="" width="600" height="400" loading="lazy" />
          <p className="auth-visual__caption">Welcome back—one sign-in for patients and care teams.</p>
        </div>

        <div className="auth-card">
          <div className="card">
            <h1>Log in</h1>
            <p className="muted">Patients, clinic staff, and administrators all use this page (FR 2.1).</p>
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
              {err && <p className="error">{err}</p>}
              <button type="submit">Sign in</button>
            </form>
            <p style={{ marginBottom: 0 }}>
              New patient? <Link to="/register">Register</Link>
            </p>
          </div>

          <section id="clinic-sign-in" className="card info-panel" style={{ marginTop: "1.15rem", boxShadow: "var(--shadow)" }}>
            <h2 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>Signing in as a clinic?</h2>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
              <strong>Clinic coordinators</strong> (front desk / approvals) and <strong>providers</strong> sign in here
              with the email issued by your administrator—not a separate “clinic portal.” After sign-in, coordinators open{" "}
              <strong>Staff schedule</strong> to see and confirm all visits for their facility.
            </p>
            {bookingClinics.length > 0 && (
              <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
                <strong>Appointment locations</strong> patients can choose from:
              </p>
            )}
            {bookingClinics.length > 0 && (
              <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.2rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                {bookingClinics.map((c) => (
                  <li key={c.name}>
                    <strong style={{ color: "var(--text)" }}>{c.name}</strong>
                    {c.address ? ` — ${c.address}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Demo coordinators (after seed, <code>clinic1</code> = first location above, through <code>clinic5</code>):{" "}
              <code style={{ fontSize: "0.8rem" }}>clinic1@healthslot.local</code> …{" "}
              <code style={{ fontSize: "0.8rem" }}>clinic5@healthslot.local</code> — same password as other demo
              accounts.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
