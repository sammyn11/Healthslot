import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientDashboard from "./pages/PatientDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import ClinicCoordinatorDashboard from "./pages/ClinicCoordinatorDashboard";
import ClinicLogin from "./pages/ClinicLogin";
import AdminDashboard from "./pages/AdminDashboard";

function RoleRoute({
  role,
  children,
}: {
  role: "patient" | "staff" | "admin";
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <main className="card">Loading…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "staff" && user.role === "admin") return <>{children}</>;
  if (user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CoordinatorRoute({ children }: { children: ReactNode }) {
  const { user, loading, refresh } = useAuth();
  const [retried, setRetried] = useState(false);
  useEffect(() => {
    if (loading || retried || !user) return;
    if (user.role === "staff" && user.clinic_id && !user.is_clinic_coordinator) {
      refresh().finally(() => setRetried(true));
    }
  }, [loading, user, refresh, retried]);
  if (loading) {
    return (
      <main className="main-page">
        <p className="muted">Loading your account…</p>
      </main>
    );
  }
  if (!user) return <Navigate to="/clinic-login" replace />;
  if (user.role !== "staff" || !user.is_clinic_coordinator || !user.clinic_id) {
    return <Navigate to="/staff" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="clinic-login" element={<ClinicLogin />} />
        <Route path="register" element={<Register />} />
        <Route
          path="patient"
          element={
            <RoleRoute role="patient">
              <PatientDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="clinic"
          element={
            <CoordinatorRoute>
              <ClinicCoordinatorDashboard />
            </CoordinatorRoute>
          }
        />
        <Route
          path="staff"
          element={
            <RoleRoute role="staff">
              <StaffDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="admin"
          element={
            <RoleRoute role="admin">
              <AdminDashboard />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
