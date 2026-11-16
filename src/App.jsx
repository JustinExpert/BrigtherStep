import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { homeFor, useAuth } from "./lib/AuthContext.jsx";
import Layout, { STAFF } from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import Students, { AdmissionForm, StudentDetails } from "./pages/Students.jsx";
import { Classes, Exams, Hostel, Library, Subjects, Teachers, Transport } from "./pages/Records.jsx";
import Fees from "./pages/Fees.jsx";
import Routine from "./pages/Routine.jsx";
import Attendance from "./pages/Attendance.jsx";
import Notice from "./pages/Notice.jsx";

/** Redirects to /login when signed out. */
function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Layout />;
}

/** Hides pages from roles that shouldn't see them (UI only — a real backend must enforce this too). */
function RequireRole({ roles }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? <Outlet /> : <Navigate to={homeFor(user.role)} replace />;
}

function MyProfile() {
  const { user } = useAuth();
  return <StudentDetails selfId={user.studentId} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        {/* Everyone signed in */}
        <Route path="/library" element={<Library />} />
        <Route path="/subject" element={<Subjects />} />
        <Route path="/routine" element={<Routine />} />
        <Route path="/exam" element={<Exams />} />
        <Route path="/notice" element={<Notice />} />

        {/* Students only */}
        <Route element={<RequireRole roles={["student"]} />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/profile" element={<MyProfile />} />
        </Route>

        {/* Admin + teachers */}
        <Route element={<RequireRole roles={STAFF} />}>
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/students" element={<Students />} />
          <Route path="/students/:id" element={<StudentDetails />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/class" element={<Classes />} />
          <Route path="/attendance" element={<Attendance />} />
        </Route>

        {/* Admin only */}
        <Route element={<RequireRole roles={["admin"]} />}>
          <Route index element={<AdminDashboard />} />
          <Route path="/students/new" element={<AdmissionForm />} />
          <Route path="/account/fees" element={<Fees />} />
          <Route path="/transport" element={<Transport />} />
          <Route path="/hostel" element={<Hostel />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
