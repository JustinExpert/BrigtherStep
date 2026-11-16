import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { clock, fmtSecs, gradeAnswers, gradeBadge, LETTERS, pct, totalMarks } from "../lib/exams.js";
import Icon from "../components/Icon.jsx";
import { Badge, PageHead, StatTile } from "../components/ui.jsx";
import { MissingRecord, useMyRecord } from "./StudentDashboard.jsx";

function useExamAndAttempt() {
  const { id } = useParams();
  const me = useMyRecord();
  const { onlineExams, submissions } = useData();
  const exam = onlineExams.find((e) => e.id === id);
  const sub = me && submissions.find((s) => s.examId === id && s.studentId === me.id);
  const allowed = exam && me && exam.class === me.class && exam.status !== "draft";
  return { me, exam, sub, allowed };
}

const Unavailable = ({ text }) => (
  <div className="card empty">{text} <Link className="link" to="/online-exams">Back to online exams</Link></div>
);

/* ---------------- Take an exam ---------------- */
export default function TakeExam() {
  const { me, exam, sub, allowed } = useExamAndAttempt();
  const { add, update } = useData();
  const { confirm, toast } = useUI();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(Date.now());
  const submitted = useRef(false);
  const subRef = useRef(sub);
  subRef.current = sub;

  const inProgress = !!allowed && sub?.status === "in_progress";
  const deadline = inProgress ? sub.startedAt + exam.duration * 60_000 : 0;
  const remaining = deadline - now;

  const submit = useCallback((auto) => {
    const s = subRef.current;
    if (!s || submitted.current || s.status !== "in_progress") return;
    submitted.current = true;
    const score = gradeAnswers(exam, s.answers);
    update("submissions", s.id, {
      status: "submitted", score, total: totalMarks(exam), auto,
      submittedAt: new Date().toISOString(),
      timeTaken: Math.min((Date.now() - s.startedAt) / 1000, exam.duration * 60),
    });
    toast(auto ? "Time's up — your answers were submitted automatically" : "Exam submitted");
    navigate(`/online-exams/${exam.id}/review`, { replace: true });
  }, [exam, update, toast, navigate]);

  // Tick the clock; auto-submit when time runs out (also after a refresh, since the deadline is saved).
  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [inProgress]);
  useEffect(() => { if (inProgress && remaining <= 0) submit(true); }, [inProgress, remaining, submit]);

  // Record when the student leaves the exam tab (shown to the teacher on the results page).
  useEffect(() => {
    if (!inProgress) return;
    const onVis = () => {
      const s = subRef.current;
      if (document.hidden && s?.status === "in_progress") update("submissions", s.id, { tabSwitches: (s.tabSwitches || 0) + 1 });
      if (!document.hidden) toast("You left the exam tab — this is recorded for your teacher");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [inProgress, update, toast]);

  if (!me) return <MissingRecord />;
  if (!allowed) return <Unavailable text="This exam isn't available to you." />;
  if (sub?.status === "submitted") return <Navigate to={`/online-exams/${exam.id}/review`} replace />;

  // ----- Intro screen -----
  if (!sub) {
    if (exam.status === "closed") return <Unavailable text="This exam is closed." />;
    const start = () => confirm("Start the exam?", `You'll have ${exam.duration} minutes and one attempt. The timer keeps running even if you close the page.`, () => {
      add("submissions", {
        examId: exam.id, studentId: me.id, status: "in_progress", startedAt: Date.now(),
        answers: Array(exam.questions.length).fill(null), tabSwitches: 0,
      });
    }, "Start now");
    return (
      <>
        <PageHead title={exam.title} crumbs={[{ label: "Online Exams", to: "/online-exams" }, exam.title]} />
        <div className="card" style={{ maxWidth: 760 }}>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <StatTile label="Questions" value={exam.questions.length} icon="list" tone="purple" />
            <StatTile label="Total marks" value={totalMarks(exam)} icon="exam" tone="orange" />
            <StatTile label="Time limit" value={`${exam.duration} min`} icon="calendar" tone="blue" />
          </div>
          <h3 style={{ margin: "24px 0 10px" }}>Before you begin</h3>
          <ul className="rules">
            <li>You get <b>one attempt</b>. Once you start, the timer can't be paused.</li>
            <li>Your answers are saved as you go. If the page closes, come back and press <b>Continue</b>.</li>
            <li>When time runs out, your answers are <b>submitted automatically</b>.</li>
            <li>Leaving this tab during the exam is <b>recorded</b> and shown to your teacher.</li>
          </ul>
          <button className="btn" onClick={start}>Start exam</button>
        </div>
      </>
    );
  }

  // ----- Exam in progress -----
  const q = exam.questions[current];
  const answered = sub.answers.filter((a) => a !== null).length;
  const choose = (k) => {
    if (remaining <= 0) return;
    const answers = [...sub.answers];
    answers[current] = answers[current] === k ? null : k;
    update("submissions", sub.id, { answers });
  };
  const finish = () => {
    const left = exam.questions.length - answered;
    confirm("Submit exam?", left ? `You haven't answered ${left} question${left > 1 ? "s" : ""}. You can't change answers after submitting.` : "You can't change answers after submitting.", () => submit(false), "Submit");
  };

  return (
    <div className="exam-shell">
      <div className="card exam-main">
        <div className="exam-top">
          <div><h2 style={{ fontSize: 18 }}>{exam.title}</h2><small style={{ color: "var(--muted)" }}>{exam.subject} · Question {current + 1} of {exam.questions.length}</small></div>
          <div className={`timer ${remaining < 60_000 ? "low" : ""}`} role="timer" aria-label="Time remaining">{clock(remaining)}</div>
        </div>
        <div className="progress wide"><i style={{ width: `${(answered / exam.questions.length) * 100}%` }} /></div>

        <h3 className="q-text">{q.text} <span className="badge b-purple">{q.marks} mark{q.marks > 1 ? "s" : ""}</span></h3>
        <div role="radiogroup" aria-label={`Question ${current + 1}`}>
          {q.options.map((o, k) => (
            <button key={k} role="radio" aria-checked={sub.answers[current] === k}
              className={`choice ${sub.answers[current] === k ? "on" : ""}`} onClick={() => choose(k)}>
              <span className="key">{LETTERS[k]}</span>{o}
            </button>
          ))}
        </div>

        <div className="exam-nav">
          <button className="btn light" disabled={current === 0} onClick={() => setCurrent(current - 1)}><Icon name="chevL" />Previous</button>
          {current < exam.questions.length - 1
            ? <button className="btn" onClick={() => setCurrent(current + 1)}>Next<Icon name="chevR" /></button>
            : <button className="btn" onClick={finish}>Submit exam</button>}
        </div>
      </div>

      <aside className="card exam-side">
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Questions</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>{answered} of {exam.questions.length} answered</p>
        <div className="palette">
          {exam.questions.map((_, i) => (
            <button key={i} className={`${sub.answers[i] !== null ? "answered" : ""} ${i === current ? "current" : ""}`}
              onClick={() => setCurrent(i)} aria-label={`Go to question ${i + 1}${sub.answers[i] !== null ? " (answered)" : ""}`}>{i + 1}</button>
          ))}
        </div>
        <button className="btn block" style={{ marginTop: 18 }} onClick={finish}>Submit exam</button>
      </aside>
    </div>
  );
}

/* ---------------- Review answers (shared by student review + teacher modal) ---------------- */
export function AnswerReview({ exam, answers }) {
  return (
    <div className="review-list">
      {exam.questions.map((q, i) => {
        const a = answers[i];
        const right = a === q.answer;
        return (
          <div className="review-item" key={q.id}>
            <div className="q-head">
              <b>{i + 1}. {q.text}</b>
              <Badge value={a === null ? "Not answered" : right ? `+${q.marks}` : "0"} cls={a === null ? "b-amber" : right ? "b-green" : "b-red"} />
            </div>
            {q.options.map((o, k) => (
              <div key={k} className={`choice static ${k === q.answer ? "correct" : ""} ${k === a && !right ? "wrong" : ""}`}>
                <span className="key">{LETTERS[k]}</span>{o}
                {k === q.answer && <small className="tag">Correct answer</small>}
                {k === a && !right && <small className="tag">Your answer</small>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function ExamReview() {
  const { me, exam, sub, allowed } = useExamAndAttempt();
  if (!me) return <MissingRecord />;
  if (!allowed) return <Unavailable text="This exam isn't available to you." />;
  if (sub?.status !== "submitted") return <Navigate to={`/online-exams/${exam.id}/take`} replace />;
  const p = pct(sub.score, sub.total);
  const correct = exam.questions.filter((q, i) => sub.answers[i] === q.answer).length;
  const blank = sub.answers.filter((a) => a === null).length;

  return (
    <>
      <PageHead title="Exam Result" crumbs={[{ label: "Online Exams", to: "/online-exams" }, exam.title]} />
      <div className="card result-hero">
        <div className={`result-score ${gradeBadge(p)}`}><b>{p}%</b><span>{sub.score} / {sub.total} marks</span></div>
        <div>
          <h2 style={{ fontSize: 22 }}>{exam.title}</h2>
          <p style={{ color: "var(--muted)", margin: "6px 0 14px" }}>
            {exam.subject} · submitted {new Date(sub.submittedAt).toLocaleString()} {sub.auto && "(time ran out)"}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge value={`${correct} correct`} cls="b-green" />
            <Badge value={`${exam.questions.length - correct - blank} wrong`} cls="b-red" />
            {blank > 0 && <Badge value={`${blank} unanswered`} cls="b-amber" />}
            <Badge value={`Time: ${fmtSecs(sub.timeTaken)}`} cls="b-blue" />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3>Your answers</h3></div>
        {exam.showAnswers
          ? <AnswerReview exam={exam} answers={sub.answers} />
          : <p className="empty">Your teacher will share the correct answers later.</p>}
      </div>
    </>
  );
}
