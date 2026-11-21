import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { SUBJECTS } from "../constants.js";
import { useSections } from "../lib/sections.js";
import { useLevel } from "../lib/level.jsx";
import { PageHead, StatTile } from "../components/ui.jsx";
import Select from "../components/Select.jsx";

const NONE = "";

export default function Assignments() {
  const { user } = useAuth();
  const { assignments, teachers, students, upsertMany, remove, routine } = useData();
  const { toast } = useUI();
  const canEdit = usePermission()("assignments", "edit");
  const sections = useSections();
  const { level } = useLevel();
  const CLASSES = sections.ofLevel(level).map((c) => c.id); // this level's sections, in school order
  const label = sections.label;
  const find = (cls, subject) => assignments.find((a) => a.class === cls && a.subject === subject);
  const name = (id) => teachers.find((t) => t.id === id)?.name || "—";
  // Subjects each section takes (from its timetable); a section without a timetable yet can take any subject.
  const takes = (cls, subject) => !routine[cls] || routine[cls].flat().some((s) => s.subject === subject);

  const assign = (cls, subject, teacherId) => {
    const current = find(cls, subject);
    if (!teacherId) {
      if (current) remove("assignments", current.id);
      toast(`${label(cls)} · ${subject}: unassigned`);
      return;
    }
    upsertMany("assignments", [{ id: current?.id || `ASG-${cls}-${subject.replace(/\W+/g, "")}`, class: cls, subject, teacherId }]);
    toast(`${label(cls)} · ${subject} → ${name(teacherId)}`);
  };

  const unassigned = CLASSES.flatMap((c) => SUBJECTS.filter((s) => takes(c, s) && !find(c, s)).map((s) => `${c} ${s}`));
  const load = teachers.map((t) => ({ t, n: assignments.filter((a) => a.teacherId === t.id).length })).filter((x) => x.n);

  if (!CLASSES.length) {
    return (
      <>
        <PageHead title="Teaching Assignments" crumbs={["Teachers", "Teaching Assignments"]} />
        <div className="card empty">No sections for this level in this school year yet. Create them on the Sections page first.</div>
      </>
    );
  }
  return (
    <>
      <PageHead title="Teaching Assignments" crumbs={["Teachers", "Teaching Assignments"]}>
        {!canEdit && <span className="badge b-blue">View only</span>}
      </PageHead>
      <div className="stat-grid">
        <StatTile label="Assignments" value={assignments.filter((a) => CLASSES.includes(a.class)).length} icon="list" tone="purple" />
        <StatTile label="Teachers assigned" value={load.length} icon="teachers" tone="blue" />
        <StatTile label="Unassigned subjects" value={unassigned.length} icon="bell" tone="orange" />
        <StatTile label="Students" value={students.filter((st) => CLASSES.includes(st.class)).length} icon="cap" tone="green" />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Who teaches what</h3>
            <p>Each section takes the subjects on its timetable. A teacher sees only the students and grades of the sections they're assigned here.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="assign-table">
            <thead>
              <tr><th className="no-sort">Subject</th>{CLASSES.map((c) => <th key={c} className="no-sort">{label(c)}</th>)}</tr>
            </thead>
            <tbody>
              {SUBJECTS.map((subject) => (
                <tr key={subject}>
                  <td><b>{subject}</b></td>
                  {CLASSES.map((cls) => {
                    if (!takes(cls, subject)) return <td key={cls} className="na">—</td>;
                    const a = find(cls, subject);
                    const mine = a && a.teacherId === user.teacherId;
                    return (
                      <td key={cls} className={mine ? "mine" : ""}>
                        {canEdit ? (
                          <Select className={a ? "" : "missing"} value={a?.teacherId || NONE} aria-label={`Teacher for ${label(cls)} ${subject}`} searchable
                            onChange={(v) => assign(cls, subject, v)}
                            options={[
                              { value: NONE, label: "— Unassigned —" },
                              ...teachers.filter((t) => t.subject === subject).map((t) => ({ value: t.id, label: t.name, group: `${subject} teachers` })),
                              ...teachers.filter((t) => t.subject !== subject).map((t) => ({ value: t.id, label: t.name, hint: t.subject, group: "Other teachers" })),
                            ]} />
                        ) : <span>{a ? name(a.teacherId) : <span className="badge b-amber">Unassigned</span>}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Teaching load</h3></div>
        <div className="feed">
          {load.sort((a, b) => b.n - a.n).map(({ t, n }) => (
            <div className="feed-item" key={t.id}>
              <div><h5>{t.name}</h5><p>{assignments.filter((a) => a.teacherId === t.id).map((a) => `${a.subject} · ${label(a.class)}`).join(", ")}</p></div>
              <time>{n} section{n > 1 ? "s" : ""}</time>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
