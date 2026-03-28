import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientDashboard from "./pages/PatientDashboard";
import StaffDashboard from "./pages/StaffDashboard";
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
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
