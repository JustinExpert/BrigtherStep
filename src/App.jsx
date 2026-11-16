import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { homeFor, useAuth } from "./lib/AuthContext.jsx";
import { usePermission } from "./lib/usePermission.js";
import { ADMINS, STAFF } from "./lib/permissions.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import { ForgotPassword, ResetPassword } from "./pages/PasswordReset.jsx";
import MyAccount from "./pages/MyAccount.jsx";
import Users from "./pages/Users.jsx";
import SchoolSetup from "./pages/SchoolSetup.jsx";
import Roles from "./pages/Roles.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import ParentDashboard from "./pages/ParentDashboard.jsx";
import Students, { AdmissionForm, StudentDetails } from "./pages/Students.jsx";
import { Classes, Subjects, Teachers } from "./pages/Records.jsx";
import Routine from "./pages/Routine.jsx";
import Attendance from "./pages/Attendance.jsx";
import Notice from "./pages/Notice.jsx";
import Assignments from "./pages/Assignments.jsx";
import Gradebook from "./pages/Gradebook.jsx";
import ReportCard from "./pages/ReportCard.jsx";
import Reports from "./pages/Reports.jsx";
import Backup from "./pages/Backup.jsx";

/** Redirects to /login when signed out. */
function RequireAuth() {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div role="status" style={{ padding: 32, color: "var(--muted)" }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Layout />;
}

// Page guards (UI only — a real backend must enforce the same rules).
function RequireRole({ roles }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? <Outlet /> : <Navigate to={homeFor(user.role)} replace />;
}
function RequireModule({ module, need = "view" }) {
  const { user } = useAuth();
  const can = usePermission();
  return can(module, need) ? <Outlet /> : <Navigate to={homeFor(user.role)} replace />;
}
const guard = (module, need, path, element) => (
  <Route key={path} element={<RequireModule module={module} need={need} />}><Route path={path} element={element} /></Route>
);

function MyProfile() {
  const { user } = useAuth();
  return <StudentDetails selfId={user.studentId} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route element={<RequireAuth />}>
        <Route path="/my-account" element={<MyAccount />} />

        {/* Role dashboards */}
        <Route element={<RequireRole roles={ADMINS} />}><Route index element={<AdminDashboard />} /></Route>
        <Route element={<RequireRole roles={STAFF} />}><Route path="/teacher" element={<TeacherDashboard />} /></Route>
        <Route element={<RequireRole roles={["parent"]} />}><Route path="/parent" element={<ParentDashboard />} /></Route>
        <Route element={<RequireRole roles={["student", "parent"]} />}><Route path="/report-card" element={<ReportCard />} /></Route>
        <Route element={<RequireRole roles={["student"]} />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/profile" element={<MyProfile />} />
        </Route>

        {/* Modules, controlled by the Roles & Permissions matrix */}
        {guard("school", "view", "/school-setup", <SchoolSetup />)}
        {guard("users", "view", "/users", <Users />)}
        {guard("roles", "view", "/roles", <Roles />)}
        {guard("students", "view", "/students", <Students />)}
        {guard("students", "edit", "/students/new", <AdmissionForm />)}
        {guard("students", "view", "/students/:id", <StudentDetails />)}
        {guard("teachers", "view", "/teachers", <Teachers />)}
        {guard("classes", "view", "/class", <Classes />)}
        {guard("subjects", "view", "/subject", <Subjects />)}
        {guard("routine", "view", "/routine", <Routine />)}
        {guard("assignments", "view", "/assignments", <Assignments />)}
        {guard("attendance", "view", "/attendance", <Attendance />)}
        {guard("grades", "view", "/grades", <Gradebook />)}
        {guard("notices", "view", "/notice", <Notice />)}
        {guard("reports", "view", "/reports", <Reports />)}
        {guard("school", "edit", "/backup", <Backup />)}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
