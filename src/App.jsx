import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { homeFor, useAuth } from "./lib/AuthContext.jsx";
import { useData } from "./lib/DataContext.jsx";
import { usePermission } from "./lib/usePermission.js";
import { ADMINS, STAFF } from "./lib/permissions.js";
import Layout, { PageSkeleton } from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";

// Every page except Login is loaded the first time it's opened, so the first visit downloads less.
const page = (load, name = "default") => lazy(() => load().then((m) => ({ default: m[name] })));
const Register = page(() => import("./pages/Register.jsx"));
const ForgotPassword = page(() => import("./pages/PasswordReset.jsx"), "ForgotPassword");
const ResetPassword = page(() => import("./pages/PasswordReset.jsx"), "ResetPassword");
const FirstPassword = page(() => import("./pages/PasswordReset.jsx"), "FirstPassword");
const MyAccount = page(() => import("./pages/MyAccount.jsx"));
const Users = page(() => import("./pages/Users.jsx"));
const SchoolSetup = page(() => import("./pages/SchoolSetup.jsx"));
const Roles = page(() => import("./pages/Roles.jsx"));
const AdminDashboard = page(() => import("./pages/AdminDashboard.jsx"));
const TeacherDashboard = page(() => import("./pages/TeacherDashboard.jsx"));
const StudentDashboard = page(() => import("./pages/StudentDashboard.jsx"));
const ParentDashboard = page(() => import("./pages/ParentDashboard.jsx"));
const Students = page(() => import("./pages/Students.jsx"));
const AdmissionForm = page(() => import("./pages/Students.jsx"), "AdmissionForm");
const StudentDetails = page(() => import("./pages/Students.jsx"), "StudentDetails");
const Classes = page(() => import("./pages/Records.jsx"), "Classes");
const Subjects = page(() => import("./pages/Records.jsx"), "Subjects");
const Teachers = page(() => import("./pages/Records.jsx"), "Teachers");
const Routine = page(() => import("./pages/Routine.jsx"));
const Attendance = page(() => import("./pages/Attendance.jsx"));
const Notice = page(() => import("./pages/Notice.jsx"));
const Assignments = page(() => import("./pages/Assignments.jsx"));
const Gradebook = page(() => import("./pages/Gradebook.jsx"));
const ReportCard = page(() => import("./pages/ReportCard.jsx"));
const Reports = page(() => import("./pages/Reports.jsx"));
const Backup = page(() => import("./pages/Backup.jsx"));
const Levels = page(() => import("./pages/Levels.jsx"));

/** Redirects to /login when signed out. */
function RequireAuth() {
  const { user, checking } = useAuth();
  const { status, load } = useData();
  const location = useLocation();
  if (checking) return <PageSkeleton full />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <FirstPassword />; // nothing else opens until they set their own
  if (status === "error") {
    return (
      <div role="alert" style={{ padding: 32 }}>
        <p>Couldn't load the school data from the server.</p>
        <button className="btn" onClick={load}>Try again</button>
      </div>
    );
  }
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
    <Suspense fallback={null}>
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
        <Route element={<RequireRole roles={["superadmin"]} />}><Route path="/levels" element={<Levels />} /></Route>
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
    </Suspense>
  );
}
