import { Link, useParams } from "react-router-dom";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { fmtSecs, gradeBadge, pct, STATUS_BADGE, totalMarks } from "../lib/exams.js";
import DataTable from "../components/DataTable.jsx";
import { Avatar, Badge, PageHead, StatTile } from "../components/ui.jsx";
import { AnswerReview } from "./TakeExam.jsx";

export default function ExamResults() {
  const { id } = useParams();
  const { onlineExams, submissions, students, remove } = useData();
  const { openModal, confirm, toast } = useUI();
  const exam = onlineExams.find((e) => e.id === id);
  if (!exam) return <div className="card empty">Exam not found. <Link className="link" to="/online-exams">Back</Link></div>;

  const subs = submissions.filter((s) => s.examId === id);
  const done = subs.filter((s) => s.status === "submitted");
  const scores = done.map((s) => pct(s.score, s.total));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const total = totalMarks(exam);

  const rows = students.filter((s) => s.class === exam.class).map((s) => {
    const sub = subs.find((x) => x.studentId === s.id);
    const state = sub ? (sub.status === "submitted" ? "Submitted" : "In progress") : "Not attempted";
    return {
      id: s.id, name: s.name, color: s.color, roll: s.roll, state, sub,
      percent: sub?.status === "submitted" ? pct(sub.score, sub.total) : -1,
      timeTaken: sub?.timeTaken ?? -1, tabSwitches: sub?.tabSwitches ?? 0,
    };
  });

  const view = (r) => openModal(`${r.name} · ${r.sub.score}/${r.sub.total}`, <AnswerReview exam={exam} answers={r.sub.answers} />);
  const reset = (r) => confirm("Allow a new attempt?", `${r.name}'s ${r.state === "Submitted" ? "submission" : "attempt in progress"} will be deleted so they can take the exam again.`, () => {
    remove("submissions", r.sub.id);
    toast("Attempt reset");
  }, "Reset attempt");

  return (
    <>
      <PageHead title="Exam Results" crumbs={[{ label: "Online Exams", to: "/online-exams" }, exam.title]}>
        <Badge value={exam.status} cls={STATUS_BADGE[exam.status]} />
      </PageHead>
      <div className="card">
        <h2 style={{ fontSize: 20 }}>{exam.title}</h2>
        <p style={{ color: "var(--muted)", margin: "6px 0 20px" }}>{exam.subject} · Class {exam.class} · {exam.questions.length} questions · {total} marks · {exam.duration} min</p>
        <div className="stat-grid">
          <StatTile label="Submitted" value={`${done.length} / ${rows.length}`} icon="check" tone="purple" />
          <StatTile label="Average" value={done.length ? avg + "%" : "—"} icon="chart" tone="blue" />
          <StatTile label="Highest" value={done.length ? Math.max(...scores) + "%" : "—"} icon="event" tone="green" />
          <StatTile label="Lowest" value={done.length ? Math.min(...scores) + "%" : "—"} icon="exam" tone="orange" />
        </div>
      </div>

      <DataTable
        title="Student Results"
        rows={rows}
        searchPlaceholder="Search by student name"
        filter={{ key: "state", label: "All students", options: ["Submitted", "In progress", "Not attempted"] }}
        cols={[
          { key: "name", label: "Student", render: (r) => <div className="who"><Avatar name={r.name} color={r.color} /><div>{r.name}<small>Roll {r.roll}</small></div></div> },
          { key: "state", label: "Status", render: (r) => <Badge value={r.state} cls={{ Submitted: "b-green", "In progress": "b-amber", "Not attempted": "b-red" }[r.state]} /> },
          { key: "percent", label: "Score", render: (r) => (r.percent >= 0 ? <Badge value={`${r.sub.score}/${r.sub.total} · ${r.percent}%`} cls={gradeBadge(r.percent)} /> : "—") },
          { key: "timeTaken", label: "Time", render: (r) => (r.timeTaken >= 0 && r.state === "Submitted" ? fmtSecs(r.timeTaken) : "—") },
          { key: "tabSwitches", label: "Left tab", render: (r) => (r.sub ? (r.tabSwitches ? <Badge value={`${r.tabSwitches}×`} cls="b-red" /> : <Badge value="No" cls="b-green" />) : "—") },
          { key: "act", label: "Action", sortable: false, render: (r) => r.sub && (
            <div className="row-actions">
              {r.state === "Submitted" && <button className="btn sm light" onClick={() => view(r)}>Answers</button>}
              <button className="btn sm light" onClick={() => reset(r)}>Reset</button>
            </div>
          ) },
        ]}
      />

      <div className="card">
        <div className="card-head"><div><h3>Question analysis</h3><p>Share of submitted students who answered each question correctly</p></div></div>
        {done.length ? (
          <div className="feed">
            {exam.questions.map((q, i) => {
              const right = done.filter((s) => s.answers[i] === q.answer).length;
              const p = pct(right, done.length);
              return (
                <div className="feed-item" key={q.id}>
                  <div style={{ minWidth: 0, flex: 1 }}><h5>{i + 1}. {q.text}</h5><p>{right} of {done.length} correct</p></div>
                  <div className="who" style={{ marginLeft: "auto" }}>
                    <div className="progress" style={{ width: 140 }}><i style={{ width: `${p}%`, background: p >= 75 ? "var(--green)" : p >= 50 ? "var(--amber)" : "var(--red)" }} /></div>
                    <b style={{ width: 42, textAlign: "right" }}>{p}%</b>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="empty">No submissions yet.</p>}
      </div>
    </>
  );
}
