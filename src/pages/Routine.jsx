import { useState } from "react";
import { CLASSES, DATA } from "../data.js";
import { PageHead } from "../components/ui.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { teacherFor, teacherWeek } from "../lib/scope.js";

const MINE = "mine";

export default function Routine() {
  const { user } = useAuth();
  const { students, assignments, teachers } = useData();
  const isTeacher = user.role === "teacher";
  // Students open on their own class; parents on their (first) child's class; teachers on their own timetable.
  const ownId = user.role === "student" ? user.studentId : user.role === "parent" ? user.childIds?.[0] : null;
  const myClass = ownId ? students.find((s) => s.id === ownId)?.class : null;
  const [view, setView] = useState(isTeacher ? MINE : myClass || CLASSES[0]);
  const week = view === MINE ? teacherWeek(assignments, user.teacherId) : null;
  const periodsTaught = week ? week.flat().filter(Boolean).length : 0;

  const slot = (di, pi) => {
    if (week) {
      const s = week[di][pi];
      return s ? <div className="slot"><b>{s.subject}</b><small>Class {s.class}</small></div> : <div className="slot free"><small>Free</small></div>;
    }
    const subject = DATA.routine[view][di][pi].subject;
    return <div className="slot"><b>{subject}</b><small>{teacherFor(assignments, teachers, view, subject)}</small></div>;
  };

  return (
    <>
      <PageHead title="Timetable" crumbs={["Routine"]} />
      <div className="card">
        <div className="card-head">
          <h3>{week ? `My Timetable · ${periodsTaught} periods a week` : `Weekly Timetable · Class ${view}`}</h3>
          <div className="tabs" role="tablist">
            {isTeacher && <button role="tab" aria-selected={view === MINE} className={view === MINE ? "on" : ""} onClick={() => setView(MINE)}>My Timetable</button>}
            {CLASSES.map((c) => <button key={c} role="tab" aria-selected={c === view} className={c === view ? "on" : ""} onClick={() => setView(c)}>Class {c}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="timetable">
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
