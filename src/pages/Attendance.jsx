import { useEffect, useState } from "react";
import { useScope } from "../lib/scope.js";
import { useData, useView } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { todayIso } from "../lib/utils.js";
import { Avatar, PageHead, StatTile } from "../components/ui.jsx";

const OPTS = [["P", "Present"], ["A", "Absent"], ["L", "Late"]];

export default function Attendance() {
  const { students, attendance, school, saveAttendance } = useData();
  const { toast } = useUI();
  const canEdit = usePermission()("attendance", "edit");
  const scope = useScope(); // teachers only see the classes they teach
  const [cls, setCls] = useState(scope.homeroom || scope.classes[0] || "");
  // Attendance can only be taken on days of the open school year, up to today.
  const ay = school.academicYear;
  const lastDay = todayIso() < ay.end ? todayIso() : ay.end;
  const [date, setDate] = useState(() => (lastDay < ay.start ? ay.start : lastDay));
  const key = `${cls}|${date}`;
  const list = students.filter((s) => s.class === cls).sort((a, b) => a.roll.localeCompare(b.roll));
  const [marks, setMarks] = useState({});
  // The class's saved attendance for the school year loads from the server when it's chosen.
  const view = useView(cls ? { view: "class", class: cls, parts: "attendance" } : null);
  const ready = !view.loading && !view.error;

  // Show saved marks (or default everyone to Present) once they've loaded, and when class/date changes.
  // Waiting matters: defaulting before the saved marks arrive would let a save overwrite them.
  useEffect(() => {
    if (!ready) return;
    setMarks(attendance[key] || Object.fromEntries(list.map((s) => [s.id, "P"])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  const count = (v) => list.filter((s) => marks[s.id] === v).length;
  const saved = !!attendance[key];
  if (!scope.classes.length) {
    return (
      <>
        <PageHead title="Attendance" crumbs={["Attendance"]} />
        <div className="card empty">You don't have any classes assigned yet. Ask the school admin to set your teaching assignments.</div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Attendance" crumbs={["Attendance"]}>
        {canEdit ? (
          <button className="btn" disabled={!ready} title={view.error || undefined} onClick={() => { saveAttendance(key, marks); toast(`Attendance saved for Class ${cls}`); }}>
            {view.loading ? "Loading…" : saved ? "Update attendance" : "Save attendance"}
          </button>
        ) : <span className="badge b-blue">View only</span>}
      </PageHead>
      <div className="stat-grid">
        <StatTile label="Students" value={list.length} icon="cap" tone="purple" />
        <StatTile label="Present" value={count("P")} icon="check" tone="green" />
        <StatTile label="Absent" value={count("A")} icon="x" tone="orange" />
        <StatTile label="Late" value={count("L")} icon="calendar" tone="blue" />
      </div>
      <div className="card">
        <div className="card-head">
          <div><h3>Class {cls}</h3><p>{saved ? "Saved — you can still make changes." : "Not saved yet for this date."}</p></div>
          <div className="table-tools">
            <select className="select" value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class">
              {scope.classes.map((c) => <option key={c} value={c}>Class {c}{c === scope.homeroom ? " (homeroom)" : ""}</option>)}
            </select>
            <input className="input" type="date" value={date} min={ay.start} max={lastDay < ay.start ? ay.start : lastDay} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={`Date (school year ${ay.label})`} title={`School year ${ay.label}: ${ay.start} to ${ay.end}`} />
            <button className="btn sm light" onClick={() => setMarks(Object.fromEntries(list.map((s) => [s.id, "P"])))}>Mark all present</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th className="no-sort">Roll</th><th className="no-sort">Student</th><th className="no-sort">Status</th></tr></thead>
            <tbody>
              {list.length ? list.map((s) => (
                <tr key={s.id}>
                  <td>{s.roll}</td>
                  <td><div className="who"><Avatar name={s.name} color={s.color} />{s.name}</div></td>
                  <td>
                    <div className="att-btns" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                      {OPTS.map(([v, label]) => (
                        <button key={v} type="button" role="radio" aria-checked={marks[s.id] === v}
                          className={`${v} ${marks[s.id] === v ? "on" : ""}`} onClick={() => setMarks((m) => ({ ...m, [s.id]: v }))}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan="3" className="empty">No students in this class</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
