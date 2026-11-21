// Simple list pages built on the generic CrudPage.
import { AVATAR_COLORS } from "../constants.js";
import { gradeLabel, gradeOf, levelOf } from "../levels.js";
import { useSections, useSubjects } from "../lib/sections.js";
import { useLevel } from "../lib/level.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { fmtDate } from "../lib/utils.js";
import CrudPage from "../components/CrudPage.jsx";
import { Avatar, Badge } from "../components/ui.jsx";

const who = (r) => <div className="who"><Avatar name={r.name} color={r.color} />{r.name}</div>;

export function Teachers() {
  const { openModal } = useUI();
  const sections = useSections();
  const SUBJECTS = useSubjects().names;
  // The sections each teacher advises this school year (set on the Sections page).
  const advises = (t) => sections.current.filter((c) => c.adviser === t.id).map((c) => sections.label(c.id)).join(", ") || "—";
  return (
    <CrudPage
      collection="teachers" module="teachers" title="Teachers List" singular="Teacher" crumbs={["Teachers"]}
      defaults={{ color: AVATAR_COLORS[1] }}
      searchPlaceholder="Search by name or subject"
      filter={{ key: "subject", label: "All subjects", options: SUBJECTS }}
      fields={[
        { key: "name", label: "Full name", required: true },
        { key: "gender", label: "Gender", type: "select", options: ["Male", "Female"] },
        { key: "subject", label: "Subject", type: "select", options: SUBJECTS },
        { key: "phone", label: "Phone", type: "tel", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "joined", label: "Joining date", type: "date", required: true },
        { key: "salary", label: "Monthly salary ($)", type: "number", min: 0 },
      ]}
      onView={(t) => openModal(t.name, (
        <dl className="kv">
          <dt>ID</dt><dd>{t.id}</dd><dt>Subject</dt><dd>{t.subject}</dd><dt>Adviser of</dt><dd>{advises(t)}</dd>
          <dt>Phone</dt><dd>{t.phone}</dd><dt>Email</dt><dd>{t.email}</dd><dt>Joined</dt><dd>{fmtDate(t.joined)}</dd>
        </dl>
      ))}
      cols={[
        { key: "name", label: "Teacher Name", render: who },
        { key: "id", label: "ID" },
        { key: "subject", label: "Subject" },
        { key: "advises", label: "Adviser of", sortable: false, render: advises },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
      ]}
    />
  );
}

/**
 * Sections of the chosen level for this school year (e.g. Grade 2 – Sampaguita): grade, name,
 * adviser, room and capacity. Senior High sections also have a strand.
 */
export function Classes() {
  const { students, teachers, school } = useData();
  const sections = useSections();
  const { level } = useLevel();
  const info = levelOf(level);
  const year = school.academicYear;
  const grades = info?.grades || [];
  const teacherName = (id) => teachers.find((t) => t.id === id)?.name || "—";
  return (
    <CrudPage
      collection="classes" module="classes" title="Sections" singular="Section" crumbs={["Sections"]}
      listTitle={`${info?.label || "All"} sections · School year ${year.label}`}
      subtitle="Each school year has its own sections. Students move between them with Transfer (on the student's page)."
      rowFilter={(r) => r.year === year.key && (!level || r.level === level)}
      defaults={{ year: year.key, level: level || "", grade: grades[0]?.key, capacity: 40, adviser: "", strand: "" }}
      describe={(r) => sections.label(r.id)}
      filter={{ key: "grade", label: "All grades", options: grades.map((g) => ({ value: g.key, label: g.label })) }}
      fields={[
        { key: "grade", label: "Grade level", type: "select", options: grades.map((g) => ({ value: g.key, label: g.label })), required: true },
        { key: "name", label: "Section name", required: true },
        { key: "adviser", label: "Adviser", type: "select", options: [{ value: "", label: "— No adviser —" }, ...teachers.map((t) => ({ value: t.id, label: t.name, hint: t.subject }))] },
        { key: "room", label: "Room" },
        { key: "capacity", label: "Capacity", type: "number", min: 1 },
        ...(info?.strands ? [{ key: "strand", label: "Strand", type: "select", options: [{ value: "", label: "— None —" }, ...(school.strands || []).map((x) => ({ value: x, label: x }))] }] : []),
      ]}
      cols={[
        { key: "name", label: "Section", render: (r) => <b>{sections.label(r.id)}</b> },
        { key: "adviser", label: "Adviser", render: (r) => teacherName(r.adviser) },
        ...(info?.strands ? [{ key: "strand", label: "Strand", render: (r) => (r.strand ? <Badge value={r.strand} cls="b-purple" /> : <span className="muted">—</span>) }] : []),
        { key: "room", label: "Room", render: (r) => r.room || "—" },
        { key: "students", label: "Students", sortable: false, render: (r) => {
          const n = students.filter((st) => st.class === r.id).length;
          return <div className="who"><div className="progress"><i style={{ width: `${Math.min(100, (n / (r.capacity || 40)) * 100)}%` }} /></div>{n} / {r.capacity || 40}</div>;
        } },
      ]}
    />
  );
}

/**
 * The school's subjects for the chosen level, and which grade levels (and Senior High strands) take each one.
 * A subject can span levels (e.g. Mathematics, Kinder to Grade 10): editing it here only changes this level's grades.
 */
export function Subjects() {
  const { teachers, school } = useData();
  const { level } = useLevel();
  const subjects = useSubjects();
  const info = levelOf(level);
  const grades = info?.grades || [];
  const inLevel = (g) => gradeOf(g)?.level === level;
  const strandField = info?.strands ? [{ key: "strands", label: "Strands", type: "checks", options: school.strands || [], hint: "Leave all unticked for a core subject that every strand takes." }] : [];
  return (
    <CrudPage
      collection="subjects" module="subjects" title="Subjects" singular="Subject" crumbs={["Subjects"]}
      listTitle={`${info?.label || "All"} subjects`}
      rowFilter={(r) => subjects.ofLevel(level).some((x) => x.id === r.id)}
      defaults={{ type: "Theory", teacher: "", grades: grades.map((g) => g.key), strands: [] }}
      prepare={(vals, row) => ({
        ...vals,
        // Keep the grade levels this subject has in other levels; only this level's ticks change.
        grades: [...(row?.grades || []).filter((g) => !inLevel(g)), ...vals.grades],
        ...(info?.strands ? {} : { strands: row?.strands || [] }),
      })}
      filter={{ key: "type", label: "All types", options: ["Theory", "Practical"] }}
      fields={[
        { key: "name", label: "Subject name", required: true },
        { key: "code", label: "Code", required: true },
        { key: "teacher", label: "Subject coordinator", type: "select", options: [{ value: "", label: "— None —" }, ...teachers.map((t) => ({ value: t.name, label: t.name, hint: t.subject }))] },
        { key: "type", label: "Type", type: "select", options: ["Theory", "Practical"] },
        { key: "grades", label: `Grade levels (${info?.label || ""})`, type: "checks", required: true, options: grades.map((g) => ({ value: g.key, label: g.label })) },
        ...strandField,
      ]}
      cols={[
        { key: "name", label: "Subject", render: (r) => <b>{r.name}</b> },
        { key: "code", label: "Code" },
        { key: "grades", label: "Grade levels", sortable: false, render: (r) => r.grades.filter(inLevel).map(gradeLabel).join(", ") },
        ...(info?.strands ? [{ key: "strands", label: "Strands", sortable: false, render: (r) => (r.strands?.length ? r.strands.map((x) => <Badge key={x} value={x} cls="b-purple" />) : <span className="muted">Core (all)</span>) }] : []),
        { key: "type", label: "Type", render: (r) => <Badge value={r.type} /> },
        { key: "teacher", label: "Coordinator", render: (r) => r.teacher || "—" },
      ]}
    />
  );
}
