import { useEffect, useState } from "react";
import { useData, useView } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { buildReport, termLabel, useScope } from "../lib/scope.js";
import { downloadCsv, fmtDate, slug, todayIso } from "../lib/utils.js";
import { COLLEGE_TERMS, TERMS } from "../constants.js";
import Icon from "../components/Icon.jsx";
import { Avatar, Badge, PageHead, StatTile } from "../components/ui.jsx";
import { gradeFor } from "./SchoolSetup.jsx";
import Select from "../components/Select.jsx";
import DateInput from "../components/DateInput.jsx";
import { useSections } from "../lib/sections.js";
import { useLevel } from "../lib/level.jsx";

const TABS = [["attendance", "Attendance summary"], ["classlist", "Class list"], ["grades", "Class grades"]];
const monthStart = () => todayIso().slice(0, 8) + "01";

/** Printable reports with CSV export. Teachers only get the classes they teach. */
export default function Reports() {
  const data = useData();
  const { students, attendance, school, classes } = data;
  const { toast } = useUI();
  const scope = useScope();
  const [tab, setTab] = useState("attendance");
  const sections = useSections();
  const { inLevel } = useLevel();
  const mine = scope.classes.filter(inLevel);
  const [picked, setCls] = useState(scope.homeroom || "");
  const cls = mine.includes(picked) ? picked : mine[0] || "";
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayIso());
  const [termPick, setTerm] = useState("Q2");
  // This class's grades and attendance for the school year load from the server when it's chosen.
  const view = useView(cls ? { view: "class", class: cls } : null);
  // Class grades can also be shown for a closed school year (read-only, loaded when chosen).
  const years = [school.academicYear, ...[...(school.pastYears || [])].reverse()];
  const [yearKey, setYearKey] = useState(school.academicYear.key);
  const isCurrent = yearKey === school.academicYear.key;
  const yearLabel = (years.find((y) => y.key === yearKey) || school.academicYear).label;
  const [past, setPast] = useState({ key: "", grades: [], error: "" });
  const pastKey = `${yearKey}|${cls}`;
  useEffect(() => {
    if (isCurrent || tab !== "grades" || !cls) return undefined;
    let live = true;
    data.yearGrades(yearKey, null, cls).then((g) => live && setPast({ key: pastKey, grades: g, error: "" }), (e) => live && setPast({ key: pastKey, grades: [], error: e.message }));
    return () => { live = false; };
  }, [pastKey, isCurrent, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const pastLoading = !isCurrent && tab === "grades" && past.key !== pastKey;
  const notReady = view.loading || pastLoading ? "Still loading this class — try again in a moment" : view.error || (!isCurrent && tab === "grades" ? past.error : "");

  if (!mine.length) {
    return (
      <>
        <PageHead title="Reports" crumbs={["Reports"]} />
        <div className="card empty">You don't have any classes assigned yet.</div>
      </>
    );
  }

  const klass = sections.byId.get(cls);
  // Grading periods: quarters (K–12), or both semesters' Prelim / Midterm / Finals (College).
  const PERIODS = klass?.level === "college" ? COLLEGE_TERMS : TERMS;
  const term = PERIODS.some((t) => t.key === termPick) ? termPick : PERIODS[0].key;
  const classLabel = `${sections.label(cls)}${klass?.strand ? " · " + klass.strand : ""}`;
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
  const byId = new Map(students.map((s) => [s.id, s]));
  const pastList = [...new Set(past.grades.map((g) => g.studentId))]
    .map((id) => byId.get(id) || { id, name: id, roll: "—" }) // a student removed since then still shows by ID
    .sort((a, b) => a.name.localeCompare(b.name));
  const reports = isCurrent
    ? list.map((s) => ({ s, ...buildReport(s, data) }))
    : pastList.map((s) => ({ s, ...buildReport(s, { ...data, grades: past.grades }, { past: true }) }));
  // Every subject that appears, so each column lines up even when a student's subjects differ.
  const subjectNames = [...new Set(reports.flatMap((r) => r.rows.map((x) => x.subject)))];
  const cellOf = (r, subject) => r.rows.find((x) => x.subject === subject)?.terms[term] ?? null;

  const exportCsv = () => {
    if (notReady) return toast(notReady);
    const base = `${slug(classLabel)}-${todayIso()}`;
    if (tab === "attendance") {
      if (badRange) return toast("The start date must be on or before the end date");
      downloadCsv(`attendance-${base}.csv`, ["Roll", "Student", "ID", "Present", "Absent", "Late", "Days recorded", "Attendance %"],
        att.map((r) => [r.s.roll, r.s.name, r.s.id, r.P, r.A, r.L, r.total, r.rate ?? ""]));
    } else if (tab === "classlist") {
      downloadCsv(`class-list-${base}.csv`, ["Roll", "Student", "ID", "Gender", "Date of birth", "Parent / guardian", "Phone", "Email", "Address"],
        list.map((s) => [s.roll, s.name, s.id, s.gender, s.dob, s.parent, s.phone, s.email, s.address]));
    } else {
      downloadCsv(`grades-${yearKey}-${termLabel(term).replace(/\s+/g, "-").toLowerCase()}-${base}.csv`, ["Roll", "Student", "ID", ...subjectNames, "General average"],
        reports.map((r) => [isCurrent ? r.s.roll : "", r.s.name, r.s.id, ...subjectNames.map((n) => cellOf(r, n) ?? ""), avgOf(r.rows, term) ?? ""]));
    }
    toast("CSV downloaded — open it in Excel or Google Sheets");
  };

  return (
    <>
      <PageHead title="Reports" crumbs={["Reports"]}>
        <div className="row-actions print-hide" style={{ gap: 10 }}>
          <button className="btn light" onClick={exportCsv}><Icon name="download" />Export CSV</button>
          <button className="btn" onClick={() => (notReady ? toast(notReady) : tab === "attendance" && badRange ? toast("Fix the date range first") : window.print())}><Icon name="printer" />Print / Save PDF</button>
        </div>
      </PageHead>

      {view.loading && <p className="hint print-hide" role="status">Loading {sections.label(cls)}…</p>}
      {view.error && <div className="alert error print-hide" role="alert">{view.error}</div>}
      <div className="card print-hide">
        <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <div className="gb-pickers">
          <label>Class
            <Select value={cls} onChange={setCls} aria-label="Section" options={mine.map((c) => ({ value: c, label: sections.label(c) }))} />
          </label>
          {tab === "attendance" && (
            <>
              <label>From<DateInput value={from} max={to} required onChange={(v) => v && setFrom(v)} aria-label="From" /></label>
              <label>To<DateInput value={to} min={from} max={todayIso()} required onChange={(v) => v && setTo(v)} aria-label="To" /></label>
            </>
          )}
          {tab === "grades" && years.length > 1 && (
            <label>School year
              <Select value={yearKey} onChange={setYearKey} aria-label="School year"
                options={years.map((y) => ({ value: y.key, label: y.label + (y.key === school.academicYear.key ? " (current)" : "") }))} />
            </label>
          )}
          {tab === "grades" && (
            <label>Grading period
              <Select value={term} onChange={setTerm} aria-label="Grading period" options={PERIODS.map((t) => ({ value: t.key, label: t.label }))} />
            </label>
          )}
        </div>
        {tab === "attendance" && badRange && <p className="text-red" style={{ marginBottom: 0 }}>The start date must be on or before the end date.</p>}
      </div>

      <div className="card report-sheet">
        <div className="rc-head">
          <div>
            <small>{school.name} · {tab === "grades" ? yearLabel : school.academicYear.label}</small>
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
                {pastLoading && <tr><td colSpan={99} className="empty">Loading Class {cls} · {yearLabel}…</td></tr>}
                {!pastLoading && !reports.length && <tr><td colSpan={99} className="empty">{!isCurrent && past.error ? past.error : `No published grades for ${sections.label(cls)} in ${yearLabel}.`}</td></tr>}
                {!pastLoading && reports.map((r) => {
                  const avg = avgOf(r.rows, term);
                  return (
                    <tr key={r.s.id}>
                      <td>{isCurrent ? r.s.roll : "—"}</td><td><b>{r.s.name}</b></td>
                      {subjectNames.map((n) => { const v = cellOf(r, n); return <td key={n} className={v !== null && v < school.passingMark ? "text-red" : ""}>{v ?? "—"}</td>; })}
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
