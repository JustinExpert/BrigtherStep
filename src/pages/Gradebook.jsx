import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { termLabel, useScope } from "../lib/scope.js";
import { COMPONENTS, computeGrade, reportGrade, transmute, validScore, weightsFor } from "../lib/gradeCalc.js";
import { TERMS, gradeId } from "../constants.js";
import { todayIso } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import { Avatar, Badge, PageHead, StatTile } from "../components/ui.jsx";
import { gradeFor } from "./SchoolSetup.jsx";

const ORDER = Object.fromEntries(COMPONENTS.map((c, i) => [c.key, i]));
const fmt = (n) => (n === null || n === undefined ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Add / edit an activity (title, component, max score, date). */
function ActivityForm({ initial, onSave, onCancel, minMax = 1 }) {
  const [f, setF] = useState(() => ({ title: "", component: "WW", maxScore: 20, date: todayIso(), ...initial }));
  const [error, setError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const max = Number(f.maxScore);
    if (!f.title.trim()) return setError("Give the activity a title.");
    if (!(Number.isInteger(max) && max >= 1 && max <= 1000)) return setError("Highest possible score must be a whole number from 1 to 1000.");
    if (max < minMax) return setError(`Some students already scored up to ${minMax}, so the highest possible score can't be lower than that.`);
    onSave({ title: f.title.trim(), component: f.component, maxScore: max, date: f.date });
  };
  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="form-grid">
        <label style={{ gridColumn: "1 / -1" }}>Title *<input className="input" required maxLength={60} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Quiz 3, Science Project" /></label>
        <label>Component
          <select className="select" value={f.component} onChange={(e) => setF({ ...f, component: e.target.value })}>
            {COMPONENTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label>Highest possible score *<input className="input" type="number" min="1" max="1000" required value={f.maxScore} onChange={(e) => setF({ ...f, maxScore: e.target.value })} /></label>
        <label>Date<input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      </div>
      <p className="hint">{COMPONENTS.find((c) => c.key === f.component)?.hint}</p>
      <div className="form-actions">
        <button type="button" className="btn light" onClick={onCancel}>Cancel</button>
        <button className="btn">{initial ? "Save activity" : "Add activity"}</button>
      </div>
    </form>
  );
}

export default function Gradebook() {
  const { user } = useAuth();
  const { students, grades, activities, school, teachers, upsertMany, add, update, remove } = useData();
  const { toast, confirm, openModal, closeModal } = useUI();
  const canEdit = usePermission()("grades", "edit");
  const scope = useScope();
  // Teachers pick from their own assignments; admins from all.
  const options = useMemo(() => [...scope.assignments].sort((a, b) => a.class.localeCompare(b.class) || a.subject.localeCompare(b.subject)), [scope.assignments]);
  const [pick, setPick] = useState(() => options[0]?.id || "");
  const [term, setTerm] = useState("Q2");
  const [edits, setEdits] = useState({}); // { activityId: { studentId: "typed value" } }
  const current = options.find((a) => a.id === pick) || options[0];
  const key = current ? `${current.id}|${term}` : "";
  useEffect(() => setEdits({}), [key]);

  if (!current) {
    return (
      <>
        <PageHead title="Gradebook" crumbs={["Grades", "Gradebook"]} />
        <div className="card empty">You don't have any classes assigned yet. Ask the school admin to set your teaching assignments.</div>
      </>
    );
  }

  const list = students.filter((s) => s.class === current.class).sort((a, b) => a.roll.localeCompare(b.roll) || a.name.localeCompare(b.name));
  const acts = activities
    .filter((a) => a.class === current.class && a.subject === current.subject && a.term === term)
    .sort((a, b) => ORDER[a.component] - ORDER[b.component] || a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const weights = weightsFor(school, current.subject);
  const typed = (act, sid) => edits[act.id]?.[sid] ?? (act.scores?.[sid] ?? "").toString();
  const isValid = (act, sid) => validScore(typed(act, sid), act.maxScore);
  // Activities with the teacher's unsaved typing applied (invalid entries count as not entered).
  const live = acts.map((act) => ({
    ...act,
    scores: Object.fromEntries(list.map((s) => [s.id, isValid(act, s.id) && typed(act, s.id) !== "" ? Number(typed(act, s.id)) : undefined])),
  }));
  const computed = Object.fromEntries(list.map((s) => [s.id, computeGrade(live, s.id, weights)]));
  const savedComputed = Object.fromEntries(list.map((s) => [s.id, computeGrade(acts, s.id, weights)]));
  // Only the open school year's grades are loaded; every new grade and activity is tagged with it.
  const year = school.academicYear.key;
  const rec = (sid) => grades.find((g) => g.id === gradeId(year, sid, current.subject, term));

  const invalidCount = acts.reduce((n, act) => n + list.filter((s) => !isValid(act, s.id)).length, 0);
  const dirty = acts.some((act) => list.some((s) => typed(act, s.id) !== (act.scores?.[s.id] ?? "").toString()));
  // The grade students get: transmuted when the school uses the DepEd table, else the weighted %.
  const shown = (g) => (g === null ? null : school.transmutation ? transmute(g) : g);
  const graded = list.filter((s) => computed[s.id].grade !== null);
  const avg = graded.length ? graded.reduce((a, s) => a + shown(computed[s.id].grade), 0) / graded.length : null;
  const passed = graded.filter((s) => shown(computed[s.id].grade) >= school.passingMark).length;
  const isPublished = list.some((s) => rec(s.id)?.published);
  const upToDate = list.every((s) => !rec(s.id)?.published || rec(s.id).score === reportGrade(savedComputed[s.id].grade, school));
  const status = !isPublished ? "Not published" : upToDate && !dirty ? "Published" : "Changes not published";
  const teacherName = teachers.find((t) => t.id === current.teacherId)?.name || "—";

  const setTyped = (actId, sid, v) => setEdits((e) => ({ ...e, [actId]: { ...e[actId], [sid]: v.trim() } }));
  /** Activities with valid typed scores merged in, ready to store. */
  const merged = () => acts.filter((act) => edits[act.id]).map((act) => {
    const scores = { ...act.scores };
    for (const [sid, v] of Object.entries(edits[act.id])) v === "" ? delete scores[sid] : (scores[sid] = Number(v));
    return { ...act, scores };
  });

  const saveScores = () => {
    if (invalidCount) return toast(`Fix ${invalidCount} invalid score${invalidCount > 1 ? "s" : ""} first (0 up to the highest possible score)`);
    upsertMany("activities", merged());
    setEdits({});
    toast(isPublished ? "Scores saved — publish again to update report cards" : "Scores saved");
  };

  const publish = () => {
    if (invalidCount) return toast(`Fix ${invalidCount} invalid score${invalidCount > 1 ? "s" : ""} first`);
    if (!graded.length) return toast("Enter some scores before publishing");
    const apply = () => {
      upsertMany("activities", merged());
      setEdits({});
      upsertMany("grades", graded.map((s) => ({
        id: gradeId(year, s.id, current.subject, term), year, studentId: s.id, class: current.class, subject: current.subject, term,
        score: reportGrade(computed[s.id].grade, school), published: true, updatedBy: user.teacherId || user.id, updatedAt: todayIso(),
      })));
      const n = `${graded.length} grade${graded.length === 1 ? "" : "s"}`;
      toast(`Published ${n} — students and parents can see them now`);
    };
    const missing = list.length - graded.length;
    if (missing) confirm("Publish with missing grades?", `${missing} student(s) have no scores yet, so they won't get a grade for this quarter.`, apply, "Publish");
    else apply();
  };

  const unpublish = () => confirm("Unpublish grades?", "Students and parents will no longer see these grades until you publish again.", () => {
    upsertMany("grades", list.filter((s) => rec(s.id)).map((s) => ({ ...rec(s.id), published: false })));
    toast("Grades moved back to draft");
  }, "Unpublish");

  const addActivity = () => openModal("Add Activity", (
    <ActivityForm onCancel={closeModal} onSave={(v) => {
      add("activities", { ...v, class: current.class, subject: current.subject, term, year, scores: {}, createdBy: user.teacherId || user.id });
      closeModal();
      toast(`${v.title} added`);
    }} />
  ));
  const editActivity = (act) => {
    const highest = Math.max(0, ...Object.values(act.scores || {}).map(Number));
    openModal("Edit Activity", (
      <>
        <ActivityForm initial={act} minMax={highest} onCancel={closeModal} onSave={(v) => { update("activities", act.id, v); closeModal(); toast("Activity updated"); }} />
        <hr className="sep" />
        <button className="btn light danger-text" onClick={() => confirm("Delete activity?", `"${act.title}" and all its scores will be removed. Grades will be recalculated.`, () => {
          remove("activities", act.id);
          toast("Activity deleted");
        })}><Icon name="trash" />Delete this activity</button>
      </>
    ));
  };

  const groups = COMPONENTS.map((c) => ({ ...c, acts: acts.filter((a) => a.component === c.key), weight: Number(weights[c.key]) || 0 }));

  // Most recent earlier quarter that has activities for this class + subject (to copy its setup).
  const prev = TERMS.slice(0, TERMS.findIndex((t) => t.key === term)).reverse()
    .map((t) => ({ term: t.key, acts: activities.filter((a) => a.class === current.class && a.subject === current.subject && a.term === t.key) }))
    .find((x) => x.acts.length);
  const copyFromPrev = () => {
    const stamp = Date.now().toString(36).toUpperCase();
    upsertMany("activities", [...prev.acts]
      .sort((a, b) => ORDER[a.component] - ORDER[b.component] || a.date.localeCompare(b.date))
      .map((a, i) => ({
        id: `ACT-${stamp}-${i + 1}`, class: current.class, subject: current.subject, term, year,
        component: a.component, title: a.title, maxScore: a.maxScore, date: todayIso(), scores: {}, createdBy: user.teacherId || user.id,
      })));
    toast(`Copied ${prev.acts.length} activities from ${termLabel(prev.term)} — now enter the scores`);
  };

  return (
    <>
      <PageHead title="Gradebook" crumbs={["Grades", `Gradebook · School year ${school.academicYear.label}`]}>
        {canEdit && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {isPublished && !dirty && <button className="btn light" onClick={unpublish}>Unpublish</button>}
            <button className="btn light" onClick={saveScores} disabled={!dirty}>Save scores</button>
            <button className="btn" onClick={publish} disabled={status === "Published" || !acts.length} title={acts.length ? undefined : "Add activities and scores first"}>{status === "Published" ? "Published ✓" : "Publish grades"}</button>
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
        <div className="formula">
          <b>Quarterly grade</b> =
          {groups.map((g, i) => <span key={g.key}>{i > 0 && " + "}<span className={`chip-${g.key}`}>{g.label} × {g.weight}%</span></span>)}
          {school.transmutation && <span>→ <span className="chip-QA">DepEd transmutation table</span></span>}
        </div>
        <p className="hint">
          Teacher: <b>{teacherName}</b> · Passing mark {school.passingMark}% · Component % = points earned ÷ points possible.
          A blank score means "not entered yet" and is skipped; type 0 for missing work. {scope.all ? "" : "You only see classes you're assigned to."}
        </p>
      </div>

      <div className="stat-grid">
        <StatTile label="Activities" value={acts.length} icon="list" tone="purple" />
        <StatTile label="Class average" value={avg === null ? "—" : `${fmt(Math.round(avg * 10) / 10)} · ${gradeFor(school, avg).grade}`} icon="chart" tone="blue" />
        <StatTile label="Passed" value={graded.length ? `${passed} / ${graded.length}` : "—"} icon="check" tone="green" />
        <StatTile label="Report cards" value={status} icon="notice" tone="orange" />
      </div>

      <div className="card">
        <div className="card-head">
          <div><h3>Class {current.class} · {current.subject} · {termLabel(term)}</h3><p>{list.length} students · {acts.length} activities</p></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {dirty && <span className="badge b-amber">Unsaved changes</span>}
            {canEdit && <button className="btn sm" onClick={addActivity}><Icon name="plus" />Add activity</button>}
          </div>
        </div>
        {!acts.length ? (
          <div className="gb-empty">
            <span className="feed-icon tone-purple"><Icon name="list" /></span>
            <h3>No activities for {termLabel(term)} yet</h3>
            <p>
              Grades are computed from activities, so start by adding the quizzes, projects and exam for this quarter.
              Then type each student's score and click <b>Publish grades</b>.
            </p>
            {canEdit ? (
              <div className="gb-empty-actions">
                {prev && (
                  <button className="btn" onClick={copyFromPrev}>
                    <Icon name="refresh" />Copy {prev.acts.length} activities from {termLabel(prev.term)}
                  </button>
                )}
                <button className={`btn ${prev ? "light" : ""}`} onClick={addActivity}><Icon name="plus" />Add activity</button>
              </div>
            ) : <p className="hint">Only teachers and admins can add activities.</p>}
            {prev && canEdit && (
              <small className="hint">Copies {prev.acts.map((a) => a.title).join(", ")} with empty scores. You can rename, edit or delete them afterwards.</small>
            )}
          </div>
        ) : (
        <div className="table-wrap">
          <table className="gb-table">
            <thead>
              <tr>
                <th className="no-sort stu" rowSpan={2}>Student</th>
                {groups.map((g) => (
                  <th key={g.key} className={`no-sort grp grp-${g.key}`} colSpan={g.acts.length + 1}>{g.label} · {g.weight}%</th>
                ))}
                <th className="no-sort" rowSpan={2}>Grade{school.transmutation && <small className="th-sub">transmuted</small>}</th>
                <th className="no-sort" rowSpan={2}>Report<small className="th-sub">card</small></th>
              </tr>
              <tr>
                {groups.map((g) => [
                  ...g.acts.map((a) => (
                    <th key={a.id} className={`no-sort act grp-${g.key}`}>
                      {canEdit ? <button type="button" className="act-btn" onClick={() => editActivity(a)} title="Edit activity">{a.title}<small>/{a.maxScore}</small></button>
                        : <span className="act-btn">{a.title}<small>/{a.maxScore}</small></span>}
                    </th>
                  )),
                  <th key={g.key + "-pct"} className={`no-sort pct grp-${g.key}`}>{g.short} %</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {list.length ? list.map((s) => {
                const c = computed[s.id];
                const value = shown(c.grade);
                const g = value === null ? null : gradeFor(school, value);
                const r = rec(s.id);
                const final = reportGrade(c.grade, school);
                return (
                  <tr key={s.id}>
                    <td className="stu"><div className="who"><Avatar name={s.name} color={s.color} /><div>{s.name}<small>Roll {s.roll}</small></div></div></td>
                    {groups.map((grp) => [
                      ...grp.acts.map((a) => {
                        const v = typed(a, s.id);
                        const ok = isValid(a, s.id);
                        return (
                          <td key={a.id}>
                            <input className={`input score-input ${ok ? "" : "invalid"}`} inputMode="decimal" maxLength={6} value={v} disabled={!canEdit}
                              aria-label={`${a.title} score for ${s.name}`} aria-invalid={!ok} onChange={(e) => setTyped(a.id, s.id, e.target.value)} />
                          </td>
                        );
                      }),
                      <td key={grp.key + "-pct"} className="pct">{fmt(c.components[grp.key])}</td>,
                    ])}
                    <td className="final">{c.grade === null ? "—" : <><b>{fmt(value)}</b> <Badge value={g.grade} cls={value >= school.passingMark ? "b-green" : "b-red"} />{school.transmutation && <small className="initial">initial {fmt(c.grade)}</small>}</>}</td>
                    <td>
                      {r?.published
                        ? (r.score === final ? <Badge value={`${r.score} ✓`} cls="b-green" /> : <Badge value={`${r.score} → ${final ?? "—"}`} cls="b-amber" />)
                        : <Badge value={r ? "Draft" : "Not published"} cls="b-blue" />}
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={99} className="empty">No students in this class.</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </>
  );
}
