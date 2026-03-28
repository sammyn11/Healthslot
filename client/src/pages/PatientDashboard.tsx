import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Link } from "react-router-dom";

type Clinic = { id: number; name: string; address: string | null; slug: string };
type Appt = {
  id: number;
  appt_date: string;
  appt_time: string;
  status: string;
  staff_name: string;
  staff_id?: number;
  specialization: string | null;
  clinic_name?: string | null;
};

export default function PatientDashboard() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);
  const [clinicId, setClinicId] = useState<number | "">("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [list, setList] = useState<Appt[]>([]);
  const [notifications, setNotifications] = useState<
    { id: number; message: string; is_read: number }[]
  >([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [rescheduleId, setRescheduleId] = useState<number | "">("");
  const [rDate, setRDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rTimes, setRTimes] = useState<string[]>([]);
  const [rSlot, setRSlot] = useState("");

  const loadAppointments = useCallback(async () => {
    const { appointments } = await api<{ appointments: Appt[] }>("/api/appointments");
    setList(appointments);
  }, []);

  const loadNotifications = useCallback(async () => {
    const { notifications: n } = await api<{
      notifications: { id: number; message: string; is_read: number }[];
    }>("/api/notifications");
    setNotifications(n);
  }, []);

  useEffect(() => {
    setClinicsLoading(true);
    api<{ clinics: Clinic[] }>("/api/clinics")
      .then((r) => setClinics(r.clinics))
      .catch(() => setClinics([]))
      .finally(() => setClinicsLoading(false));
  }, []);

  useEffect(() => {
    loadAppointments();
    loadNotifications();
  }, [loadAppointments, loadNotifications]);

  const rescheduleStaffId = list.find((a) => a.id === rescheduleId)?.staff_id;

  useEffect(() => {
    if (!rescheduleStaffId || !rDate) {
      setRTimes([]);
      return;
    }
    api<{ times: string[] }>(`/api/staff-directory/${rescheduleStaffId}/slots?date=${rDate}`).then((r) => {
      setRTimes(r.times);
      setRSlot(r.times[0] ?? "");
    });
  }, [rescheduleStaffId, rDate, list, rescheduleId]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const created = await api<{ appt_time: string }>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          clinic_id: clinicId,
          appt_date: date,
        }),
      });
      setMsg(
        `Booking request for ${date} at ${created.appt_time}. A clinician at this clinic was assigned; you will be notified when it is confirmed.`
      );
      loadAppointments();
      loadNotifications();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Booking failed");
    }
  }

  async function cancel(id: number) {
    setErr("");
    try {
      await api(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      });
      loadAppointments();
      loadNotifications();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    }
  }

  async function rescheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rescheduleId === "" || !rSlot) return;
    setErr("");
    try {
      await api(`/api/appointments/${rescheduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reschedule", appt_date: rDate, appt_time: rSlot }),
      });
      setMsg("Reschedule submitted.");
      setRescheduleId("");
      loadAppointments();
      loadNotifications();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Reschedule failed");
    }
  }

  return (
    <main className="main-page">
      <header className="dashboard-title">
        <h1>Patient dashboard</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Book a visit, reschedule, or cancel (FR 3).
        </p>
      </header>

      <div className="card">
        <h2>Notifications</h2>
        {notifications.length === 0 && <p className="muted">No notifications yet.</p>}
        <ul className="stack-sm" style={{ paddingLeft: "1.1rem" }}>
          {notifications.slice(0, 8).map((n) => (
            <li key={n.id}>{n.message}</li>
          ))}
        </ul>
        <Link to="/" className="btn secondary">
          Home
        </Link>
      </div>

      <div className="card">
        <h2>Book an appointment</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Choose a clinic and visit date. The earliest open slot that day is reserved for you and a clinician is
          assigned automatically.
        </p>
        <form onSubmit={book} className="grid two">
          <div>
            <label htmlFor="clinic-pick">Clinic location</label>
            <select
              id="clinic-pick"
              value={clinicId === "" ? "" : String(clinicId)}
              onChange={(e) => setClinicId(e.target.value ? Number(e.target.value) : "")}
              required
              disabled={clinicsLoading || clinics.length === 0}
            >
              <option value="">
                {clinicsLoading
                  ? "Loading locations…"
                  : clinics.length === 0
                    ? "No clinics available"
                    : "— Select a clinic —"}
              </option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.address ? ` — ${c.address}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="d">Visit date</label>
            <input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" disabled={clinicId === ""}>
              Request booking
            </button>
          </div>
        </form>
        {err && <p className="error">{err}</p>}
        {msg && <p style={{ color: "var(--primary-dark)" }}>{msg}</p>}
      </div>

      <div className="card">
        <h2>Reschedule (FR 3.3)</h2>
        <p className="muted">Pick an active appointment, then choose a new open slot.</p>
        <form onSubmit={rescheduleSubmit} className="grid two">
          <div>
            <label>Appointment</label>
            <select
              value={rescheduleId === "" ? "" : String(rescheduleId)}
              onChange={(e) => setRescheduleId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select…</option>
              {list
                .filter((a) => a.status !== "cancelled" && a.status !== "completed")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.appt_date} {a.appt_time} — {a.staff_name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label>New date</label>
            <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} required />
          </div>
          <div>
            <label>New time</label>
            <select value={rSlot} onChange={(e) => setRSlot(e.target.value)} required>
              {rTimes.length === 0 && <option value="">Pick appointment & date first</option>}
              {rTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" disabled={rescheduleId === "" || !rTimes.length}>
              Reschedule
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Your appointments</h2>
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Clinic</th>
              <th>Assigned clinician</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td>{a.appt_date}</td>
                <td>{a.appt_time}</td>
                <td>{a.clinic_name ?? "—"}</td>
                <td>{a.staff_name}</td>
                <td>
                  <span className={`badge ${a.status}`}>{a.status}</span>
                </td>
                <td>
                  {a.status !== "cancelled" && a.status !== "completed" && (
                    <button type="button" className="danger" onClick={() => cancel(a.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </main>
  );
}
