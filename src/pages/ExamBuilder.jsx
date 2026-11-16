import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { CLASSES, SUBJECTS } from "../data.js";
import { LETTERS, totalMarks } from "../lib/exams.js";
import { todayIso } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import { PageHead } from "../components/ui.jsx";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const rid = () => "Q" + Math.random().toString(36).slice(2, 9);
const blankQuestion = () => ({ id: rid(), text: "", options: ["", "", "", ""], answer: 0, marks: 1 });

function validate(exam) {
  const errs = [];
  if (!exam.title.trim()) errs.push("Give the exam a title.");
  if (!(exam.duration >= 1 && exam.duration <= 300)) errs.push("Time limit must be between 1 and 300 minutes.");
  if (!exam.questions.length) errs.push("Add at least one question.");
  exam.questions.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    if (!q.text.trim()) errs.push(`${n}: write the question.`);
    if (q.options.some((o) => !o.trim())) errs.push(`${n}: fill in every answer option (or remove empty ones).`);
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) errs.push(`${n}: answer options must be different.`);
    if (!(q.marks >= 1)) errs.push(`${n}: marks must be at least 1.`);
  });
  return errs;
}

export default function ExamBuilder() {
  const { id } = useParams();
  const { user } = useAuth();
  const { onlineExams, submissions, add, update } = useData();
  const { toast } = useUI();
  const navigate = useNavigate();
  const existing = id ? onlineExams.find((e) => e.id === id) : null;
  const [exam, setExam] = useState(() => existing
    ? structuredClone(existing)
    : { title: "", subject: SUBJECTS[0], class: CLASSES[0], duration: 15, showAnswers: true, questions: [blankQuestion()] });
  const [errors, setErrors] = useState([]);

  if (id && !existing) return <div className="card empty">Exam not found. <Link className="link" to="/online-exams">Back</Link></div>;
  if (existing && submissions.some((s) => s.examId === id)) {
    return (
      <div className="card empty">
        Students have already started or submitted this exam, so its questions can't be changed (that would make results unfair).{" "}
        <Link className="link" to={`/online-exams/${id}/results`}>View results</Link>
      </div>
    );
  }

  const set = (patch) => setExam((e) => ({ ...e, ...patch }));
  const setQ = (i, patch) => setExam((e) => ({ ...e, questions: e.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  const setOpt = (i, k, val) => setQ(i, { options: exam.questions[i].options.map((o, j) => (j === k ? val : o)) });
  const removeOpt = (i, k) => {
    const q = exam.questions[i];
    const options = q.options.filter((_, j) => j !== k);
    const answer = q.answer === k ? 0 : q.answer > k ? q.answer - 1 : q.answer;
    setQ(i, { options, answer });
  };
  const moveQ = (i, dir) => setExam((e) => {
    const qs = [...e.questions];
    const j = i + dir;
    if (j < 0 || j >= qs.length) return e;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    return { ...e, questions: qs };
  });

  const save = (status) => {
    const clean = {
      ...exam,
      title: exam.title.trim(),
      duration: Number(exam.duration),
      questions: exam.questions.map((q) => ({ ...q, text: q.text.trim(), options: q.options.map((o) => o.trim()), marks: Number(q.marks) })),
    };
    const errs = validate(clean);
    setErrors(errs);
    if (errs.length) return window.scrollTo({ top: 0, behavior: "smooth" });
    if (existing) update("onlineExams", existing.id, { ...clean, status });
    else add("onlineExams", { ...clean, status, createdBy: user.name, createdAt: todayIso() });
    toast(status === "published" ? "Exam published" : "Draft saved");
    navigate("/online-exams");
  };

  return (
    <>
      <PageHead title={existing ? "Edit Online Exam" : "Create Online Exam"} crumbs={[{ label: "Online Exams", to: "/online-exams" }, existing ? "Edit" : "New"]}>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn light" onClick={() => save("draft")}>Save as draft</button>
          <button className="btn" onClick={() => save("published")}>Publish</button>
        </div>
      </PageHead>

      {errors.length > 0 && (
        <div className="alert error" role="alert">
          <b>Please fix the following:</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Exam details</h3><span className="badge b-purple">{plural(exam.questions.length, "question")} · {plural(totalMarks(exam), "mark")}</span></div>
        <div className="form">
          <div className="form-grid">
            <label style={{ gridColumn: "1 / -1" }}>Title *<input className="input" value={exam.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Fractions Quiz" /></label>
            <label>Subject<select className="select" value={exam.subject} onChange={(e) => set({ subject: e.target.value })}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Class<select className="select" value={exam.class} onChange={(e) => set({ class: e.target.value })}>{CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}</select></label>
            <label>Time limit (minutes) *<input className="input" type="number" min="1" max="300" value={exam.duration} onChange={(e) => set({ duration: e.target.value })} /></label>
            <label className="inline-check">
              <input type="checkbox" className="check" checked={exam.showAnswers} onChange={(e) => set({ showAnswers: e.target.checked })} />
              Show correct answers to students after they submit
            </label>
          </div>
        </div>
      </div>

      {exam.questions.map((q, i) => (
        <div className="card q-card" key={q.id}>
          <div className="q-head">
            <h3>Question {i + 1}</h3>
            <div className="row-actions">
              <label className="marks">Marks <input className="input" type="number" min="1" max="100" value={q.marks} onChange={(e) => setQ(i, { marks: e.target.value })} /></label>
              <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => moveQ(i, -1)}><Icon name="chevron" style={{ transform: "rotate(180deg)" }} /></button>
              <button className="icon-btn" title="Move down" disabled={i === exam.questions.length - 1} onClick={() => moveQ(i, 1)}><Icon name="chevron" /></button>
              <button className="icon-btn danger" title="Delete question" disabled={exam.questions.length === 1}
                onClick={() => setExam((e) => ({ ...e, questions: e.questions.filter((_, j) => j !== i) }))}><Icon name="trash" /></button>
            </div>
          </div>
          <div className="form">
            <label>Question *<textarea value={q.text} maxLength={500} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Type the question…" style={{ minHeight: 64 }} /></label>
          </div>
          <p className="hint">Select the circle next to the correct answer.</p>
          {q.options.map((o, k) => (
            <div className={`opt-row ${q.answer === k ? "is-answer" : ""}`} key={k}>
              <input type="radio" className="check" name={`ans-${q.id}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} aria-label={`Mark option ${LETTERS[k]} as correct`} />
              <span className="key">{LETTERS[k]}</span>
              <input className="input" value={o} maxLength={200} onChange={(e) => setOpt(i, k, e.target.value)} placeholder={`Option ${LETTERS[k]}`} />
              <button className="icon-btn danger" title="Remove option" disabled={q.options.length <= 2} onClick={() => removeOpt(i, k)}><Icon name="x" /></button>
            </div>
          ))}
          {q.options.length < 6 && (
            <button className="link" style={{ justifySelf: "start" }} onClick={() => setQ(i, { options: [...q.options, ""] })}>+ Add option</button>
          )}
        </div>
      ))}

      <button className="btn light" style={{ alignSelf: "flex-start" }} onClick={() => setExam((e) => ({ ...e, questions: [...e.questions, blankQuestion()] }))}>
        <Icon name="plus" />Add question
      </button>
    </>
  );
}
