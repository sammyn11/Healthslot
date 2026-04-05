import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { BOOKING_CLINICS } from "../clinicsCatalog";
import { homeAfterLogin } from "../dashboardPaths";

/**
 * Simple coordinator-only sign-in: pick clinic + password in one place, then open /clinic.
 */
export default function ClinicLogin() {
  const { user, fetchClinicCoordinatorState, setupClinicCoordinatorPassword, loginClinicCoordinator } = useAuth();
  const nav = useNavigate();
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNeedsSetup(false);
      return;
    }
    let cancel = false;
    setLoadingMeta(true);
    setErr("");
    fetchClinicCoordinatorState(slug)
      .then((s) => {
        if (!cancel) setNeedsSetup(s.needsInitialPassword);
      })
      .catch((e: unknown) => {
        if (!cancel) setErr(e instanceof Error ? e.message : "Could not load clinic");
      })
      .finally(() => {
        if (!cancel) setLoadingMeta(false);
      });
    return () => {
      cancel = true;
    };
  }, [slug, fetchClinicCoordinatorState]);

  if (user) {
    return <Navigate to={homeAfterLogin(user)} replace />;
  }

  async function goToDashboard(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!slug) {
      setErr("Choose your clinic from the list.");
      return;
    }
    const pw = password.trim();
    if (!pw) {
      setErr("Enter the clinic password.");
      return;
    }
    if (needsSetup) {
      if (pw.length < 4) {
        setErr("Password must be at least 4 characters.");
        return;
      }
      if (pw !== password2.trim()) {
        setErr("Passwords do not match.");
        return;
      }
    }
    setBusy(true);
    try {
      if (needsSetup) {
        await setupClinicCoordinatorPassword(slug, pw);
      } else {
        await loginClinicCoordinator(slug, pw);
      }
      nav("/clinic", { replace: true });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="main-page clinic-login-page">
      <div className="card clinic-login-card card--accent-top" style={{ maxWidth: 440, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Clinic dashboard — sign in</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Choose your location and enter the clinic password you were given.
        </p>

        <form onSubmit={goToDashboard} className="clinic-login-form">
          <label htmlFor="clinic-select">Your clinic</label>
          <select
            id="clinic-select"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          >
            <option value="">— Select a clinic —</option>
            {BOOKING_CLINICS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          {slug && loadingMeta && <p className="muted" style={{ margin: "0 0 0.5rem" }}>Checking clinic…</p>}

          {needsSetup ? (
            <>
              <label htmlFor="pw-new">Create your password (first time only)</label>
              <input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={4}
                placeholder="At least 4 characters"
              />
              <label htmlFor="pw-new2">Confirm password</label>
              <input
                id="pw-new2"
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                minLength={4}
              />
            </>
          ) : (
            <>
              <label htmlFor="pw-clinic">Clinic password</label>
              <input
                id="pw-clinic"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Clinic password"
              />
            </>
          )}

          {err && <p className="error">{err}</p>}

          <button type="submit" className="btn clinic-login-submit" disabled={busy || !slug || loadingMeta}>
            {busy ? "Opening…" : "Open clinic dashboard"}
          </button>
        </form>

        <p className="muted" style={{ marginBottom: 0, fontSize: "0.9rem" }}>
          <Link to="/login">Full login</Link> (patients, providers, admin) · <Link to="/">Home</Link>
        </p>
      </div>
    </main>
  );
}
