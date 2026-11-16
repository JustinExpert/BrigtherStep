import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { termLabel, useScope } from "../lib/scope.js";
import { TERMS } from "../data.js";
import { todayIso } from "../lib/utils.js";
import { Avatar, Badge, PageHead, StatTile } from "../components/ui.jsx";
import { gradeFor } from "./SchoolSetup.jsx";

const valid = (v) => v === "" || (/^\d{1,3}$/.test(v) && Number(v) >= 0 && Number(v) <= 100);

export default function Gradebook() {
  const { user } = useAuth();
  const { students, grades, school, teachers, upsertMany } = useData();
  const { toast, confirm } = useUI();
  const canEdit = usePermission()("grades", "edit");
  const scope = useScope();
  // Teachers pick from their own assignments; admins from all.
  const options = useMemo(() => [...scope.assignments].sort((a, b) => a.class.localeCompare(b.class) || a.subject.localeCompare(b.subject)), [scope.assignments]);
  const [pick, setPick] = useState(() => options[0]?.id || "");
  const [term, setTerm] = useState("Q2");
  const current = options.find((a) => a.id === pick) || options[0];
  const list = current ? students.filter((s) => s.class === current.class).sort((a, b) => a.roll.localeCompare(b.roll)) : [];
  const idOf = (sid) => `${sid}|${current.subject}|${term}`;
  const saved = (sid) => grades.find((g) => g.id === idOf(sid));

  const [scores, setScores] = useState({});
  const key = current ? `${current.id}|${term}` : "";
  useEffect(() => {
    if (!current) return;
    setScores(Object.fromEntries(list.map((s) => [s.id, saved(s.id)?.score?.toString() ?? ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, grades]);

  if (!current) {
    return (
      <>
        <PageHead title="Gradebook" crumbs={["Grades", "Gradebook"]} />
        <div className="card empty">You don't have any classes assigned yet. Ask the school admin to set your teaching assignments.</div>
      </>
    );
  }

  const entered = list.filter((s) => scores[s.id] !== "" && scores[s.id] !== undefined);
  const invalid = list.filter((s) => !valid(scores[s.id] ?? ""));
  const nums = entered.filter((s) => valid(scores[s.id])).map((s) => Number(scores[s.id]));
  const avg = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
  const passed = nums.filter((n) => n >= school.passingMark).length;
  const publishedCount = list.filter((s) => saved(s.id)?.published).length;
  const allPublished = publishedCount > 0 && publishedCount === list.filter((s) => saved(s.id)).length;
  const dirty = list.some((s) => (saved(s.id)?.score?.toString() ?? "") !== (scores[s.id] ?? ""));
  const teacherName = teachers.find((t) => t.id === current.teacherId)?.name || "—";

  const save = (publish) => {
    if (invalid.length) return toast(`Fix ${invalid.length} invalid score${invalid.length > 1 ? "s" : ""} (whole numbers 0–100)`);
    if (publish && !entered.length) return toast("Enter at least one score before publishing");
    const records = entered.map((s) => ({
      id: idOf(s.id), studentId: s.id, class: current.class, subject: current.subject, term,
      score: Number(scores[s.id]), published: publish, updatedBy: user.teacherId || user.id, updatedAt: todayIso(),
    }));
    const apply = () => {
      upsertMany("grades", records);
      const n = `${records.length} grade${records.length === 1 ? "" : "s"}`;
      toast(publish ? `Published ${n} — students and parents can see them now` : `Saved ${n} as draft`);
    };
    if (publish && entered.length < list.length) {
      confirm("Publish with missing scores?", `${list.length - entered.length} student(s) have no score yet. Only entered scores will be published.`, apply, "Publish");
    } else apply();
  };
  const unpublish = () => confirm("Unpublish grades?", "Students and parents will no longer see these grades until you publish again.", () => {
    upsertMany("grades", list.filter((s) => saved(s.id)).map((s) => ({ ...saved(s.id), published: false })));
    toast("Grades moved back to draft");
  }, "Unpublish");

  return (
    <>
      <PageHead title="Gradebook" crumbs={["Grades", "Gradebook"]}>
        {canEdit && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {allPublished && !dirty && <button className="btn light" onClick={unpublish}>Unpublish</button>}
            <button className="btn light" onClick={() => save(false)} disabled={!dirty}>Save draft</button>
            <button className="btn" onClick={() => save(true)}>{allPublished && !dirty ? "Published ✓" : "Save & publish"}</button>
          </div>
        )}
      </PageHead>

      <div className="card">
        <div className="gb-pickers">
          <label>Class &amp; subject
            <select className="select" value={current.id} onChange={(e) => setPick(e.target.value)}>
              {options.map((a) => <option key={a.id} value={a.id}>Class {a.class} · {a.subject}</option>)}
            </select>
          </label>
          <div>
            <span className="gb-label">Grading period</span>
            <div className="tabs" role="tablist">
              {TERMS.map((t) => <button key={t.key} role="tab" aria-selected={t.key === term} className={t.key === term ? "on" : ""} onClick={() => setTerm(t.key)}>{t.label}</button>)}
            </div>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Teacher: <b>{teacherName}</b> · Passing mark {school.passingMark}% · {scope.all ? "You can grade every class." : "You only see classes you're assigned to."}
        </p>
      </div>

      <div className="stat-grid">
        <StatTile label="Scores entered" value={`${entered.length} / ${list.length}`} icon="list" tone="purple" />
        <StatTile label="Class average" value={avg === null ? "—" : `${avg}% · ${gradeFor(school, avg).grade}`} icon="chart" tone="blue" />
        <StatTile label="Passed" value={nums.length ? `${passed} / ${nums.length}` : "—"} icon="check" tone="green" />
        <StatTile label="Status" value={publishedCount ? (allPublished ? "Published" : "Partly") : saved(list[0]?.id) ? "Draft" : "Not started"} icon="notice" tone="orange" />
      </div>

      <div className="card">
        <div className="card-head">
          <div><h3>Class {current.class} · {current.subject} · {termLabel(term)}</h3><p>Enter whole-number scores from 0 to 100. The letter grade follows the school's grading scale.</p></div>
          {dirty && <span className="badge b-amber">Unsaved changes</span>}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th className="no-sort">Roll</th><th className="no-sort">Student</th><th className="no-sort">Score (%)</th><th className="no-sort">Grade</th><th className="no-sort">Remark</th><th className="no-sort">Status</th></tr></thead>
            <tbody>
              {list.length ? list.map((s) => {
                const v = scores[s.id] ?? "";
                const ok = valid(v);
                const g = v !== "" && ok ? gradeFor(school, Number(v)) : null;
                const rec = saved(s.id);
                return (
                  <tr key={s.id}>
                    <td>{s.roll}</td>
                    <td><div className="who"><Avatar name={s.name} color={s.color} />{s.name}</div></td>
                    <td>
                      <input className={`input score-input ${ok ? "" : "invalid"}`} inputMode="numeric" maxLength={3} value={v} disabled={!canEdit}
                        aria-label={`Score for ${s.name}`} aria-invalid={!ok} onChange={(e) => setScores((m) => ({ ...m, [s.id]: e.target.value.trim() }))} />
                    </td>
                    <td>{g ? <Badge value={g.grade} cls={Number(v) >= school.passingMark ? "b-green" : "b-red"} /> : "—"}</td>
                    <td>{g ? g.remark : ok ? "—" : <span style={{ color: "var(--red)", fontSize: 12 }}>0–100 only</span>}</td>
                    <td>{rec ? <Badge value={rec.published ? "Published" : "Draft"} cls={rec.published ? "b-green" : "b-amber"} /> : <Badge value="Not entered" cls="b-blue" />}</td>
                  </tr>
                );
              }) : <tr><td colSpan="6" className="empty">No students in this class.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
