import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { CLASSES, AVATAR_COLORS } from "../data.js";
import { fmtDate } from "../lib/utils.js";
import CrudPage from "../components/CrudPage.jsx";
import RecordForm from "../components/RecordForm.jsx";
import { Avatar, Badge, PageHead } from "../components/ui.jsx";

export const STUDENT_FIELDS = [
  { key: "name", label: "Full name", required: true },
  { key: "gender", label: "Gender", type: "select", options: ["Male", "Female"] },
  { key: "class", label: "Class", type: "select", options: CLASSES },
  { key: "roll", label: "Roll", required: true },
  { key: "dob", label: "Date of birth", type: "date", required: true },
  { key: "phone", label: "Phone", type: "tel", required: true },
  { key: "parent", label: "Parent / guardian", required: true },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Address", full: true, required: true },
];

const newStudentDefaults = () => ({
  marks: 0, percent: 0, attendance: 100, year: new Date().getFullYear(),
  color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
});

export default function Students() {
  const navigate = useNavigate();
  return (
    <CrudPage
      collection="students" module="students" title="Students List" singular="Student" crumbs={["Students"]}
      fields={STUDENT_FIELDS} defaults={newStudentDefaults()}
      searchPlaceholder="Search by name or roll"
      filter={{ key: "class", label: "All classes", options: CLASSES }}
      onView={(r) => navigate(`/students/${r.id}`)}
      cols={[
        { key: "name", label: "Students Name", render: (r) => <div className="who"><Avatar name={r.name} color={r.color} />{r.name}</div> },
        { key: "roll", label: "Roll" },
        { key: "address", label: "Address" },
        { key: "class", label: "Class" },
        { key: "dob", label: "Date of Birth", render: (r) => fmtDate(r.dob) },
        { key: "phone", label: "Phone" },
      ]}
    />
  );
}

export function AdmissionForm() {
  const { add } = useData();
  const { toast } = useUI();
  const navigate = useNavigate();
  return (
    <>
      <PageHead title="Admission Form" crumbs={[{ label: "Students", to: "/students" }, "Admission Form"]} />
      <div className="card" style={{ maxWidth: 860 }}>
        <div className="card-head"><h3>Student Information</h3></div>
        <RecordForm fields={STUDENT_FIELDS} initial={{ class: "01" }} submitLabel="Admit student"
          onCancel={() => navigate("/students")}
          onSubmit={(v) => { add("students", { ...newStudentDefaults(), ...v }); toast(`${v.name} admitted`); navigate("/students"); }} />
      </div>
    </>
  );
}

/** Staff view any student by URL id; a student sees only their own record via /profile. */
export function StudentDetails({ selfId }) {
  const params = useParams();
  const id = selfId || params.id;
  const { students, teachers, update } = useData();
  const can = usePermission();
  const { openModal, closeModal, toast } = useUI();
  const s = students.find((x) => x.id === id);

  if (!s) {
    return (
      <div className="card empty">
        Student not found.{" "}
        {selfId ? "Your record may have been removed. Please contact the school office." : <Link className="link" to="/students">Back to list</Link>}
      </div>
    );
  }
  const classTeacher = teachers.find((t) => t.class === s.class);
  const edit = () => openModal("Edit Student", (
    <RecordForm fields={STUDENT_FIELDS} initial={s} submitLabel="Save changes" onCancel={closeModal}
      onSubmit={(v) => { update("students", s.id, v); closeModal(); toast("Student updated"); }} />
  ));

  return (
    <>
      <PageHead title={selfId ? "My Profile" : "Student Details"} crumbs={selfId ? ["My Profile"] : [{ label: "Students", to: "/students" }, s.name]}>
        {!selfId && can("students", "edit") && <button className="btn" onClick={edit}>Edit student</button>}
      </PageHead>
      <div className="grid-profile">
        <div className="card profile-card">
          <Avatar name={s.name} color={s.color} size="lg" />
          <h2>{s.name}</h2>
          <span style={{ color: "var(--muted)" }}>{s.id} · Class {s.class} · Roll {s.roll}</span>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}><Badge value={s.gender} /></div>
          <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr", width: "100%", marginTop: 18, gap: 12 }}>
            <div className="stat-tile tone-purple" style={{ padding: 16 }}><div><span>Attendance</span><b style={{ fontSize: 22 }}>{s.attendance}%</b></div></div>
            <div className="stat-tile tone-orange" style={{ padding: 16 }}><div><span>Score</span><b style={{ fontSize: 22 }}>{s.percent}%</b></div></div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Personal Information</h3></div>
          <dl className="kv">
            <dt>Full name</dt><dd>{s.name}</dd>
            <dt>Date of birth</dt><dd>{fmtDate(s.dob)}</dd>
            <dt>Parent / guardian</dt><dd>{s.parent}</dd>
            <dt>Phone</dt><dd>{s.phone}</dd>
            <dt>Email</dt><dd>{s.email || "—"}</dd>
            <dt>Address</dt><dd>{s.address}</dd>
            <dt>Class teacher</dt><dd>{classTeacher ? classTeacher.name : "—"}</dd>
            <dt>Total marks</dt><dd>{s.marks} / 1200</dd>
          </dl>
        </div>
      </div>
    </>
  );
}
