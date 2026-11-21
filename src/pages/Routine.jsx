import { useState } from "react";
import { Link } from "react-router-dom";
import { levelOf } from "../levels.js";
import { DATA } from "../constants.js";
import { useSections, useSubjects } from "../lib/sections.js";
import { useLevel } from "../lib/level.jsx";
import { useScope } from "../lib/scope.js";
import { PageHead } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { findClash, teacherFor, teacherWeek } from "../lib/scope.js";
import Select from "../components/Select.jsx";

const MINE = "mine";
// Time picker choices: every 5 minutes from 06:00 to 20:55.
const pad = (n) => String(n).padStart(2, "0");
const TIMES = Array.from({ length: 15 * 12 }, (_, i) => `${pad(6 + Math.floor(i / 12))}:${pad((i % 12) * 5)}`);

export default function Routine() {
  const { user } = useAuth();
  const { students, assignments, teachers, classes, routine, setSlot, school, setPeriods } = useData();
  const PERIODS = school.periods?.length === DATA.PERIODS.length ? school.periods : DATA.PERIODS; // start time of each period
  const { toast } = useUI();
  /** Changes one period's start time (for every section); periods must stay in order. */
  const changeTime = (pi, t) => {
    const next = PERIODS.map((x, i) => (i === pi ? t : x));
    if (next.some((x, i) => i && x <= next[i - 1])) return toast(`Period ${pi + 1} must start after ${PERIODS[pi - 1] || "00:00"} and before ${PERIODS[pi + 1] || "midnight"}.`);
    setPeriods(next);
    toast(`Period ${pi + 1} now starts at ${t} (all sections)`);
  };
  const can = usePermission();
  const canEdit = can("routine", "edit");
  const canEditOf = (module) => can(module, "edit");
  const isTeacher = user.role === "teacher";
  // Students open on their own class; parents on their (first) child's class; teachers on their own timetable.
  const ownId = user.role === "student" ? user.studentId : user.role === "parent" ? user.childIds?.[0] : null;
  const myClass = ownId ? students.find((s) => s.id === ownId)?.class : null;
  const sections = useSections();
  const subjects = useSubjects();
  const scope = useScope();
  const { level, inLevel } = useLevel();
  // Staff pick from this level's sections; students and parents only see their own section.
  const choices = ownId ? [myClass].filter(Boolean) : (scope.all ? sections.ofLevel(level).map((c) => c.id) : scope.classes.filter(inLevel));
  const [picked, setView] = useState(isTeacher ? MINE : myClass || null);
  const view = picked === MINE ? MINE : choices.includes(picked) ? picked : choices[0] || null;
  const [editing, setEditing] = useState(false);
  const week = view === MINE ? teacherWeek(routine, assignments, user.teacherId) : null;
  const periodsTaught = week ? week.flat().filter(Boolean).length : 0;
  const clashes = week ? week.flat().filter((s) => s?.clash.length).length : 0;
  const roomOf = (cls) => sections.byId.get(cls)?.room || "—";
  const label = sections.label;
  const nameOf = (id) => teachers.find((t) => t.id === id)?.name || "A teacher";

  const change = (di, pi, subject) => {
    const clash = findClash(routine, assignments, view, di, pi, subject);
    if (clash) {
      toast(`${nameOf(clash.teacherId)} already teaches ${label(clash.class)} (${clash.subject}) on ${DATA.DAYS[di]} at ${PERIODS[pi]}.`);
      return;
    }
    setSlot(view, di, pi, subject);
    const who = subject ? teacherFor(assignments, teachers, view, subject) : "";
    toast(subject ? `${DATA.DAYS[di]} ${PERIODS[pi]}: ${subject}${who === "—" ? " (no teacher assigned yet)" : ` · ${who}`}` : `${DATA.DAYS[di]} ${PERIODS[pi]}: free period`);
  };

  const slot = (di, pi) => {
    if (week) {
      const s = week[di][pi];
      if (!s) return <div className="slot free"><small>Free</small></div>;
      return (
        <div className={`slot ${s.clash.length ? "clash" : ""}`}>
          <b>{s.subject}</b><small>{label(s.class)} · {roomOf(s.class)}</small>
          {s.clash.length > 0 && <small className="clash-note">Clash: also {s.clash.map((c) => label(c.class)).join(", ")}</small>}
        </div>
      );
    }
    const subject = routine[view]?.[di]?.[pi]?.subject || ""; // a new section starts with a free week
    if (editing) {
      return (
        <Select className="slot-select" value={subject} aria-label={`${DATA.DAYS[di]} ${PERIODS[pi]} subject`} onChange={(v) => change(di, pi, v)}
          options={[{ value: "", label: "Free period" }, ...subjects.forSection(view), ...(subject && !subjects.forSection(view).includes(subject) ? [subject] : [])]} />
      );
    }
    if (!subject) return <div className="slot free"><small>Free</small></div>;
    const who = teacherFor(assignments, teachers, view, subject);
    return <div className={`slot ${who === "—" ? "unassigned" : ""}`}><b>{subject}</b><small>{who === "—" ? "No teacher assigned" : who}</small><small>{roomOf(view)}</small></div>;
  };

  // A timetable belongs to a section: a level with no sections this year has nothing to show or edit yet.
  if (!view) {
    const levelName = levelOf(level)?.label || "this level";
    return (
      <>
        <PageHead title="Timetable" crumbs={["Routine"]} />
        <div className="card gb-empty">
          <span className="feed-icon tone-purple"><Icon name="calendar" /></span>
          <h3>No {levelName} sections this school year</h3>
          <p>{ownId ? "Your section doesn't have a timetable yet." : isTeacher && !scope.all
            ? `You aren't assigned to any ${levelName} section yet. Ask the admin to set your teaching assignments.`
            : `Each section has its own weekly timetable. Create a ${levelName} section first, then come back here and click Edit timetable.`}</p>
          {canEdit && scope.all && canEditOf("classes") && (
            <div className="gb-empty-actions"><Link className="btn" to={`/class?level=${level}`}><Icon name="plus" />Add a {levelName} section</Link></div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Timetable" crumbs={["Routine"]}>
        {canEdit && view && view !== MINE && (
          <button className={`btn ${editing ? "" : "light"}`} onClick={() => setEditing((e) => !e)}>
            <Icon name={editing ? "check" : "edit"} />{editing ? "Done editing" : "Edit timetable"}
          </button>
        )}
      </PageHead>
      <div className="card">
        <div className="card-head">
          <div>
            <h3>{week ? `My Timetable · ${periodsTaught} periods a week` : `Weekly Timetable · ${view ? label(view) : "No section"} · Room ${roomOf(view)}`}</h3>
            {editing && <p>Pick a subject for each period, and change a period's start time in the Time column (it applies to every section). The teacher comes from Teaching Assignments; a teacher can't be in two classes at once.</p>}
            {week && clashes > 0 && <p className="text-red">{clashes} period(s) clash. Ask the admin to change the timetable or the assignment.</p>}
          </div>
          <div className="tabs" role="tablist">
            {isTeacher && <button role="tab" aria-selected={view === MINE} className={view === MINE ? "on" : ""} onClick={() => { setView(MINE); setEditing(false); }}>My Timetable</button>}
          </div>
          {choices.length > 1 && (
            <Select value={view === MINE ? "" : view} placeholder="Choose a section" aria-label="Section" onChange={(v) => setView(v)}
              options={choices.map((id) => ({ value: id, label: label(id), group: sections.byId.get(id) ? undefined : undefined }))} />
          )}
        </div>
        <div className="table-wrap">
          <table className={`timetable ${editing ? "editing" : ""}`}>
            <thead>
              <tr><th className="no-sort">Time</th>{DATA.DAYS.map((d) => <th key={d} className="no-sort">{d}</th>)}</tr>
            </thead>
            <tbody>
              {PERIODS.map((t, pi) => (
                <tr key={pi}>
                  <td>{editing
                    ? <Select className="time-select" value={t} searchable aria-label={`Period ${pi + 1} start time`} onChange={(v) => changeTime(pi, v)}
                        options={(TIMES.includes(t) ? TIMES : [t, ...TIMES]).map((x) => ({ value: x, label: x }))} />
                    : <b>{t}</b>}</td>
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
