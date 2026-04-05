import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { homeAfterLogin } from "../dashboardPaths";

const IMG_HERO =
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=80";

export default function Home() {
  const { user } = useAuth();

  return (
    <main className="main-page">
      <section className="hero-home">
        <div className="hero-home__copy">
          <h1>Healthcare appointments, simplified</h1>
          <p className="page-lead">
            Book and manage visits online—pick a clinic and date; the system assigns the first open slot and a
            clinician. Each clinic has a coordinator login to approve bookings. Built for clarity on phones and
            lighter connections.
          </p>
          {!user && (
            <div className="hero-actions">
              <Link to="/register" className="btn">
                Create a patient account
              </Link>
              <Link to="/login" className="btn secondary">
                Sign in
              </Link>
              <Link to="/clinic-login" className="btn secondary">
                Clinic coordinator sign in
              </Link>
            </div>
          )}
          {user?.role === "patient" && (
            <div className="hero-actions">
              <Link to="/patient" className="btn">
                Go to your dashboard
              </Link>
            </div>
          )}
          {user?.role === "staff" && (
            <div className="hero-actions">
              <Link to={homeAfterLogin(user)} className="btn">
                {user.is_clinic_coordinator ? "Open clinic dashboard" : "Open staff schedule"}
              </Link>
            </div>
          )}
          {user?.role === "admin" && (
            <div className="hero-actions">
              <Link to="/staff" className="btn">
                Open staff schedule
              </Link>
            </div>
          )}
        </div>
        <div className="hero-home__visual" aria-hidden="true">
          <img src={IMG_HERO} alt="" loading="eager" width="700" height="500" />
        </div>
      </section>

      <div className="grid two">
        <div className="card card--accent-top feature-card">
          <div className="feature-card__icon" aria-hidden="true">
            🏥
          </div>
          <h2>For patients</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Register, book a clinic visit by date, reschedule or cancel—and receive reminders.
          </p>
        </div>
        <div className="card card--warm feature-card feature-card--coral">
          <div className="feature-card__icon" aria-hidden="true">
            👨‍⚕️
          </div>
          <h2>For clinic teams</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Providers use the staff schedule; coordinators open their <strong>clinic dashboard</strong> after
            signing in with their location to approve visits. Start at{" "}
            <Link to="/clinic-login">Clinic sign-in</Link>. Administrators manage users and reports.
          </p>
        </div>
      </div>

      <section className="card capability-block card--accent-top" aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading">Core capabilities</h2>
        <ul className="capability-list">
          <li>Allow healthcare staff to manage appointment schedules</li>
          <li>Send automated appointment reminders</li>
          <li>Generate appointment and attendance reports</li>
          <li>Provide role-based access control</li>
        </ul>
      </section>
    </main>
  );
}
