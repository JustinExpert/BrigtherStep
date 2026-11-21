import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { CLASSES, SUBJECTS } from "../constants.js";
import { PageHead, StatTile } from "../components/ui.jsx";

const NONE = "";

export default function Assignments() {
  const { user } = useAuth();
  const { assignments, teachers, students, upsertMany, remove, routine } = useData();
  const { toast } = useUI();
  const canEdit = usePermission()("assignments", "edit");
  const find = (cls, subject) => assignments.find((a) => a.class === cls && a.subject === subject);
  const name = (id) => teachers.find((t) => t.id === id)?.name || "—";
  // Subjects each class actually takes (from its timetable).
  const takes = (cls, subject) => routine[cls].flat().some((s) => s.subject === subject);

  const assign = (cls, subject, teacherId) => {
    const current = find(cls, subject);
    if (!teacherId) {
      if (current) remove("assignments", current.id);
      toast(`Class ${cls} · ${subject}: unassigned`);
      return;
    }
    upsertMany("assignments", [{ id: current?.id || `ASG-${cls}-${subject.replace(/\W+/g, "")}`, class: cls, subject, teacherId }]);
    toast(`Class ${cls} · ${subject} → ${name(teacherId)}`);
  };

  const unassigned = CLASSES.flatMap((c) => SUBJECTS.filter((s) => takes(c, s) && !find(c, s)).map((s) => `${c} ${s}`));
  const load = teachers.map((t) => ({ t, n: assignments.filter((a) => a.teacherId === t.id).length })).filter((x) => x.n);

  return (
    <>
      <PageHead title="Teaching Assignments" crumbs={["Teachers", "Teaching Assignments"]}>
        {!canEdit && <span className="badge b-blue">View only</span>}
      </PageHead>
      <div className="stat-grid">
        <StatTile label="Assignments" value={assignments.length} icon="list" tone="purple" />
        <StatTile label="Teachers assigned" value={load.length} icon="teachers" tone="blue" />
        <StatTile label="Unassigned subjects" value={unassigned.length} icon="bell" tone="orange" />
        <StatTile label="Students" value={students.length} icon="cap" tone="green" />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Who teaches what</h3>
            <p>Each class takes the subjects on its timetable. A teacher sees only the students and grades of the classes they're assigned here.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="assign-table">
            <thead>
              <tr><th className="no-sort">Subject</th>{CLASSES.map((c) => <th key={c} className="no-sort">Class {c}</th>)}</tr>
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
                          <select className={`select ${a ? "" : "missing"}`} value={a?.teacherId || NONE} aria-label={`Teacher for Class ${cls} ${subject}`}
                            onChange={(e) => assign(cls, subject, e.target.value)}>
                            <option value={NONE}>— Unassigned —</option>
                            <optgroup label={`${subject} teachers`}>
                              {teachers.filter((t) => t.subject === subject).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </optgroup>
                            <optgroup label="Other teachers">
                              {teachers.filter((t) => t.subject !== subject).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>)}
                            </optgroup>
                          </select>
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
              <div><h5>{t.name}</h5><p>{assignments.filter((a) => a.teacherId === t.id).map((a) => `${a.subject} · Class ${a.class}`).join(", ")}</p></div>
              <time>{n} class{n > 1 ? "es" : ""}</time>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
