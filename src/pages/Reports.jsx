import { useState } from "react";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { buildReport, termLabel, useScope } from "../lib/scope.js";
import { downloadCsv, fmtDate, slug, todayIso } from "../lib/utils.js";
import { TERMS } from "../data.js";
import Icon from "../components/Icon.jsx";
import { Avatar, Badge, PageHead, StatTile } from "../components/ui.jsx";
import { gradeFor } from "./SchoolSetup.jsx";

const TABS = [["attendance", "Attendance summary"], ["classlist", "Class list"], ["grades", "Class grades"]];
const monthStart = () => todayIso().slice(0, 8) + "01";

/** Printable reports with CSV export. Teachers only get the classes they teach. */
export default function Reports() {
  const data = useData();
  const { students, attendance, school, classes } = data;
  const { toast } = useUI();
  const scope = useScope();
  const [tab, setTab] = useState("attendance");
  const [cls, setCls] = useState(scope.homeroom || scope.classes[0] || "");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayIso());
  const [term, setTerm] = useState("Q2");

  if (!scope.classes.length) {
    return (
      <>
        <PageHead title="Reports" crumbs={["Reports"]} />
        <div className="card empty">You don't have any classes assigned yet.</div>
      </>
    );
  }

  const klass = classes.find((c) => c.name === "Class " + cls);
  const classLabel = `Class ${cls}${klass?.section ? "-" + klass.section : ""}${klass?.strand ? " · " + klass.strand : ""}`;
  const list = students.filter((s) => s.class === cls).sort((a, b) => a.roll.localeCompare(b.roll));
  const badRange = from > to;

  // ----- Attendance summary: counts per student over the date range -----
  const days = Object.keys(attendance).filter((k) => k.startsWith(cls + "|")).map((k) => k.split("|")[1]).filter((d) => d >= from && d <= to).sort();
  const att = list.map((s) => {
    const marks = days.map((d) => attendance[`${cls}|${d}`]?.[s.id]).filter(Boolean);
    const P = marks.filter((m) => m === "P").length, A = marks.filter((m) => m === "A").length, L = marks.filter((m) => m === "L").length;
    return { s, P, A, L, total: marks.length, rate: marks.length ? Math.round(((P + L) / marks.length) * 100) : null };
  });
  const totals = att.reduce((t, r) => ({ P: t.P + r.P, A: t.A + r.A, L: t.L + r.L }), { P: 0, A: 0, L: 0 });

  // ----- Class grades: each student's published quarterly grade per subject -----
  const reports = list.map((s) => ({ s, ...buildReport(s, data) }));
  const subjectNames = reports[0]?.rows.map((r) => r.subject) || [];

  const exportCsv = () => {
    const base = `${slug(classLabel)}-${todayIso()}`;
    if (tab === "attendance") {
      if (badRange) return toast("The start date must be on or before the end date");
      downloadCsv(`attendance-${base}.csv`, ["Roll", "Student", "ID", "Present", "Absent", "Late", "Days recorded", "Attendance %"],
        att.map((r) => [r.s.roll, r.s.name, r.s.id, r.P, r.A, r.L, r.total, r.rate ?? ""]));
    } else if (tab === "classlist") {
      downloadCsv(`class-list-${base}.csv`, ["Roll", "Student", "ID", "Gender", "Date of birth", "Parent / guardian", "Phone", "Email", "Address"],
        list.map((s) => [s.roll, s.name, s.id, s.gender, s.dob, s.parent, s.phone, s.email, s.address]));
    } else {
      downloadCsv(`grades-${termLabel(term).replace(/\s+/g, "-").toLowerCase()}-${base}.csv`, ["Roll", "Student", "ID", ...subjectNames, "General average"],
        reports.map((r) => [r.s.roll, r.s.name, r.s.id, ...r.rows.map((x) => x.terms[term] ?? ""), avgOf(r.rows, term) ?? ""]));
    }
    toast("CSV downloaded — open it in Excel or Google Sheets");
  };

  return (
    <>
      <PageHead title="Reports" crumbs={["Reports"]}>
        <div className="row-actions print-hide" style={{ gap: 10 }}>
          <button className="btn light" onClick={exportCsv}><Icon name="download" />Export CSV</button>
          <button className="btn" onClick={() => (tab === "attendance" && badRange ? toast("Fix the date range first") : window.print())}><Icon name="printer" />Print / Save PDF</button>
        </div>
      </PageHead>

      <div className="card print-hide">
        <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <div className="gb-pickers">
          <label>Class
            <select className="select" value={cls} onChange={(e) => setCls(e.target.value)}>
              {scope.classes.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </label>
          {tab === "attendance" && (
            <>
              <label>From<input className="input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
              <label>To<input className="input" type="date" value={to} min={from} max={todayIso()} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
            </>
          )}
          {tab === "grades" && (
            <label>Grading period
              <select className="select" value={term} onChange={(e) => setTerm(e.target.value)}>
                {TERMS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
          )}
        </div>
        {tab === "attendance" && badRange && <p className="text-red" style={{ marginBottom: 0 }}>The start date must be on or before the end date.</p>}
      </div>

      <div className="card report-sheet">
        <div className="rc-head">
          <div>
            <small>{school.name} · {school.academicYear.label}</small>
            <h2>{TABS.find(([k]) => k === tab)[1]} · {classLabel}</h2>
            <small>
              {tab === "attendance" ? `${fmtDate(from)} – ${fmtDate(to)} · ${days.length} school day(s) recorded`
                : tab === "grades" ? `${termLabel(term)} · published grades only`
                : `${list.length} students · class teacher ${klass?.teacher || "—"} · room ${klass?.room || "—"}`}
            </small>
          </div>
          <small className="muted">Printed {fmtDate(todayIso())}</small>
        </div>

        {tab === "attendance" && (
          <>
            <div className="stat-grid print-hide" style={{ marginBottom: 16 }}>
              <StatTile label="Days recorded" value={days.length} icon="calendar" tone="purple" />
              <StatTile label="Present" value={totals.P} icon="check" tone="green" />
              <StatTile label="Absent" value={totals.A} icon="x" tone="orange" />
              <StatTile label="Late" value={totals.L} icon="bell" tone="blue" />
            </div>
            {!days.length && <p className="empty">No attendance was saved for {classLabel} between these dates. Teachers save it on the Attendance page.</p>}
            <div className="table-wrap">
              <table className="report-table">
                <thead><tr><th className="no-sort">Roll</th><th className="no-sort">Student</th><th className="no-sort">Present</th><th className="no-sort">Absent</th><th className="no-sort">Late</th><th className="no-sort">Attendance</th></tr></thead>
                <tbody>
                  {att.map((r) => (
                    <tr key={r.s.id}>
                      <td>{r.s.roll}</td>
                      <td><div className="who"><Avatar name={r.s.name} color={r.s.color} />{r.s.name}</div></td>
                      <td>{r.P}</td><td>{r.A}</td><td>{r.L}</td>
                      <td>{r.rate === null ? "—" : <Badge value={`${r.rate}%`} cls={r.rate >= 90 ? "b-green" : r.rate >= 80 ? "b-amber" : "b-red"} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "classlist" && (
          <div className="table-wrap">
            <table className="report-table">
              <thead><tr><th className="no-sort">Roll</th><th className="no-sort">Student</th><th className="no-sort">ID</th><th className="no-sort">Gender</th><th className="no-sort">Parent / guardian</th><th className="no-sort">Phone</th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}><td>{s.roll}</td><td><b>{s.name}</b></td><td>{s.id}</td><td>{s.gender}</td><td>{s.parent}</td><td>{s.phone}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "grades" && (
          <div className="table-wrap">
            <table className="report-table">
              <thead><tr><th className="no-sort">Roll</th><th className="no-sort">Student</th>{subjectNames.map((n) => <th key={n} className="no-sort">{n}</th>)}<th className="no-sort">Average</th></tr></thead>
              <tbody>
                {reports.map((r) => {
                  const avg = avgOf(r.rows, term);
                  return (
                    <tr key={r.s.id}>
                      <td>{r.s.roll}</td><td><b>{r.s.name}</b></td>
                      {r.rows.map((x) => <td key={x.subject} className={x.terms[term] !== null && x.terms[term] < school.passingMark ? "text-red" : ""}>{x.terms[term] ?? "—"}</td>)}
                      <td>{avg === null ? "—" : <Badge value={`${avg} · ${gradeFor(school, avg).grade}`} cls={avg >= school.passingMark ? "b-green" : "b-red"} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** Average of the published grades for one quarter (1 decimal), or null. */
function avgOf(rows, term) {
  const v = rows.map((x) => x.terms[term]).filter((n) => n !== null && n !== undefined);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}
