// Simple list pages built on the generic CrudPage.
import { CLASSES, SUBJECTS, AVATAR_COLORS } from "../constants.js";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { fmtDate } from "../lib/utils.js";
import CrudPage from "../components/CrudPage.jsx";
import { Avatar, Badge } from "../components/ui.jsx";

const who = (r) => <div className="who"><Avatar name={r.name} color={r.color} />{r.name}</div>;

export function Teachers() {
  const { openModal } = useUI();
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
        { key: "class", label: "Class teacher of", type: "select", options: CLASSES },
        { key: "phone", label: "Phone", type: "tel", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "joined", label: "Joining date", type: "date", required: true },
        { key: "salary", label: "Monthly salary ($)", type: "number", min: 0 },
      ]}
      onView={(t) => openModal(t.name, (
        <dl className="kv">
          <dt>ID</dt><dd>{t.id}</dd><dt>Subject</dt><dd>{t.subject}</dd><dt>Class teacher of</dt><dd>Class {t.class}</dd>
          <dt>Phone</dt><dd>{t.phone}</dd><dt>Email</dt><dd>{t.email}</dd><dt>Joined</dt><dd>{fmtDate(t.joined)}</dd>
        </dl>
      ))}
      cols={[
        { key: "name", label: "Teacher Name", render: who },
        { key: "id", label: "ID" },
        { key: "subject", label: "Subject" },
        { key: "class", label: "Class" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
      ]}
    />
  );
}

export function Classes() {
  const { students, teachers, school } = useData();
  return (
    <CrudPage
      collection="classes" module="classes" title="Class" singular="Class" listTitle="All Classes"
      fields={[
        { key: "name", label: "Class name", required: true },
        { key: "section", label: "Section", type: "select", options: ["A", "B", "C", "D", "E"] },
        { key: "strand", label: "Strand (Senior High)", type: "select", options: [{ value: "", label: "None (Junior High)" }, ...(school.strands || []).map((s) => ({ value: s, label: s }))] },
        { key: "teacher", label: "Class teacher", type: "select", options: teachers.map((t) => t.name) },
        { key: "room", label: "Room", required: true },
        { key: "capacity", label: "Capacity", type: "number", min: 1 },
      ]}
      cols={[
        { key: "name", label: "Class", render: (r) => <b>{r.name}</b> },
        { key: "section", label: "Section" },
        { key: "strand", label: "Strand", render: (r) => (r.strand ? <Badge value={r.strand} cls="b-purple" /> : <span className="muted">—</span>) },
        { key: "teacher", label: "Class Teacher" },
        { key: "room", label: "Room" },
        { key: "students", label: "Students", sortable: false, render: (r) => {
          const n = students.filter((s) => "Class " + s.class === r.name).length;
          return <div className="who"><div className="progress"><i style={{ width: `${Math.min(100, (n / r.capacity) * 100)}%` }} /></div>{n} / {r.capacity}</div>;
        } },
      ]}
    />
  );
}

export function Subjects() {
  const { teachers } = useData();
  return (
    <CrudPage
      collection="subjects" module="subjects" title="Subject" singular="Subject" listTitle="All Subjects"
      fields={[
        { key: "name", label: "Subject name", required: true },
        { key: "code", label: "Code", required: true },
        { key: "teacher", label: "Teacher", type: "select", options: teachers.map((t) => t.name) },
        { key: "type", label: "Type", type: "select", options: ["Theory", "Practical"] },
        { key: "classes", label: "Classes", required: true },
      ]}
      cols={[
        { key: "name", label: "Subject", render: (r) => <b>{r.name}</b> },
        { key: "code", label: "Code" },
        { key: "teacher", label: "Teacher" },
        { key: "type", label: "Type", render: (r) => <Badge value={r.type} /> },
        { key: "classes", label: "Classes" },
      ]}
    />
  );
}
