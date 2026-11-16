// Simple list pages built on the generic CrudPage.
import { CLASSES, SUBJECTS, AVATAR_COLORS } from "../data.js";
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

export function Library() {
  return (
    <CrudPage
      collection="books" module="library" title="Library" singular="Book" listTitle="All Books" describe={(r) => r.title}
      searchPlaceholder="Search by title or author"
      filter={{ key: "subject", label: "All subjects", options: SUBJECTS }}
      fields={[
        { key: "title", label: "Title", required: true, full: true },
        { key: "author", label: "Author", required: true },
        { key: "subject", label: "Subject", type: "select", options: SUBJECTS },
        { key: "class", label: "Class", type: "select", options: CLASSES },
        { key: "copies", label: "Copies", type: "number", min: 0, required: true },
        { key: "available", label: "Available", type: "number", min: 0, required: true },
      ]}
      cols={[
        { key: "title", label: "Book Name", render: (r) => <b>{r.title}</b> },
        { key: "author", label: "Author" },
        { key: "subject", label: "Subject" },
        { key: "class", label: "Class" },
        { key: "available", label: "Available", render: (r) => <Badge value={`${r.available} / ${r.copies}`} cls={r.available ? "b-green" : "b-red"} /> },
      ]}
    />
  );
}

export function Classes() {
  const { students, teachers } = useData();
  return (
    <CrudPage
      collection="classes" module="classes" title="Class" singular="Class" listTitle="All Classes"
      fields={[
        { key: "name", label: "Class name", required: true },
        { key: "section", label: "Section", type: "select", options: ["A", "B", "C"] },
        { key: "teacher", label: "Class teacher", type: "select", options: teachers.map((t) => t.name) },
        { key: "room", label: "Room", required: true },
        { key: "capacity", label: "Capacity", type: "number", min: 1 },
      ]}
      cols={[
        { key: "name", label: "Class", render: (r) => <b>{r.name}</b> },
        { key: "section", label: "Section" },
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

export function Exams() {
  return (
    <CrudPage
      collection="exams" module="exams" title="Exam Schedule" singular="Exam" listTitle="All Exams" crumbs={["Exam"]}
      describe={(r) => `${r.name} – ${r.subject}`}
      filter={{ key: "class", label: "All classes", options: CLASSES }}
      fields={[
        { key: "name", label: "Exam name", type: "select", options: ["Mid-term", "Unit test", "Final"] },
        { key: "subject", label: "Subject", type: "select", options: SUBJECTS },
        { key: "class", label: "Class", type: "select", options: CLASSES },
        { key: "date", label: "Date", type: "date", required: true },
        { key: "time", label: "Start time", type: "time", required: true },
        { key: "room", label: "Room", required: true },
      ]}
      cols={[
        { key: "name", label: "Exam", render: (r) => <Badge value={r.name} cls={r.name === "Final" ? "b-red" : r.name === "Mid-term" ? "b-purple" : "b-blue"} /> },
        { key: "subject", label: "Subject" },
        { key: "class", label: "Class" },
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        { key: "time", label: "Time" },
        { key: "room", label: "Room" },
      ]}
    />
  );
}

export function Transport() {
  return (
    <CrudPage
      collection="routes" module="transport" title="Transport" singular="Route" listTitle="All Routes" describe={(r) => r.route}
      fields={[
        { key: "route", label: "Route name", required: true },
        { key: "area", label: "Area", required: true },
        { key: "vehicle", label: "Vehicle no.", required: true },
        { key: "driver", label: "Driver", required: true },
        { key: "phone", label: "Driver phone", type: "tel", required: true },
        { key: "stops", label: "Stops", type: "number", min: 1 },
        { key: "fare", label: "Monthly fare ($)", type: "number", min: 0 },
      ]}
      cols={[
        { key: "route", label: "Route", render: (r) => <b>{r.route}</b> },
        { key: "area", label: "Area" },
        { key: "vehicle", label: "Vehicle" },
        { key: "driver", label: "Driver" },
        { key: "phone", label: "Phone" },
        { key: "stops", label: "Stops" },
        { key: "fare", label: "Fare", render: (r) => "$" + r.fare },
      ]}
    />
  );
}

export function Hostel() {
  return (
    <CrudPage
      collection="rooms" module="hostel" title="Hostel" singular="Room" listTitle="All Rooms" describe={(r) => `${r.hostel} ${r.room}`}
      filter={{ key: "hostel", label: "All hostels", options: ["Oak House (Boys)", "Maple House (Girls)"] }}
      fields={[
        { key: "hostel", label: "Hostel", type: "select", options: ["Oak House (Boys)", "Maple House (Girls)"] },
        { key: "room", label: "Room no.", required: true },
        { key: "type", label: "Type", type: "select", options: ["Twin", "Shared"] },
        { key: "beds", label: "Beds", type: "number", min: 1 },
        { key: "occupied", label: "Occupied", type: "number", min: 0 },
        { key: "fee", label: "Monthly fee ($)", type: "number", min: 0 },
      ]}
      cols={[
        { key: "hostel", label: "Hostel" },
        { key: "room", label: "Room" },
        { key: "type", label: "Type" },
        { key: "occupied", label: "Occupancy", render: (r) => <Badge value={`${r.occupied} / ${r.beds}`} cls={r.occupied >= r.beds ? "b-red" : "b-green"} /> },
        { key: "fee", label: "Fee", render: (r) => "$" + r.fee },
      ]}
    />
  );
}
