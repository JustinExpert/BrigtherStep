import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { CLASSES, SUBJECTS } from "../data.js";
import { gradeBadge, pct, STATUS_BADGE, totalMarks } from "../lib/exams.js";
import { relTime } from "../lib/utils.js";
import DataTable from "../components/DataTable.jsx";
import Icon from "../components/Icon.jsx";
import { Badge, PageHead } from "../components/ui.jsx";
import { MissingRecord, useMyRecord } from "./StudentDashboard.jsx";

export default function OnlineExams() {
  const { user } = useAuth();
  const can = usePermission();
  if (can("onlineExams", "edit")) return <StaffExamList />;
  if (user.role === "student") return <StudentExamList />;
  return <div className="card empty">Online exams are taken by students and managed by teachers.</div>;
}

/* ---------------- Staff: manage exams ---------------- */
function StaffExamList() {
  const { onlineExams, submissions, students, update, remove } = useData();
  const { confirm, toast } = useUI();
  const navigate = useNavigate();
  const doneCount = (id) => submissions.filter((s) => s.examId === id && s.status === "submitted").length;
  const classSize = (c) => students.filter((s) => s.class === c).length;

  const setStatus = (e, status) => {
    if (status === "published" && !e.questions.length) return toast("Add at least one question first");
    update("onlineExams", e.id, { status });
    toast({ published: "Exam published — students can take it now", closed: "Exam closed", draft: "Moved back to draft" }[status]);
  };
  const del = (e) => confirm("Delete exam?", `"${e.title}" and all ${doneCount(e.id)} submissions will be removed permanently.`, () => {
    remove("submissions", submissions.filter((s) => s.examId === e.id).map((s) => s.id));
    remove("onlineExams", e.id);
    toast("Exam deleted");
  });

  return (
    <>
      <PageHead title="Online Exams" crumbs={["Exam", "Online Exams"]}>
        <button className="btn" onClick={() => navigate("/online-exams/new")}><Icon name="plus" />Create Exam</button>
      </PageHead>
      <DataTable
        title="All Online Exams"
        rows={onlineExams.map((e) => ({ ...e, count: e.questions.length, done: doneCount(e.id) }))}
        searchPlaceholder="Search by title or subject"
        filter={{ key: "status", label: "All statuses", options: ["draft", "published", "closed"] }}
        cols={[
          { key: "title", label: "Exam", render: (r) => <div><b>{r.title}</b><small style={{ display: "block", color: "var(--muted)" }}>{r.subject} · by {r.createdBy}</small></div> },
          { key: "class", label: "Class" },
          { key: "count", label: "Questions", render: (r) => `${r.count} · ${totalMarks(r)} marks` },
          { key: "duration", label: "Time", render: (r) => `${r.duration} min` },
          { key: "status", label: "Status", render: (r) => <Badge value={r.status} cls={STATUS_BADGE[r.status]} /> },
          { key: "done", label: "Submitted", render: (r) => `${r.done} / ${classSize(r.class)}` },
          { key: "act", label: "Action", sortable: false, render: (r) => (
            <div className="row-actions">
              <button className="icon-btn" title="Results" onClick={() => navigate(`/online-exams/${r.id}/results`)}><Icon name="chart" /></button>
              <button className="icon-btn" title={r.done ? "Can't edit after students submit" : "Edit"} disabled={!!r.done} style={r.done ? { opacity: 0.35 } : undefined}
                onClick={() => navigate(`/online-exams/${r.id}/edit`)}><Icon name="edit" /></button>
              <button className="icon-btn danger" title="Delete" onClick={() => del(r)}><Icon name="trash" /></button>
              {r.status === "published"
                ? <button className="btn sm light" onClick={() => setStatus(r, "closed")}>Close</button>
                : <button className="btn sm" onClick={() => setStatus(r, "published")}>{r.status === "closed" ? "Reopen" : "Publish"}</button>}
            </div>
          ) },
        ]}
      />
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
        Classes: {CLASSES.join(", ")} · Subjects: {SUBJECTS.length}. Only <b>published</b> exams are visible to students; closing an exam stops new attempts.
      </p>
    </>
  );
}

/* ---------------- Student: my exams ---------------- */
function StudentExamList() {
  const me = useMyRecord();
  const { onlineExams, submissions } = useData();
  if (!me) return <MissingRecord />;
  const mine = onlineExams.filter((e) => e.class === me.class && e.status !== "draft");

  return (
    <>
      <PageHead title="Online Exams" crumbs={["Exam", "Online Exams"]} />
      <div className="notice-grid">
        {mine.map((e) => {
          const sub = submissions.find((s) => s.examId === e.id && s.studentId === me.id);
          const done = sub?.status === "submitted";
          const p = done ? pct(sub.score, sub.total) : 0;
          return (
            <article className="card notice-card" key={e.id}>
              <div className="who">
                <span className={`feed-icon ${done ? "tone-green" : "tone-purple"}`}><Icon name={done ? "check" : "exam"} /></span>
                <div><h3 style={{ fontSize: 16 }}>{e.title}</h3><small>{e.subject}</small></div>
              </div>
              <p>{e.questions.length} questions · {totalMarks(e)} marks · {e.duration} minutes</p>
              <footer>
                {done ? (
                  <>
                    <span><Badge value={`${sub.score}/${sub.total} · ${p}%`} cls={gradeBadge(p)} /> {relTime(sub.submittedAt.slice(0, 10))}</span>
                    <Link className="btn sm light" to={`/online-exams/${e.id}/review`}>View result</Link>
                  </>
                ) : sub ? (
                  <><Badge value="In progress" cls="b-amber" /><Link className="btn sm" to={`/online-exams/${e.id}/take`}>Continue</Link></>
                ) : e.status === "closed" ? (
                  <><Badge value="Closed" cls="b-red" /><span>Not attempted</span></>
                ) : (
                  <><Badge value="Open" cls="b-green" /><Link className="btn sm" to={`/online-exams/${e.id}/take`}>Start exam</Link></>
                )}
              </footer>
            </article>
          );
        })}
        {!mine.length && <div className="card empty">No online exams for Class {me.class} yet.</div>}
      </div>
    </>
  );
}
