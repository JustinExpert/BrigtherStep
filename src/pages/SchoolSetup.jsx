import { useState } from "react";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { EMAIL_RE } from "../lib/crypto.js";
import Icon from "../components/Icon.jsx";
import { PageHead } from "../components/ui.jsx";

function validate(s) {
  const errs = [];
  if (!s.name.trim()) errs.push("School name is required.");
  if (s.email && !EMAIL_RE.test(s.email.trim())) errs.push("Contact email isn't valid.");
  if (s.website && !/^https?:\/\/\S+\.\S+/.test(s.website.trim())) errs.push("Website must start with http:// or https://");
  if (!s.academicYear.label.trim()) errs.push("Academic year needs a label (e.g. 2026–2027).");
  if (!s.academicYear.start || !s.academicYear.end || s.academicYear.start >= s.academicYear.end) errs.push("Academic year must end after it starts.");
  if (!(s.passingMark >= 0 && s.passingMark <= 100)) errs.push("Passing mark must be between 0 and 100.");
  const g = s.grading;
  if (!g.length) errs.push("Add at least one grade.");
  if (g.some((r) => !r.grade.trim())) errs.push("Every grade needs a letter or name.");
  if (new Set(g.map((r) => r.grade.trim().toUpperCase())).size !== g.length) errs.push("Grade names must be unique.");
  if (g.some((r) => !(r.min >= 0 && r.min <= 100))) errs.push("Grade minimums must be between 0 and 100.");
  if (new Set(g.map((r) => Number(r.min))).size !== g.length) errs.push("Two grades can't start at the same percentage.");
  if (!g.some((r) => Number(r.min) === 0)) errs.push("One grade must start at 0% so every score gets a grade.");
  return errs;
}

export default function SchoolSetup() {
  const { school, saveSchool } = useData();
  const { toast } = useUI();
  const can = usePermission();
  const canEdit = can("school", "edit");
  const [s, setS] = useState(() => structuredClone(school));
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
          <div className="card-head"><h3>Academic year</h3></div>
          <div className="form">
            <div className="form-grid three">
              <label>Label *<input className="input" maxLength={20} value={s.academicYear.label} onChange={setYear("label")} /></label>
              <label>Starts *<input className="input" type="date" value={s.academicYear.start} onChange={setYear("start")} /></label>
              <label>Ends *<input className="input" type="date" value={s.academicYear.end} onChange={setYear("end")} /></label>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>Grading system</h3><p>A score gets the highest grade whose minimum it reaches.</p></div>
            <label className="marks">Passing mark (%) <input className="input" type="number" min="0" max="100" value={s.passingMark} onChange={set("passingMark")} /></label>
          </div>
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
      </fieldset>
    </form>
  );
}

/** Letter grade for a percentage using the school's grading scale. */
export const gradeFor = (school, percent) =>
  [...school.grading].sort((a, b) => b.min - a.min).find((g) => percent >= g.min) || { grade: "—", remark: "" };
