// Helpers for online exams.
export const totalMarks = (exam) => exam.questions.reduce((a, q) => a + (Number(q.marks) || 0), 0);
export const gradeAnswers = (exam, answers) => exam.questions.reduce((a, q, i) => a + (answers[i] === q.answer ? Number(q.marks) || 0 : 0), 0);
export const pct = (score, total) => (total ? Math.round((score / total) * 100) : 0);
export const fmtSecs = (s) => {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};
export const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
export const STATUS_BADGE = { draft: "b-amber", published: "b-green", closed: "b-red" };
export const LETTERS = "ABCDEF";
export const gradeBadge = (p) => (p >= 75 ? "b-green" : p >= 50 ? "b-amber" : "b-red");
