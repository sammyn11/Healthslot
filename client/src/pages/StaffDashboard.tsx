import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
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
};

type StaffOpt = { id: number; name: string };

/** Daily schedule for providers and admins. Clinic coordinators use `/clinic` instead. */
export default function StaffDashboard() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [staffList, setStaffList] = useState<StaffOpt[]>([]);
  const [viewStaffId, setViewStaffId] = useState<number | "">("");
  const [err, setErr] = useState("");

  const isCoordinator = !!user?.is_clinic_coordinator && user?.clinic_id;

  useEffect(() => {
    if (user?.role !== "admin") return;
    api<{ staff: { id: number; name: string; clinic_name: string | null }[] }>("/api/admin/staff-list").then((r) => {
      setStaffList(
        r.staff.map((s) => ({
          id: s.id,
          name: s.clinic_name ? `${s.name} (${s.clinic_name})` : s.name,
        }))
      );
      if (r.staff.length) setViewStaffId((v) => (v === "" ? r.staff[0].id : v));
    });
  }, [user?.role]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ date });
    if (user?.role === "admin" && viewStaffId !== "") {
      qs.set("staff_id", String(viewStaffId));
    }
    const { appointments } = await api<{ appointments: Row[] }>(`/api/staff/daily?${qs}`);
    setRows(appointments);
  }, [date, user?.role, viewStaffId]);

  useEffect(() => {
    if (user?.role === "admin" && viewStaffId === "") return;
    if (user?.role === "staff" && isCoordinator) return;
    if (user?.role !== "staff" && user?.role !== "admin") return;
    load().catch(() => setRows([]));
  }, [load, user?.role, viewStaffId, isCoordinator]);

  async function confirm(id: number) {
    setErr("");
    try {
      await api(`/api/appointments/${id}/manage`, {
        method: "POST",
        body: JSON.stringify({ status: "confirmed" }),
      });
      load();
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
      load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    }
  }

  if (isCoordinator) {
    return <Navigate to="/clinic" replace />;
  }

  return (
    <main className="main-page">
      <header className="dashboard-title">
        <h1>Staff schedule</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Daily appointments, approve and record attendance (FR 4).
        </p>
      </header>

      <div className="card grid two">
        <div>
          <label htmlFor="day">Date</label>
          <input id="day" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {user?.role === "admin" && (
          <div>
            <label htmlFor="staffpick">Staff member</label>
            <select
              id="staffpick"
              value={viewStaffId === "" ? "" : String(viewStaffId)}
              onChange={(e) => setViewStaffId(e.target.value ? Number(e.target.value) : "")}
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {err && <p className="error">{err}</p>}

      <div className="card">
        <h2>Appointments for {date}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.appt_time}</td>
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
    </main>
  );
}
