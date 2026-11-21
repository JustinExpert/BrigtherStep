import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { buildReport } from "../lib/scope.js";
import { TERMS } from "../constants.js";
import Icon from "../components/Icon.jsx";
import { Avatar, Badge, PageHead } from "../components/ui.jsx";
import { gradeFor } from "./SchoolSetup.jsx";
import { attendanceLog, attendanceRate, MissingRecord } from "./StudentDashboard.jsx";
import { useMyChildren } from "./ParentDashboard.jsx";

/** Printable report card built from published grades only. */
export function ReportCardView({ student, showPrint = true }) {
  const data = useData();
  const { school, classes, attendance, yearGrades } = data;
  // The open year is already loaded; a past year's grades are fetched when chosen (read-only).
  const years = [school.academicYear, ...[...(school.pastYears || [])].reverse()];
  const [yearKey, setYearKey] = useState(school.academicYear.key);
  const [past, setPast] = useState({ key: null, grades: [], error: "" });
  const isCurrent = yearKey === school.academicYear.key;
  useEffect(() => {
    if (isCurrent) return;
    let live = true;
    setPast({ key: null, grades: [], error: "" });
    yearGrades(yearKey).then((g) => live && setPast({ key: yearKey, grades: g, error: "" }), (e) => live && setPast({ key: yearKey, grades: [], error: e.message }));
    return () => { live = false; };
  }, [yearKey, isCurrent, yearGrades]);
  const loading = !isCurrent && past.key !== yearKey;
  const year = years.find((y) => y.key === yearKey) || school.academicYear;

  const { rows, average, cls } = isCurrent ? buildReport(student, data) : buildReport(student, { ...data, grades: past.grades }, { past: true });
  const shownClass = cls || student.class;
  const section = classes.find((c) => c.name === "Class " + shownClass)?.section;
  const overall = average === null ? null : gradeFor(school, average);
  const log = attendanceLog(attendance, student);
  const count = (v) => log.filter((r) => r.status === v).length;
  const cell = (v) => (v === null ? <span className="muted">—</span> : <span className={v < school.passingMark ? "fail" : ""}>{v}</span>);

  return (
    <div className="card report-card">
      <div className="rc-head">
        <div>
          <small>{school.name} · {school.address}</small>
          <h2>Report Card · {year.label}</h2>
        </div>
        <div className="print-hide" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {years.length > 1 && (
            <select className="select" value={yearKey} onChange={(e) => setYearKey(e.target.value)} aria-label="School year">
              {years.map((y) => <option key={y.key} value={y.key}>{y.label}{y.key === school.academicYear.key ? " (current)" : ""}</option>)}
            </select>
          )}
          {showPrint && <button className="btn light sm" onClick={() => window.print()}><Icon name="printer" />Print</button>}
        </div>
      </div>
      <div className="rc-student">
        <Avatar name={student.name} color={student.color} />
        <div><b>{student.name}</b><small>{student.id} · Class {shownClass}{section && `-${section}`}{isCurrent && ` · Roll ${student.roll}`}</small></div>
      </div>
      {loading && <p className="hint" role="status">Loading {year.label} grades…</p>}
      {past.error && !isCurrent && <div className="alert error" role="alert">{past.error}</div>}
      <div className="table-wrap">
        <table className="rc-table">
          <thead>
            <tr>
              <th className="no-sort">Subject</th><th className="no-sort">Teacher</th>
              {TERMS.map((t) => <th key={t.key} className="no-sort">{t.key}</th>)}
              <th className="no-sort">Final</th><th className="no-sort">Grade</th><th className="no-sort">Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const g = r.final === null ? null : gradeFor(school, r.final);
              return (
                <tr key={r.subject}>
                  <td><b>{r.subject}</b></td><td>{r.teacher}</td>
                  {TERMS.map((t) => <td key={t.key}>{cell(r.terms[t.key])}</td>)}
                  <td><b>{cell(r.final)}</b></td>
                  <td>{g ? <Badge value={g.grade} cls={r.final >= school.passingMark ? "b-green" : "b-red"} /> : "—"}</td>
                  <td>{g ? g.remark : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2 + TERMS.length}><b>General average</b></td>
              <td><b>{average ?? "—"}</b></td>
              <td>{overall ? <Badge value={overall.grade} cls={average >= school.passingMark ? "b-green" : "b-red"} /> : "—"}</td>
              <td>{overall ? <b>{average >= school.passingMark ? "Passed" : "Needs improvement"}</b> : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Only published grades are shown; "—" means not graded or not published yet. Final = average of published quarters.
        {isCurrent
          ? <>Attendance this year: {count("P")} present, {count("A")} absent, {count("L")} late ({log.length ? `${attendanceRate(log)}% attendance` : "nothing recorded yet"}).</>
          : <>This is a closed school year, so these grades can no longer be changed. Teachers shown are the ones who entered the grades.</>}
      </p>
    </div>
  );
}

/** Students see their own report card; parents choose among their children. */
export default function ReportCard() {
  const { user } = useAuth();
  const { students } = useData();
  const children = useMyChildren();
  const [active, setActive] = useState(0);
  const list = user.role === "parent" ? children : students.filter((s) => s.id === user.studentId);
  if (!list.length) return user.role === "parent"
    ? <div className="card empty">No children are linked to your account yet. Please ask the school office.</div>
    : <MissingRecord />;
  const student = list[Math.min(active, list.length - 1)];

  return (
    <>
      <PageHead title="Report Card" crumbs={["Grades", "Report Card"]} />
      {list.length > 1 && (
        <div className="tabs child-tabs print-hide" role="tablist" aria-label="Choose a child">
          {list.map((c, i) => (
            <button key={c.id} role="tab" aria-selected={c.id === student.id} className={c.id === student.id ? "on" : ""} onClick={() => setActive(i)}>
              <Avatar name={c.name} color={c.color} />{c.name}
            </button>
          ))}
        </div>
      )}
      <ReportCardView key={student.id} student={student} />
    </>
  );
}
