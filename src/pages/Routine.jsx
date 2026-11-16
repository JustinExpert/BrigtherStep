import { useState } from "react";
import { CLASSES, DATA, SUBJECTS } from "../data.js";
import { PageHead } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { findClash, teacherFor, teacherWeek } from "../lib/scope.js";

const MINE = "mine";

export default function Routine() {
  const { user } = useAuth();
  const { students, assignments, teachers, classes, routine, setSlot } = useData();
  const { toast } = useUI();
  const canEdit = usePermission()("routine", "edit");
  const isTeacher = user.role === "teacher";
  // Students open on their own class; parents on their (first) child's class; teachers on their own timetable.
  const ownId = user.role === "student" ? user.studentId : user.role === "parent" ? user.childIds?.[0] : null;
  const myClass = ownId ? students.find((s) => s.id === ownId)?.class : null;
  const [view, setView] = useState(isTeacher ? MINE : myClass || CLASSES[0]);
  const [editing, setEditing] = useState(false);
  const week = view === MINE ? teacherWeek(routine, assignments, user.teacherId) : null;
  const periodsTaught = week ? week.flat().filter(Boolean).length : 0;
  const clashes = week ? week.flat().filter((s) => s?.clash.length).length : 0;
  const roomOf = (cls) => classes.find((c) => c.name === "Class " + cls)?.room || "—";
  const nameOf = (id) => teachers.find((t) => t.id === id)?.name || "A teacher";

  const change = (di, pi, subject) => {
    const clash = findClash(routine, assignments, view, di, pi, subject);
    if (clash) {
      toast(`${nameOf(clash.teacherId)} already teaches Class ${clash.class} (${clash.subject}) on ${DATA.DAYS[di]} at ${DATA.PERIODS[pi]}.`);
      return;
    }
    setSlot(view, di, pi, subject);
    const who = subject ? teacherFor(assignments, teachers, view, subject) : "";
    toast(subject ? `${DATA.DAYS[di]} ${DATA.PERIODS[pi]}: ${subject}${who === "—" ? " (no teacher assigned yet)" : ` · ${who}`}` : `${DATA.DAYS[di]} ${DATA.PERIODS[pi]}: free period`);
  };

  const slot = (di, pi) => {
    if (week) {
      const s = week[di][pi];
      if (!s) return <div className="slot free"><small>Free</small></div>;
      return (
        <div className={`slot ${s.clash.length ? "clash" : ""}`}>
          <b>{s.subject}</b><small>Class {s.class} · {roomOf(s.class)}</small>
          {s.clash.length > 0 && <small className="clash-note">Clash: also Class {s.clash.map((c) => c.class).join(", ")}</small>}
        </div>
      );
    }
    const subject = routine[view][di][pi].subject;
    if (editing) {
      return (
        <select className="select slot-select" value={subject} aria-label={`${DATA.DAYS[di]} ${DATA.PERIODS[pi]} subject`} onChange={(e) => change(di, pi, e.target.value)}>
          <option value="">Free period</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      );
    }
    if (!subject) return <div className="slot free"><small>Free</small></div>;
    const who = teacherFor(assignments, teachers, view, subject);
    return <div className={`slot ${who === "—" ? "unassigned" : ""}`}><b>{subject}</b><small>{who === "—" ? "No teacher assigned" : who}</small><small>{roomOf(view)}</small></div>;
  };

  return (
    <>
      <PageHead title="Timetable" crumbs={["Routine"]}>
        {canEdit && view !== MINE && (
          <button className={`btn ${editing ? "" : "light"}`} onClick={() => setEditing((e) => !e)}>
            <Icon name={editing ? "check" : "edit"} />{editing ? "Done editing" : "Edit timetable"}
          </button>
        )}
      </PageHead>
      <div className="card">
        <div className="card-head">
          <div>
            <h3>{week ? `My Timetable · ${periodsTaught} periods a week` : `Weekly Timetable · Class ${view} · Room ${roomOf(view)}`}</h3>
            {editing && <p>Pick a subject for each period. The teacher comes from Teaching Assignments; a teacher can't be in two classes at once.</p>}
            {week && clashes > 0 && <p className="text-red">{clashes} period(s) clash. Ask the admin to change the timetable or the assignment.</p>}
          </div>
          <div className="tabs" role="tablist">
            {isTeacher && <button role="tab" aria-selected={view === MINE} className={view === MINE ? "on" : ""} onClick={() => { setView(MINE); setEditing(false); }}>My Timetable</button>}
            {CLASSES.map((c) => <button key={c} role="tab" aria-selected={c === view} className={c === view ? "on" : ""} onClick={() => setView(c)}>Class {c}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className={`timetable ${editing ? "editing" : ""}`}>
            <thead>
              <tr><th className="no-sort">Time</th>{DATA.DAYS.map((d) => <th key={d} className="no-sort">{d}</th>)}</tr>
            </thead>
            <tbody>
              {DATA.PERIODS.map((t, pi) => (
                <tr key={t}>
                  <td><b>{t}</b></td>
                  {DATA.DAYS.map((d, di) => <td key={d}>{slot(di, pi)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
