import { useEffect, useState } from "react";
import { CLASSES } from "../data.js";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { todayIso } from "../lib/utils.js";
import { Avatar, PageHead, StatTile } from "../components/ui.jsx";

const OPTS = [["P", "Present"], ["A", "Absent"], ["L", "Late"]];

export default function Attendance() {
  const { students, attendance, saveAttendance } = useData();
  const { toast } = useUI();
  const canEdit = usePermission()("attendance", "edit");
  const [cls, setCls] = useState(CLASSES[0]);
  const [date, setDate] = useState(todayIso());
  const key = `${cls}|${date}`;
  const list = students.filter((s) => s.class === cls).sort((a, b) => a.roll.localeCompare(b.roll));
  const [marks, setMarks] = useState({});

  // Load saved marks (or default everyone to Present) when class/date changes.
  useEffect(() => {
    setMarks(attendance[key] || Object.fromEntries(list.map((s) => [s.id, "P"])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const count = (v) => list.filter((s) => marks[s.id] === v).length;
  const saved = !!attendance[key];

  return (
    <>
      <PageHead title="Attendance" crumbs={["Attendance"]}>
        {canEdit ? (
          <button className="btn" onClick={() => { saveAttendance(key, marks); toast(`Attendance saved for Class ${cls}`); }}>
            {saved ? "Update attendance" : "Save attendance"}
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
              {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <input className="input" type="date" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
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
