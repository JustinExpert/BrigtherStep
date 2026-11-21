import { useState } from "react";
import { useData, useView } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { EMAIL_RE } from "../lib/crypto.js";
import Icon from "../components/Icon.jsx";
import { PageHead } from "../components/ui.jsx";
import { GRADUATED } from "../constants.js";
import { subjectLevels } from "../levels.js";
import { COMPONENTS, DEPED_SCALE, weightsFor, weightTotal } from "../lib/gradeCalc.js";
import DateInput from "../components/DateInput.jsx";

/** Same day, one year later ("2026-08-17" → "2027-08-17"). */
const nextYearDate = (iso) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;

/** Closes the open school year and opens the next one, optionally moving every student up a class. */
function NewYearForm({ onDone, onCancel }) {
  const { school, startNewYear } = useData();
  const { toast } = useUI();
  const cur = school.academicYear;
  const [f, setF] = useState(() => {
    const start = nextYearDate(cur.start), end = nextYearDate(cur.end);
    return { label: `${start.slice(0, 4)}–${end.slice(0, 4)}`, start, end, promote: true };
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const drafts = useView({ view: "summary" }).data?.drafts || 0; // counted by the server for the whole school
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await startNewYear(f);
      toast(`School year ${f.label} started${f.promote ? ` · ${r.promoted} students moved up, ${r.graduated} graduated` : ""}`);
      onDone(r.year);
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="alert error" role="alert">{error}</div>}
      <p style={{ margin: 0 }}>
        <b>{cur.label}</b> will be closed: its grades stay on report cards but can no longer be changed.
        Its sections, teaching assignments and timetable are copied to the new year, and gradebooks start empty.
      </p>
      {drafts > 0 && <div className="alert error" role="alert">{drafts} grade{drafts === 1 ? " is" : "s are"} still unpublished in {cur.label}. Publish them first, or they'll be locked as drafts that students and parents never see.</div>}
      <div className="form-grid three">
        <label>Label *<input className="input" required maxLength={20} value={f.label} onChange={set("label")} /></label>
        <label>Starts *<DateInput required value={f.start} onChange={(v) => setF({ ...f, start: v })} aria-label="New year starts" /></label>
        <label>Ends *<DateInput required value={f.end} min={f.start} onChange={(v) => setF({ ...f, end: v })} aria-label="New year ends" /></label>
      </div>
      <label className="check-row">
        <input type="checkbox" className="check" checked={f.promote} onChange={set("promote")} />
        <span>Move every student up one grade, into the same-named section (students in the school's last grade are marked {GRADUATED})</span>
      </label>
      <p className="hint">This can't be undone from the app. Download a backup first if you might need to go back.</p>
      <div className="form-actions">
        <button type="button" className="btn light" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={busy}>{busy ? "Starting…" : `Start ${f.label || "new year"}`}</button>
      </div>
    </form>
  );
}

function validate(s) {
  const errs = [];
  if (!s.name.trim()) errs.push("School name is required.");
  if (s.email && !EMAIL_RE.test(s.email.trim())) errs.push("Contact email isn't valid.");
  if (s.website && !/^https?:\/\/\S+\.\S+/.test(s.website.trim())) errs.push("Website must start with http:// or https://");
  if (!s.academicYear.label.trim()) errs.push("Academic year needs a label (e.g. 2026–2027).");
  if (!s.academicYear.start || !s.academicYear.end || s.academicYear.start >= s.academicYear.end) errs.push("Academic year must end after it starts.");
  if (!(s.passingMark >= 0 && s.passingMark <= 100)) errs.push("Passing mark must be between 0 and 100.");
  if (s.strands.some((x) => !x.trim())) errs.push("Strand names can't be empty.");
  if (new Set(s.strands.map((x) => x.trim().toUpperCase())).size !== s.strands.length) errs.push("Strand names must be unique.");
  if (s.programs.some((p) => !/^[A-Za-z0-9-]{2,20}$/.test(p.code) || !p.name.trim())) errs.push("Each College program needs a code (e.g. BSIT) and a name.");
  if (new Set(s.programs.map((p) => p.code.toUpperCase())).size !== s.programs.length) errs.push("College program codes must be unique.");
  if (s.programs.some((p) => !(Number.isInteger(p.years) && p.years >= 1 && p.years <= 5))) errs.push("A College program lasts 1 to 5 years.");
  if (s.collegeScale.some((r) => !/^\d\.\d{2}$/.test(r.grade) || !(r.min >= 0 && r.min <= 100))) errs.push("College grades must look like 1.00 to 5.00, each with a minimum from 0 to 100.");
  if (new Set(s.collegeScale.map((r) => r.min)).size !== s.collegeScale.length || !s.collegeScale.some((r) => r.min === 0)) errs.push("College grade scale: each row needs its own minimum, and the lowest must start at 0%.");
  const g = s.grading;
  if (!g.length) errs.push("Add at least one grade.");
  if (g.some((r) => !r.grade.trim())) errs.push("Every grade needs a letter or name.");
  if (new Set(g.map((r) => r.grade.trim().toUpperCase())).size !== g.length) errs.push("Grade names must be unique.");
  if (g.some((r) => !(r.min >= 0 && r.min <= 100))) errs.push("Grade minimums must be between 0 and 100.");
  if (new Set(g.map((r) => Number(r.min))).size !== g.length) errs.push("Two grades can't start at the same percentage.");
  if (!g.some((r) => Number(r.min) === 0)) errs.push("One grade must start at 0% so every score gets a grade.");
  for (const subject of Object.keys(s.weights)) {
    const wt = s.weights[subject];
    if (COMPONENTS.some((c) => !(wt[c.key] >= 0 && wt[c.key] <= 100))) errs.push(`${subject}: each weight must be between 0 and 100.`);
    else if (weightTotal(wt) !== 100) errs.push(`${subject}: weights add up to ${weightTotal(wt)}%, they must total 100%.`);
  }
  return errs;
}

export default function SchoolSetup() {
  const { school, saveSchool, subjects, levels = [] } = useData();
  const { toast, openModal, closeModal } = useUI();
  // Weights for the subjects of the levels this school offers (Subjects page), A–Z.
  const SUBJECTS = subjects.filter((x) => subjectLevels(x).some((l) => levels.includes(l))).map((x) => x.name).sort((a, b) => a.localeCompare(b));
  const can = usePermission();
  const canEdit = can("school", "edit");
  const [s, setS] = useState(() => ({
    ...structuredClone(school),
    strands: [...(school.strands || [])],
    programs: structuredClone(school.programs || []),
    collegeScale: structuredClone(school.collegeScale || []),
    transmutation: !!school.transmutation,
    weights: Object.fromEntries(SUBJECTS.map((sub) => [sub, { ...weightsFor(school, sub) }])),
  }));
  const wOf = (sub) => s.weights[sub] || weightsFor(school, sub); // a subject added since this page opened
  const [newStrand, setNewStrand] = useState("");
  const addStrand = () => {
    const v = newStrand.trim().toUpperCase();
    if (!v) return;
    if (s.strands.some((x) => x.toUpperCase() === v)) return toast(`${v} is already in the list`);
    setS({ ...s, strands: [...s.strands, v] });
    setNewStrand("");
  };
  const applyDeped = () => {
    setS({ ...s, grading: DEPED_SCALE.map((g) => ({ ...g })), passingMark: 75, transmutation: true });
    toast("DepEd grading applied — click Save changes to keep it");
  };
  const setWeight = (subject, k, v) => setS({ ...s, weights: { ...s.weights, [subject]: { ...wOf(subject), [k]: v } } });
  const [errors, setErrors] = useState([]);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const setYear = (k) => (e) => setS({ ...s, academicYear: { ...s.academicYear, [k]: e.target.value } });
  const setGrade = (i, k, v) => setS({ ...s, grading: s.grading.map((g, j) => (j === i ? { ...g, [k]: v } : g)) });

  const save = (e) => {
    e.preventDefault();
    const clean = {
      ...s,
      name: s.name.trim(), motto: s.motto.trim(), address: s.address.trim(), phone: s.phone.trim(), email: s.email.trim(), website: s.website.trim(),
      academicYear: { ...s.academicYear, label: s.academicYear.label.trim() },
      passingMark: Number(s.passingMark),
      grading: s.grading.map((g) => ({ grade: g.grade.trim(), min: Number(g.min), remark: g.remark.trim() })).sort((a, b) => b.min - a.min),
      weights: Object.fromEntries(SUBJECTS.map((sub) => [sub, Object.fromEntries(COMPONENTS.map((c) => [c.key, Number(wOf(sub)[c.key])]))])),
      strands: s.strands.map((x) => x.trim()),
      programs: s.programs.map((p) => ({ code: p.code.trim().toUpperCase(), name: p.name.trim(), years: Number(p.years) })),
      collegeScale: s.collegeScale.map((r) => ({ grade: Number(r.grade).toFixed(2), min: Number(r.min) })).sort((a, b) => b.min - a.min),
      transmutation: !!s.transmutation,
    };
    const errs = validate(clean);
    setErrors(errs);
    if (errs.length) return window.scrollTo({ top: 0, behavior: "smooth" });
    saveSchool(clean);
    setS(clean);
    toast("School profile saved");
  };

  return (
    <form onSubmit={save} style={{ display: "contents" }}>
      <PageHead title="School Setup" crumbs={["Administration", "School Setup"]}>
        {canEdit ? <button className="btn">Save changes</button> : <span className="badge b-blue">View only</span>}
      </PageHead>
      {errors.length > 0 && (
        <div className="alert error" role="alert"><b>Please fix the following:</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <fieldset disabled={!canEdit} className="plain-fieldset">
        <div className="card">
          <div className="card-head"><h3>School profile</h3></div>
          <div className="form">
            <div className="form-grid">
              <label>School name *<input className="input" required maxLength={100} value={s.name} onChange={set("name")} /></label>
              <label>Motto<input className="input" maxLength={120} value={s.motto} onChange={set("motto")} /></label>
              <label style={{ gridColumn: "1 / -1" }}>Address<input className="input" maxLength={200} value={s.address} onChange={set("address")} /></label>
              <label>Phone<input className="input" type="tel" maxLength={30} value={s.phone} onChange={set("phone")} /></label>
              <label>Contact email<input className="input" type="email" value={s.email} onChange={set("email")} /></label>
              <label>Website<input className="input" maxLength={120} value={s.website} onChange={set("website")} placeholder="https://" /></label>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>School year</h3><p>Grades and gradebook activities belong to the open school year. Closed years stay readable on report cards but can't be changed.</p></div>
            {canEdit && (
              <button type="button" className="btn light sm" onClick={() => openModal("Start new school year", (
                <NewYearForm onDone={(year) => { setS((cur) => ({ ...cur, academicYear: year, pastYears: [...(cur.pastYears || []), cur.academicYear] })); closeModal(); }} onCancel={closeModal} />
              ))}>
                <Icon name="calendar" />Start new school year
              </button>
            )}
          </div>
          <div className="form">
            <div className="form-grid three">
              <label>Label *<input className="input" maxLength={20} value={s.academicYear.label} onChange={setYear("label")} /></label>
              <label>Starts *<DateInput required value={s.academicYear.start} onChange={(v) => setS({ ...s, academicYear: { ...s.academicYear, start: v } })} aria-label="School year starts" /></label>
              <label>Ends *<DateInput required value={s.academicYear.end} min={s.academicYear.start} onChange={(v) => setS({ ...s, academicYear: { ...s.academicYear, end: v } })} aria-label="School year ends" /></label>
            </div>
            {(s.pastYears || []).length > 0 && (
              <p className="hint">Closed school years: {[...s.pastYears].reverse().map((y) => y.label).join(", ")}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><h3>Senior High strands</h3><p>Pick one per class on the Class page. Junior High classes have no strand.</p></div></div>
          <div className="chips" style={{ marginTop: 0 }}>
            {s.strands.map((x, i) => (
              <span className="chip" key={x + i}>{x}
                {canEdit && <button type="button" aria-label={`Remove ${x}`} onClick={() => setS({ ...s, strands: s.strands.filter((_, j) => j !== i) })}>×</button>}
              </span>
            ))}
            {!s.strands.length && <small className="hint">No strands yet.</small>}
          </div>
          {canEdit && (
            <div className="inline-add">
              <input className="input" maxLength={20} placeholder="e.g. Sports" value={newStrand} aria-label="New strand"
                onChange={(e) => setNewStrand(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStrand(); } }} />
              <button type="button" className="btn sm light" onClick={addStrand}><Icon name="plus" />Add strand</button>
            </div>
          )}
        </div>

        {levels.includes("college") && (
          <div className="card">
            <div className="card-head"><div><h3>College programs &amp; grade scale</h3><p>Each College section belongs to one program. Grades are converted from % to the 1.00–5.00 scale (3.00 passing, 5.00 failed).</p></div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th className="no-sort">Code</th><th className="no-sort">Program name</th><th className="no-sort">Years</th><th className="no-sort" /></tr></thead>
                <tbody>
                  {s.programs.map((p, i) => {
                    const setP = (k, v) => setS({ ...s, programs: s.programs.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
                    return (
                      <tr key={i}>
                        <td><input className="input" style={{ width: 110 }} maxLength={20} value={p.code} onChange={(e) => setP("code", e.target.value)} aria-label="Program code" /></td>
                        <td><input className="input" style={{ width: "100%", minWidth: 200 }} maxLength={100} value={p.name} onChange={(e) => setP("name", e.target.value)} aria-label="Program name" /></td>
                        <td><input className="input" style={{ width: 80 }} type="number" min="1" max="5" value={p.years} onChange={(e) => setP("years", Number(e.target.value))} aria-label="Years" /></td>
                        <td>{canEdit && <button type="button" className="icon-btn danger" title="Remove program" onClick={() => setS({ ...s, programs: s.programs.filter((_, j) => j !== i) })}><Icon name="trash" /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEdit && <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setS({ ...s, programs: [...s.programs, { code: "", name: "", years: 4 }] })}>+ Add program</button>}
            <div className="table-wrap" style={{ marginTop: 18 }}>
              <table>
                <thead><tr><th className="no-sort">College grade</th><th className="no-sort">From (%)</th><th className="no-sort" /></tr></thead>
                <tbody>
                  {s.collegeScale.map((r, i) => {
                    const setR = (k, v) => setS({ ...s, collegeScale: s.collegeScale.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
                    return (
                      <tr key={i}>
                        <td><input className="input" style={{ width: 90 }} maxLength={4} value={r.grade} onChange={(e) => setR("grade", e.target.value)} aria-label="College grade" /></td>
                        <td><input className="input" style={{ width: 100 }} type="number" min="0" max="100" value={r.min} onChange={(e) => setR("min", e.target.value === "" ? "" : Number(e.target.value))} aria-label="Minimum percent" /></td>
                        <td>{canEdit && <button type="button" className="icon-btn danger" title="Remove row" disabled={s.collegeScale.length <= 2} onClick={() => setS({ ...s, collegeScale: s.collegeScale.filter((_, j) => j !== i) })}><Icon name="trash" /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canEdit && <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setS({ ...s, collegeScale: [...s.collegeScale, { grade: "", min: "" }] })}>+ Add grade</button>}
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <div><h3>Grading system</h3><p>A grade gets the highest level whose minimum it reaches.</p></div>
            <div className="row-actions" style={{ gap: 12, flexWrap: "wrap" }}>
              <label className="marks">Passing mark <input className="input" type="number" min="0" max="100" value={s.passingMark} onChange={set("passingMark")} /></label>
              {canEdit && <button type="button" className="btn sm light" onClick={applyDeped}>Use DepEd grading</button>}
            </div>
          </div>
          <label className="toggle-row">
            <span className="switch"><input type="checkbox" checked={s.transmutation} onChange={(e) => setS({ ...s, transmutation: e.target.checked })} /><span /></span>
            <span><b>Apply the DepEd transmutation table</b><small>Converts each quarterly initial grade (e.g. 60.00) into the transmuted grade (75) before it goes on the report card. Teachers then publish again to update report cards.</small></span>
          </label>
          <div className="table-wrap">
            <table>
              <thead><tr><th className="no-sort">Grade</th><th className="no-sort">From (%)</th><th className="no-sort">Remark</th><th className="no-sort" /></tr></thead>
              <tbody>
                {s.grading.map((g, i) => (
                  <tr key={i}>
                    <td><input className="input" style={{ width: 90 }} maxLength={4} value={g.grade} onChange={(e) => setGrade(i, "grade", e.target.value)} aria-label="Grade" /></td>
                    <td><input className="input" style={{ width: 100 }} type="number" min="0" max="100" value={g.min} onChange={(e) => setGrade(i, "min", e.target.value)} aria-label="Minimum percent" /></td>
                    <td><input className="input" style={{ width: "100%", minWidth: 160 }} maxLength={40} value={g.remark} onChange={(e) => setGrade(i, "remark", e.target.value)} aria-label="Remark" /></td>
                    <td>{canEdit && <button type="button" className="icon-btn danger" title="Remove grade" disabled={s.grading.length <= 1}
                      onClick={() => setS({ ...s, grading: s.grading.filter((_, j) => j !== i) })}><Icon name="trash" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setS({ ...s, grading: [...s.grading, { grade: "", min: "", remark: "" }] })}>+ Add grade</button>}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3>Grade components &amp; weights</h3>
              <p>Teachers record activities under each component. A subject's quarterly grade = each component's % × its weight. Each row must total 100%.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="weights-table">
              <thead>
                <tr>
                  <th className="no-sort">Subject</th>
                  {COMPONENTS.map((c) => <th key={c.key} className="no-sort" title={c.hint}>{c.label} (%)</th>)}
                  <th className="no-sort">Total</th>
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map((subject) => {
                  const total = weightTotal(wOf(subject));
                  return (
                    <tr key={subject}>
                      <td><b>{subject}</b></td>
                      {COMPONENTS.map((c) => (
                        <td key={c.key}>
                          <input className="input" type="number" min="0" max="100" style={{ width: 90 }} value={wOf(subject)[c.key]}
                            aria-label={`${subject} ${c.label} weight`} onChange={(e) => setWeight(subject, c.key, e.target.value)} />
                        </td>
                      ))}
                      <td><span className={`badge ${total === 100 ? "b-green" : "b-red"}`}>{total}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

/** Letter grade for a percentage using the school's grading scale. */
export const gradeFor = (school, percent) =>
  [...school.grading].sort((a, b) => b.min - a.min).find((g) => percent >= g.min) || { grade: "—", remark: "" };
