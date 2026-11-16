import { useState } from "react";
import { CLASSES, DATA } from "../data.js";
import { PageHead } from "../components/ui.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";

export default function Routine() {
  const { user } = useAuth();
  const { students } = useData();
  // Students open on their own class; parents on their (first) child's class.
  const ownId = user.role === "student" ? user.studentId : user.role === "parent" ? user.childIds?.[0] : null;
  const myClass = ownId ? students.find((s) => s.id === ownId)?.class : null;
  const [cls, setCls] = useState(myClass || CLASSES[0]);
  const grid = DATA.routine[cls];
  return (
    <>
      <PageHead title="Class Routine" crumbs={["Routine"]} />
      <div className="card">
        <div className="card-head">
          <h3>Weekly Timetable · Class {cls}</h3>
          <div className="tabs" role="tablist">
            {CLASSES.map((c) => <button key={c} role="tab" aria-selected={c === cls} className={c === cls ? "on" : ""} onClick={() => setCls(c)}>Class {c}</button>)}
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
                  {DATA.DAYS.map((d, di) => (
                    <td key={d}><div className="slot"><b>{grid[di][pi].subject}</b><small>{grid[di][pi].teacher}</small></div></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
