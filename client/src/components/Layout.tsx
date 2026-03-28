import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const nav = useNavigate();

  async function handleLogout() {
    await logout();
    nav("/");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 3L4 8v8l8 5 8-5V8l-8-5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M12 8v8M8 10.5h8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          HealthSlot
        </Link>
        <nav>
          {!loading && !user && (
            <>
              <Link to="/login" className="btn secondary">
                Log in
              </Link>
              <Link to="/login#clinic-sign-in" className="btn ghost" style={{ fontSize: "0.9rem" }}>
                Clinic / staff
              </Link>
              <Link to="/register" className="btn">
                Register as patient
              </Link>
            </>
          )}
          {user && (
            <>
              {user.role === "patient" && (
                <Link to="/patient" className="btn secondary">
                  My appointments
                </Link>
              )}
              {(user.role === "staff" || user.role === "admin") && (
                <Link to="/staff" className="btn secondary">
                  Staff schedule
                </Link>
              )}
              {user.role === "admin" && (
                <Link to="/admin" className="btn secondary">
                  Admin
                </Link>
              )}
              <span className="nav-user" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                {user.name}
                {user.role === "staff" && user.clinic_name && (
                  <span style={{ display: "block", fontSize: "0.8rem", color: "var(--primary)" }}>{user.clinic_name}</span>
                )}
              </span>
              <button type="button" className="ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
