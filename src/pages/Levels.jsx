// Vendor page: which school levels this copy of BrighterStep may use (what the school bought).
// Only the Super Admin sees it, and saving needs the vendor code (VENDOR_KEY), which the school never gets.
import { useState } from "react";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { LEVELS } from "../levels.js";
import { PageHead } from "../components/ui.jsx";
import { PasswordInput } from "./Login.jsx";

export default function Levels() {
  const { levels, classes, school, saveLevels } = useData();
  const { toast } = useUI();
  const [on, setOn] = useState(levels);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sectionsOf = (key) => classes.filter((c) => c.year === school.academicYear.key && c.level === key).length;
  const turningOff = levels.filter((l) => !on.includes(l) && sectionsOf(l));
  const changed = on.length !== levels.length || on.some((l) => !levels.includes(l));

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!on.length) return setError("Turn on at least one level.");
    setBusy(true);
    try {
      await saveLevels(on, code);
      setCode("");
      toast("School levels saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="School Levels" crumbs={["Administration", "School Levels"]} />
      <form className="card form" onSubmit={save} style={{ maxWidth: 640 }}>
        <div className="card-head">
          <div>
            <h3>Levels this school uses</h3>
            <p>Only levels that are on appear in the app: their tabs, sections, subjects, students, grades and reports. Turning a level off hides its data; nothing is deleted.</p>
          </div>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <fieldset className="check-group">
          <legend>Levels</legend>
          <div className="check-list" style={{ flexDirection: "column", gap: 10 }}>
            {LEVELS.map((l) => (
              <label key={l.key} className="check-row">
                <input type="checkbox" disabled={!l.available} checked={on.includes(l.key)}
                  onChange={(e) => setOn((cur) => (e.target.checked ? [...cur, l.key] : cur.filter((k) => k !== l.key)))} />
                <span>{l.label} <small className="muted">· {l.grades.map((g) => g.label).join(", ")}{!l.available && " · coming with the College module"}{sectionsOf(l.key) ? ` · ${sectionsOf(l.key)} sections this year` : ""}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        {turningOff.length > 0 && (
          <div className="alert info" role="status">
            Turning off {turningOff.map((k) => LEVELS.find((l) => l.key === k).label).join(", ")} hides {turningOff.reduce((n, k) => n + sectionsOf(k), 0)} sections of this year and their students from everyone.
          </div>
        )}
        <label>Vendor code *
          <PasswordInput value={code} onChange={setCode} autoComplete="off" placeholder="From your BrighterStep provider" label="Vendor code" />
        </label>
        <p className="hint">The levels are part of the school's licence, so changes need the provider's vendor code.</p>
        <div className="form-actions">
          <button className="btn" disabled={busy || !changed || !code}>{busy ? "Saving…" : "Save levels"}</button>
        </div>
      </form>
    </>
  );
}
