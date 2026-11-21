import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePermission } from "../lib/usePermission.js";
import { useData, useView } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { AVATAR_COLORS, SEMESTERS } from "../constants.js";
import { fmtDate, todayIso } from "../lib/utils.js";
import { gradeLabel, offers, studentSubjects } from "../levels.js";
import CrudPage from "../components/CrudPage.jsx";
import RecordForm from "../components/RecordForm.jsx";
import Select from "../components/Select.jsx";
import Icon from "../components/Icon.jsx";
import DateInput, { longDate } from "../components/DateInput.jsx";
import { Avatar, Badge, PageHead } from "../components/ui.jsx";
import { buildReport, useScope } from "../lib/scope.js";
import { useSections } from "../lib/sections.js";
import { useLevel } from "../lib/level.jsx";
import { ReportCardView } from "./ReportCard.jsx";
import { attendanceLog, attendanceRate } from "./StudentDashboard.jsx";
import { pct } from "../lib/stats.js";

/** Section choices for a dropdown, grouped by grade ("Grade 2 – B" under "Grade 2"). */
export const sectionOptions = (list) => list.map((c) => ({ value: c.id, label: `${gradeLabel(c.grade)} – ${c.name}`, group: gradeLabel(c.grade) }));

/** The student form. The section is only chosen at admission; after that it changes through Transfer. */
export const studentFields = (sections, { withSection = true } = {}) => [
  { key: "name", label: "Full name", required: true },
  { key: "gender", label: "Gender", type: "select", options: ["Male", "Female"] },
  ...(withSection ? [{ key: "class", label: "Section", type: "select", options: sectionOptions(sections), required: true }] : []),
  { key: "roll", label: "Roll", required: true },
  { key: "dob", label: "Date of birth", type: "date", required: true, max: todayIso() },
  { key: "phone", label: "Phone", type: "tel", required: true },
  { key: "parent", label: "Parent / guardian", required: true },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Address", full: true, required: true },
];

const newStudentDefaults = () => ({
  admittedYear: new Date().getFullYear(),
  color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
});

export default function Students() {
  const navigate = useNavigate();
  const scope = useScope();
  const sections = useSections();
  const { level, inLevel } = useLevel();
  // This level's sections the user works with (a teacher: only theirs).
  const mine = scope.classes.filter(inLevel);
  const levelSections = sections.ofLevel(level);
  return (
    <CrudPage
      collection="students" module="students" title={scope.all ? "Students List" : "My Students"} singular="Student" crumbs={["Students"]}
      listTitle={scope.all ? undefined : `Sections you teach: ${mine.map(sections.label).join(", ") || "none yet"}`}
      rowFilter={(s) => (scope.all ? true : scope.inScope(s.class)) && inLevel(s.class)}
      fields={studentFields(levelSections)} defaults={{ ...newStudentDefaults(), class: levelSections[0]?.id }}
      csv={{
        filename: `students-${new Date().toISOString().slice(0, 10)}.csv`,
        header: ["Roll", "Name", "ID", "Section", "Gender", "Date of birth", "Parent / guardian", "Phone", "Email", "Address"],
        row: (s) => [s.roll, s.name, s.id, sections.label(s.class), s.gender, s.dob, s.parent, s.phone, s.email, s.address],
      }}
      searchPlaceholder="Search by name or roll"
      filter={{ key: "class", label: "All sections", options: sectionOptions(mine.map((id) => sections.byId.get(id)).filter(Boolean)) }}
      onView={(r) => navigate(`/students/${r.id}`)}
      cols={[
        { key: "name", label: "Students Name", render: (r) => <div className="who"><Avatar name={r.name} color={r.color} />{r.name}</div> },
        { key: "roll", label: "Roll" },
        { key: "class", label: "Section", render: (r) => sections.label(r.class) },
        { key: "address", label: "Address" },
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
  const sections = useSections();
  const { level } = useLevel();
  const choices = sections.ofLevel(level).length ? sections.ofLevel(level) : sections.current;
  if (!sections.current.length) {
    return (
      <>
        <PageHead title="Admission Form" crumbs={[{ label: "Students", to: "/students" }, "Admission Form"]} />
        <div className="card empty">There are no sections for this school year yet. <Link className="link" to="/class">Create a section</Link> first.</div>
      </>
    );
  }
  return (
    <>
      <PageHead title="Admission Form" crumbs={[{ label: "Students", to: "/students" }, "Admission Form"]} />
      <div className="card" style={{ maxWidth: 860 }}>
        <div className="card-head"><h3>Student Information</h3></div>
        <RecordForm fields={studentFields(choices)} initial={{ class: choices[0].id }} submitLabel="Admit student"
          onCancel={() => navigate("/students")}
          onSubmit={(v) => { add("students", { ...newStudentDefaults(), ...v }); toast(`${v.name} admitted to ${sections.label(v.class)}`); navigate("/students"); }} />
      </div>
    </>
  );
}

/** Moves a student to another section of this school year, with a date and a reason (kept in their history). */
function TransferForm({ student, onDone, onCancel }) {
  const { school, transfer } = useData();
  const sections = useSections();
  const from = sections.byId.get(student.class);
  const ay = school.academicYear;
  const today = todayIso();
  // Same grade first (the usual move between sections), then the rest of the school.
  const others = sections.current.filter((c) => c.id !== student.class);
  const options = [
    ...others.filter((c) => c.grade === from?.grade).map((c) => ({ value: c.id, label: sections.label(c.id), group: `Same grade (${gradeLabel(from.grade)})` })),
    ...others.filter((c) => c.grade !== from?.grade).map((c) => ({ value: c.id, label: sections.label(c.id), group: "Other grades" })),
  ];
  const [f, setF] = useState({ toClass: "", date: today < ay.start ? ay.start : today > ay.end ? ay.end : today, reason: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.toClass) return setError("Choose the new section.");
    if (!f.reason.trim()) return setError("Give a short reason for the transfer.");
    setBusy(true); setError("");
    try {
      await transfer({ studentId: student.id, toClass: f.toClass, date: f.date, reason: f.reason.trim() });
      onDone(sections.label(f.toClass));
    } catch (err) { setError(err.message); setBusy(false); }
  };
  if (!options.length) return <><p>There's no other section this school year to move {student.name} to.</p><div className="form-actions"><button className="btn" onClick={onCancel}>OK</button></div></>;
  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="alert error" role="alert">{error}</div>}
      <p style={{ margin: 0 }}>Moving <b>{student.name}</b> out of <b>{sections.label(student.class)}</b>. Grades and attendance from the old section stay on record.</p>
      <div className="form-grid">
        <label>New section *<Select value={f.toClass} onChange={(v) => setF({ ...f, toClass: v })} options={options} placeholder="Choose a section" required aria-label="New section" searchable={options.length > 10} /></label>
        <label>From *<DateInput value={f.date} min={ay.start} max={ay.end} required onChange={(v) => setF({ ...f, date: v })} aria-label="Transfer date" /></label>
        <label style={{ gridColumn: "1 / -1" }}>Reason *<input className="input" required maxLength={200} value={f.reason} placeholder="e.g. Parent request, class size balancing"
          onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn light" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={busy}>{busy ? "Moving…" : "Transfer student"}</button>
      </div>
    </form>
  );
}

/** Staff view any student by URL id; a student sees only their own record via /profile. */
/**
 * College: the subjects a student takes this school year. The registrar can drop subjects of the student's
 * block section and add subjects from other College sections (irregular students).
 */
function SubjectLoad({ student, canEdit }) {
  const { subjects, classes, assignments, teachers, school, update } = useData();
  const { toast } = useUI();
  const sections = useSections();
  const year = school.academicYear.key;
  const load = student.load?.year === year ? student.load : { year, drops: [], adds: [] };
  const byId = new Map(classes.map((c) => [c.id, c]));
  const taken = studentSubjects(student, { subjects, sectionsById: byId, year });
  const own = subjects.filter((x) => offers(x, byId.get(student.class))).map((x) => x.name);
  const info = (name) => subjects.find((x) => x.name === name) || {};
  const teacherOf = (cls, subject) => teachers.find((t) => t.id === assignments.find((a) => a.class === cls && a.subject === subject)?.teacherId)?.name || "No teacher yet";
  const [pick, setPick] = useState("");
  const save = (next, msg) => { update("students", student.id, { load: { year, drops: next.drops || [], adds: next.adds || [] } }); toast(msg); };
  // Subjects the student could add: offered in another of this year's College sections, not already taken.
  const choices = sections.current.filter((c) => c.level === "college" && c.id !== student.class)
    .flatMap((c) => subjects.filter((x) => offers(x, c) && !taken.some((t) => t.subject === x.name)).map((x) => ({ value: `${c.id}|${x.name}`, label: `${x.name} · ${sections.label(c.id)}`, hint: `${x.units} units · ${SEMESTERS.find((m) => m.key === x.semester)?.label || ""}` })));
  const units = taken.reduce((n, t) => n + Number(info(t.subject).units || 0), 0);
  return (
    <div className="card">
      <div className="card-head">
        <div><h3>Subject load · {school.academicYear.label}</h3><p>{taken.length} subjects · {units} units. Regular students take their section's subjects; irregular students can drop some and add others from another section.</p></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th className="no-sort">Subject</th><th className="no-sort">Units</th><th className="no-sort">Semester</th><th className="no-sort">Section</th><th className="no-sort">Teacher</th><th className="no-sort" /></tr></thead>
          <tbody>
            {taken.map((t) => (
              <tr key={t.subject}>
                <td><b>{t.subject}</b> {t.added && <Badge value="Added" cls="b-blue" />}</td>
                <td>{info(t.subject).units ?? "—"}</td>
                <td>{SEMESTERS.find((m) => m.key === info(t.subject).semester)?.label || "—"}</td>
                <td>{sections.label(t.class)}</td>
                <td>{teacherOf(t.class, t.subject)}</td>
                <td>{canEdit && (t.added
                  ? <button className="btn light sm" onClick={() => save({ ...load, adds: load.adds.filter((a) => a.subject !== t.subject) }, `${t.subject} removed`)}>Remove</button>
                  : <button className="btn light sm" onClick={() => save({ ...load, drops: [...load.drops, t.subject] }, `${t.subject} dropped`)}>Drop</button>)}</td>
              </tr>
            ))}
            {!taken.length && <tr><td colSpan={6} className="empty">No subjects.</td></tr>}
          </tbody>
        </table>
      </div>
      {load.drops.length > 0 && (
        <p className="hint" style={{ marginTop: 10 }}>Dropped: {load.drops.map((d) => (
          <span key={d} className="chip" style={{ marginRight: 6 }}>{d}{canEdit && own.includes(d) && <button type="button" aria-label={`Take ${d} again`} onClick={() => save({ ...load, drops: load.drops.filter((x) => x !== d) }, `${d} added back`)}>×</button>}</span>
        ))}</p>
      )}
      {canEdit && (
        <div className="inline-add" style={{ marginTop: 12 }}>
          <Select value={pick} onChange={setPick} searchable placeholder={choices.length ? "Add a subject from another section…" : "No other subjects to add"} aria-label="Add a subject" options={choices} />
          <button type="button" className="btn sm" disabled={!pick} onClick={() => {
            const [cls, subject] = pick.split("|");
            save({ ...load, adds: [...load.adds, { class: cls, subject }] }, `${subject} added (${sections.label(cls)})`);
            setPick("");
          }}><Icon name="plus" />Add subject</button>
        </div>
      )}
    </div>
  );
}

export function StudentDetails({ selfId }) {
  const params = useParams();
  const id = selfId || params.id;
  const { students, teachers, enrollments, school, update } = useData();
  const can = usePermission();
  const { openModal, closeModal, toast } = useUI();
  const scope = useScope();
  const sections = useSections();
  const data = useData();
  const s = students.find((x) => x.id === id);
  // Staff: this student's grades and attendance load from the server (a student's own profile already has them).
  const view = useView(s && !selfId && scope.inScope(s.class) ? { view: "student", id: s.id } : null);
  // Teachers may only open students in the classes they teach.
  if (s && !selfId && !scope.inScope(s.class)) {
    return <div className="card empty">This student isn't in any of the sections you teach. <Link className="link" to="/students">Back to my students</Link></div>;
  }

  if (!s) {
    return (
      <div className="card empty">
        Student not found.{" "}
        {selfId ? "Your record may have been removed. Please contact the school office." : <Link className="link" to="/students">Back to list</Link>}
      </div>
    );
  }
  const section = sections.byId.get(s.class);
  const adviser = teachers.find((t) => t.id === section?.adviser);
  const { average, college, gwa } = buildReport(s, data);
  // This year's moves, newest first (from the student view for staff, or the student's own data).
  const history = (view.data?.enrollments || enrollments.filter((e) => e.studentId === s.id))
    .filter((e) => e.year === school.academicYear.key).sort((a, b) => b.from.localeCompare(a.from));
  const canEdit = !selfId && can("students", "edit");
  const edit = () => openModal("Edit Student", (
    <RecordForm fields={studentFields([], { withSection: false })} initial={s} submitLabel="Save changes" onCancel={closeModal}
      onSubmit={(v) => { update("students", s.id, v); closeModal(); toast("Student updated"); }} />
  ));
  const move = () => openModal("Transfer student", (
    <TransferForm student={s} onCancel={closeModal} onDone={(to) => { closeModal(); toast(`${s.name} moved to ${to}`); }} />
  ));

  return (
    <>
      <PageHead title={selfId ? "My Profile" : "Student Details"} crumbs={selfId ? ["My Profile"] : [{ label: "Students", to: "/students" }, s.name]}>
        {canEdit && (
          <div style={{ display: "flex", gap: 10 }}>
            {section && <button className="btn light" onClick={move}>Transfer</button>}
            <button className="btn" onClick={edit}>Edit student</button>
          </div>
        )}
      </PageHead>
      <div className="grid-profile">
        <div className="card profile-card">
          <Avatar name={s.name} color={s.color} size="lg" />
          <h2>{s.name}</h2>
          <span style={{ color: "var(--muted)" }}>{s.id} · {sections.label(s.class)} · Roll {s.roll}</span>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}><Badge value={s.gender} /></div>
          <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr", width: "100%", marginTop: 18, gap: 12 }}>
            <div className="stat-tile tone-purple" style={{ padding: 16 }}><div><span>Attendance</span><b style={{ fontSize: 22 }}>{view.loading ? "…" : pct(attendanceRate(attendanceLog(data.attendance, s)))}</b></div></div>
            <div className="stat-tile tone-orange" style={{ padding: 16 }}><div><span>{college ? "GWA" : "General avg."}</span><b style={{ fontSize: 22 }}>{view.loading ? "…" : (college ? gwa?.toFixed(2) : average) ?? "—"}</b></div></div>
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
            <dt>Adviser</dt><dd>{adviser ? adviser.name : "—"}</dd>
          </dl>
          {history.length > 0 && (
            <>
              <div className="card-head" style={{ marginTop: 18 }}><h3>Sections this school year</h3></div>
              <ol className="enrol-history">
                {history.map((e) => (
                  <li key={e.id}>
                    <b>{sections.label(e.class)}</b>
                    <span>{longDate(e.from)} – {e.to ? longDate(e.to) : "now"}</span>
                    <small>{e.reason}</small>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
      {section?.level === "college" && section.year === school.academicYear.key && <SubjectLoad student={s} canEdit={canEdit} />}
      {view.loading ? <div className="card"><p className="hint" role="status">Loading grades and attendance…</p></div>
        : view.error ? <div className="alert error" role="alert">{view.error}</div>
        : <ReportCardView student={s} />}
    </>
  );
}
