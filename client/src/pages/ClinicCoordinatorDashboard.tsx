import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

type Row = {
  id: number;
  appt_date: string;
  appt_time: string;
  status: string;
  patient_name: string;
  patient_email: string;
  staff_name?: string;
  specialization?: string | null;
};

type StaffOpt = { id: number; name: string };

export default function ClinicCoordinatorDashboard() {
  const { user, refresh } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  /** All clinic appointments (any date) — used so pending approvals are not missed when the date filter is wrong. */
  const [clinicWide, setClinicWide] = useState<Row[]>([]);
  const [staffList, setStaffList] = useState<StaffOpt[]>([]);
  const [viewStaffId, setViewStaffId] = useState<number | "">("");
  const [err, setErr] = useState("");

  const clinicId = user?.clinic_id;

  useEffect(() => {
    if (!clinicId) return;
    api<{ staff: { id: number; name: string }[] }>(`/api/staff-directory?clinic_id=${clinicId}`).then((r) => {
      setStaffList(r.staff.map((s) => ({ id: s.id, name: s.name })));
    });
  }, [clinicId]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ date });
    if (viewStaffId !== "") qs.set("staff_id", String(viewStaffId));
    const { appointments } = await api<{ appointments: Row[] }>(`/api/staff/daily?${qs}`);
    setRows(appointments);
  }, [date, viewStaffId]);

  const loadClinicWide = useCallback(async () => {
    const { appointments } = await api<{ appointments: Row[] }>("/api/appointments");
    setClinicWide(appointments);
  }, []);

  useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  useEffect(() => {
    if (!clinicId) return;
    loadClinicWide().catch(() => setClinicWide([]));
  }, [clinicId, loadClinicWide]);

  const pending = useMemo(
    () =>
      clinicWide
        .filter((r) => r.status === "pending")
        .sort(
          (a, b) =>
            a.appt_date.localeCompare(b.appt_date) || a.appt_time.localeCompare(b.appt_time)
        ),
    [clinicWide]
  );

  async function confirm(id: number) {
    setErr("");
    try {
      await api(`/api/appointments/${id}/manage`, {
        method: "POST",
        body: JSON.stringify({ status: "confirmed" }),
      });
      await load();
      await loadClinicWide();
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    }
  }

  async function mark(id: number, status: "completed" | "missed" | "no_show") {
    setErr("");
    try {
      await api(`/api/appointments/${id}/manage`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
      await loadClinicWide();
      await refresh();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    }
  }

  return (
    <main className="main-page">
      <section className="card clinic-dashboard-hero">
        <p className="clinic-dashboard-hero__eyebrow">Clinic dashboard</p>
        <h1 className="clinic-dashboard-hero__title">{user?.clinic_name ?? "Your clinic"}</h1>
        {user?.clinic_address && (
          <p className="clinic-dashboard-hero__address muted" style={{ marginBottom: "0.35rem" }}>
            {user.clinic_address}
          </p>
        )}
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Signed in as <strong>{user?.name}</strong>. Review booking requests and confirm visits for your location.
        </p>
      </section>

      <header className="dashboard-title">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", margin: "0 0 0.35rem" }}>
          Approvals & schedule
        </h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Pending visits need <strong>Confirm</strong> before they are fully booked. Confirmed visits can be marked{" "}
          <strong>Completed</strong> or <strong>No-show</strong>.
        </p>
      </header>

      <div className="card grid two">
        <div>
          <label htmlFor="clinic-day">Date</label>
          <input id="clinic-day" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="clinic-docpick">Filter by provider (optional)</label>
          <select
            id="clinic-docpick"
            value={viewStaffId === "" ? "" : String(viewStaffId)}
            onChange={(e) => setViewStaffId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All providers at this clinic</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <p className="error">{err}</p>}

      {pending.length > 0 && (
        <div className="card card--warm clinic-pending-card">
          <h2 style={{ marginTop: 0 }}>Needs your approval ({pending.length})</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
            Patients are waiting for this clinic to confirm these bookings.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Provider</th>
                  <th>Patient</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>{r.appt_date}</td>
                    <td>{r.appt_time}</td>
                    <td>{r.staff_name ?? "—"}</td>
                    <td>
                      {r.patient_name}
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{r.patient_email}</div>
                    </td>
                    <td>
                      <button type="button" onClick={() => confirm(r.id)}>
                        Approve / Confirm
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2>All appointments — {date}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider</th>
                <th>Patient</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.appt_time}</td>
                  <td>{r.staff_name ?? "—"}</td>
                  <td>
                    {r.patient_name}
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{r.patient_email}</div>
                  </td>
                  <td>
                    <span className={`badge ${r.status}`}>{r.status}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {r.status === "pending" && (
                        <button type="button" onClick={() => confirm(r.id)}>
                          Confirm
                        </button>
                      )}
                      {r.status === "confirmed" && (
                        <>
                          <button type="button" onClick={() => mark(r.id, "completed")}>
                            Completed
                          </button>
                          <button type="button" className="secondary" onClick={() => mark(r.id, "no_show")}>
                            No-show
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="muted">No appointments this day.</p>}
      </div>

      <p className="muted" style={{ fontSize: "0.9rem" }}>
        <Link to="/">Home</Link>
      </p>
    </main>
  );
}
