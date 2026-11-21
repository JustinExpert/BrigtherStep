import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { buildReport } from "../lib/scope.js";
import { RATINGS, TERMS } from "../constants.js";
import Icon from "../components/Icon.jsx";
import { Avatar, Badge, PageHead } from "../components/ui.jsx";
import { gradeFor } from "./SchoolSetup.jsx";
import { attendanceLog, attendanceRate, MissingRecord } from "./StudentDashboard.jsx";
import { useMyChildren } from "./ParentDashboard.jsx";
import Select from "../components/Select.jsx";
import { useSections } from "../lib/sections.js";

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
    yearGrades(yearKey, student.id).then((g) => live && setPast({ key: yearKey, grades: g, error: "" }), (e) => live && setPast({ key: yearKey, grades: [], error: e.message }));
    return () => { live = false; };
  }, [yearKey, isCurrent, yearGrades, student.id]);
  const loading = !isCurrent && past.key !== yearKey;
  const year = years.find((y) => y.key === yearKey) || school.academicYear;

  const report = isCurrent ? buildReport(student, data) : buildReport(student, { ...data, grades: past.grades }, { past: true });
  const { rows, average, cls } = report;
  const shownClass = cls || student.class;
  const sections = useSections();
  const shownSection = sections.byId.get(shownClass);
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
            <Select value={yearKey} onChange={setYearKey} aria-label="School year"
              options={years.map((y) => ({ value: y.key, label: y.label + (y.key === school.academicYear.key ? " (current)" : "") }))} />
          )}
          {showPrint && <button className="btn light sm" onClick={() => window.print()}><Icon name="printer" />Print</button>}
        </div>
      </div>
      <div className="rc-student">
        <Avatar name={student.name} color={student.color} />
        <div><b>{student.name}</b><small>{student.id} · {sections.label(shownClass)}{shownSection?.strand ? ` · ${shownSection.strand}` : ""}{isCurrent && ` · Roll ${student.roll}`}</small></div>
      </div>
      {loading && <p className="hint" role="status">Loading {year.label} grades…</p>}
      {past.error && !isCurrent && <div className="alert error" role="alert">{past.error}</div>}
      {report.kinder ? <KinderTable report={report} /> : report.college ? <CollegeTables report={report} /> : report.shs ? <SemesterTables report={report} school={school} /> : (
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
      )}
      <p className="hint" style={{ marginTop: 12 }}>
        Only published grades are shown; "—" means not graded or not published yet.{" "}
        {report.kinder ? "Kinder progress is a checklist: B = Beginning, D = Developing, C = Consistent, for each learning area every quarter. "
          : report.college
          ? "Final = average of Prelim, Midterm and Finals, converted to the 1.00–5.00 scale (3.00 passing). GWA = units-weighted average; INC and DRP don't count. "
          : report.shs ? "Senior High subjects run for one semester: Final = average of its two quarters. "
          : "Final = average of published quarters. "}
        {isCurrent
          ? <>Attendance this year: {count("P")} present, {count("A")} absent, {count("L")} late ({log.length ? `${attendanceRate(log)}% attendance` : "nothing recorded yet"}).</>
          : <>This is a closed school year, so these grades can no longer be changed. Teachers shown are the ones who entered the grades.</>}
      </p>
    </div>
  );
}

/** Kinder report card: a rating (B / D / C) for each learning area every quarter; no number grades. */
function KinderTable({ report }) {
  const tone = { B: "b-red", D: "b-amber", C: "b-green" };
  return (
    <>
      <div className="table-wrap">
        <table className="rc-table">
          <thead><tr><th className="no-sort">Learning area</th><th className="no-sort">Teacher</th>{TERMS.map((t) => <th key={t.key} className="no-sort">{t.key}</th>)}</tr></thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.subject}>
                <td><b>{r.subject}</b></td><td>{r.teacher}</td>
                {TERMS.map((t) => <td key={t.key}>{r.terms[t.key] ? <Badge value={r.terms[t.key]} cls={tone[r.terms[t.key]]} /> : <span className="muted">—</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>{RATINGS.map((x) => <span key={x.key} style={{ marginRight: 14 }}><b>{x.key}</b> {x.label} — {x.hint.toLowerCase()}</span>)}</p>
    </>
  );
}

/** Senior High report card: one table per semester (Q1–Q2, Q3–Q4), each with its general average. */
function SemesterTables({ report, school }) {
  const cell = (v) => (v === null || v === undefined ? <span className="muted">—</span> : <span className={v < school.passingMark ? "fail" : ""}>{v}</span>);
  return (
    <>
      {report.semesters.map((sem) => {
        const periods = sem.rows[0]?.periods || [];
        return (
          <div className="table-wrap" key={sem.key} style={{ marginBottom: 16 }}>
            <table className="rc-table">
              <thead>
                <tr><th className="no-sort" colSpan={5 + periods.length}>{sem.label}</th></tr>
                <tr>
                  <th className="no-sort">Subject</th><th className="no-sort">Teacher</th>
                  {periods.map((t) => <th key={t.key} className="no-sort">{t.key}</th>)}
                  <th className="no-sort">Final</th><th className="no-sort">Grade</th><th className="no-sort">Remark</th>
                </tr>
              </thead>
              <tbody>
                {sem.rows.map((r) => {
                  const g = r.final === null ? null : gradeFor(school, r.final);
                  return (
                    <tr key={r.subject}>
                      <td><b>{r.subject}</b></td><td>{r.teacher}</td>
                      {periods.map((t) => <td key={t.key}>{cell(r.terms[t.key])}</td>)}
                      <td><b>{cell(r.final)}</b></td>
                      <td>{g ? <Badge value={g.grade} cls={r.final >= school.passingMark ? "b-green" : "b-red"} /> : "—"}</td>
                      <td>{g ? g.remark : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={2 + periods.length}><b>General average · {sem.label}</b></td><td><b>{sem.average ?? "—"}</b></td><td colSpan={2} /></tr>
              </tfoot>
            </table>
          </div>
        );
      })}
      {report.semesters.length > 1 && <p><b>General average for the school year: {report.average ?? "—"}</b></p>}
    </>
  );
}

/** College report card: one table per semester with units, Prelim / Midterm / Finals, final grade and GWA. */
function CollegeTables({ report }) {
  const cell = (v) => (v === null || v === undefined ? <span className="muted">—</span> : v);
  const remark = (r) => (r.mark === "INC" ? "Incomplete" : r.mark === "DRP" ? "Dropped" : r.cgrade ? (r.cgrade.passed ? "Passed" : "Failed") : "—");
  return (
    <>
      {report.semesters.map((sem) => (
        <div className="table-wrap" key={sem.key} style={{ marginBottom: 16 }}>
          <table className="rc-table">
            <thead>
              <tr><th className="no-sort" colSpan={9}>{sem.label}</th></tr>
              <tr>
                <th className="no-sort">Code</th><th className="no-sort">Subject</th><th className="no-sort">Units</th>
                {["Prelim", "Midterm", "Finals"].map((x) => <th key={x} className="no-sort">{x}</th>)}
                <th className="no-sort">Final %</th><th className="no-sort">Grade</th><th className="no-sort">Remark</th>
              </tr>
            </thead>
            <tbody>
              {sem.rows.map((r) => (
                <tr key={r.subject}>
                  <td>{r.code || "—"}</td><td><b>{r.subject}</b><small className="muted" style={{ display: "block" }}>{r.teacher}</small></td><td>{r.units}</td>
                  {r.periods.map((t) => <td key={t.key}>{cell(r.terms[t.key])}</td>)}
                  <td>{cell(r.final)}</td>
                  <td>{r.mark ? <Badge value={r.mark} cls="b-amber" /> : r.cgrade ? <Badge value={r.cgrade.grade} cls={r.cgrade.passed ? "b-green" : "b-red"} /> : "—"}</td>
                  <td>{remark(r)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><b>Semester GWA</b></td><td><b>{sem.units}</b></td><td colSpan={4} />
                <td><b>{sem.gwa === null ? "—" : sem.gwa.toFixed(2)}</b></td><td />
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
      {!report.semesters.length && <div className="card empty">No subjects yet.</div>}
      {report.semesters.length > 1 && <p><b>School year GWA: {report.gwa === null ? "—" : report.gwa.toFixed(2)}</b></p>}
    </>
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
