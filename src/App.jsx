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
import { Classes, Exams, Hostel, Library, Subjects, Teachers, Transport } from "./pages/Records.jsx";
import Fees from "./pages/Fees.jsx";
import Routine from "./pages/Routine.jsx";
import Attendance from "./pages/Attendance.jsx";
import Notice from "./pages/Notice.jsx";
import OnlineExams from "./pages/OnlineExams.jsx";
import ExamBuilder from "./pages/ExamBuilder.jsx";
import ExamResults from "./pages/ExamResults.jsx";
import TakeExam, { ExamReview } from "./pages/TakeExam.jsx";

/** Redirects to /login when signed out. */
function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
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
        <Route element={<RequireRole roles={["student"]} />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/online-exams/:id/take" element={<TakeExam />} />
          <Route path="/online-exams/:id/review" element={<ExamReview />} />
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
        {guard("attendance", "view", "/attendance", <Attendance />)}
        {guard("exams", "view", "/exam", <Exams />)}
        {guard("onlineExams", "view", "/online-exams", <OnlineExams />)}
        {guard("onlineExams", "edit", "/online-exams/new", <ExamBuilder />)}
        {guard("onlineExams", "edit", "/online-exams/:id/edit", <ExamBuilder />)}
        {guard("onlineExams", "edit", "/online-exams/:id/results", <ExamResults />)}
        {guard("notices", "view", "/notice", <Notice />)}
        {guard("library", "view", "/library", <Library />)}
        {guard("fees", "view", "/account/fees", <Fees />)}
        {guard("transport", "view", "/transport", <Transport />)}
        {guard("hostel", "view", "/hostel", <Hostel />)}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
