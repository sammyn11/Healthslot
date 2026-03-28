import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

type Clinic = { id: number; name: string; address: string | null; slug: string };

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: string;
  specialization: string | null;
  clinic_id: number | null;
  is_clinic_coordinator: number;
  clinic_name: string | null;
  active: number;
};

export default function AdminDashboard() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState<number | "">("");
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<
    { id: number; action: string; details: string | null; created_at: string; user_email: string | null }[]
  >([]);
  const [err, setErr] = useState("");

  const loadUsers = useCallback(async () => {
    const { users: u } = await api<{ users: UserRow[] }>("/api/admin/users");
    setUsers(u);
  }, []);

  const loadReport = useCallback(async () => {
    const r = await api<Record<string, unknown>>("/api/admin/reports/summary");
    setReport(r);
  }, []);

  const loadLogs = useCallback(async () => {
    const { logs: l } = await api<{ logs: typeof logs }>("/api/admin/logs?limit=80");
    setLogs(l);
  }, []);

  useEffect(() => {
    api<{ clinics: Clinic[] }>("/api/clinics")
      .then((r) => {
        setClinics(r.clinics);
        if (r.clinics.length) setClinicId((prev) => (prev === "" ? r.clinics[0].id : prev));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUsers().catch(() => {});
    loadReport().catch(() => {});
    loadLogs().catch(() => {});
  }, [loadUsers, loadReport, loadLogs]);

  async function registerStaff(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      if (clinicId === "") {
        setErr("Select a clinic");
        return;
      }
      await api("/api/admin/staff", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name,
          specialization: spec || undefined,
          clinic_id: clinicId,
          is_clinic_coordinator: isCoordinator,
        }),
      });
      setEmail("");
      setPassword("");
      setName("");
      setSpec("");
      setIsCoordinator(false);
      loadUsers();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    }
  }

  async function toggleUser(id: number, active: boolean) {
    setErr("");
    try {
      await api(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !active }),
      });
      loadUsers();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    }
  }

  return (
    <main className="main-page main--wide">
      <header className="dashboard-title">
        <h1>Administrator</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Register staff, manage users, reports, and audit logs (FR 1.2, FR 6, NFR 5).
        </p>
      </header>

      {err && <p className="error">{err}</p>}

      <div className="card">
        <h2>Register healthcare staff (FR 1.2)</h2>
        <form onSubmit={registerStaff} className="grid two">
          <div>
            <label>Clinic</label>
            <select
              value={clinicId === "" ? "" : String(clinicId)}
              onChange={(e) => setClinicId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Temporary password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <label>Specialization</label>
            <input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="e.g. Nursing" />
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                type="checkbox"
                checked={isCoordinator}
                onChange={(e) => setIsCoordinator(e.target.checked)}
              />
              Clinic coordinator (approves all visits at this clinic)
            </label>
          </div>
          <div>
            <button type="submit">Create staff account</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Reports (FR 6.1)</h2>
        {report && (
          <pre style={{ overflow: "auto", fontSize: "0.85rem" }}>{JSON.stringify(report, null, 2)}</pre>
        )}
        <button type="button" className="secondary" onClick={() => loadReport()}>
          Refresh
        </button>
      </div>

      <div className="card">
        <h2>Users</h2>
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Clinic</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {u.role}
                  {u.role === "staff" && u.is_clinic_coordinator ? " (coordinator)" : ""}
                </td>
                <td>{u.clinic_name ?? "—"}</td>
                <td>
                  {u.active ? "Yes" : "No"}{" "}
                  {u.role !== "admin" && (
                    <button type="button" className="secondary" onClick={() => toggleUser(u.id, !!u.active)}>
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card">
        <h2>System logs</h2>
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.created_at}</td>
                <td>{l.user_email ?? "—"}</td>
                <td>{l.action}</td>
                <td style={{ fontSize: "0.8rem" }}>{l.details ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <button type="button" className="secondary" onClick={() => loadLogs()}>
          Refresh logs
        </button>
      </div>
    </main>
  );
}
