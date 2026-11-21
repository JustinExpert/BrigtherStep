// Sample data for one closed school year (2025–2026), so report cards' year selector can be tried.
// Deterministic: the same students always get the same grades, whether it's built for a fresh
// demo database (data.js) or added to an existing one (scripts/add-past-year.mjs).
import { CLASSES, TERMS, gradeId } from "./constants.js";

export const PAST_YEAR = { key: "2025-2026", label: "2025–2026", start: "2025-08-18", end: "2026-06-12" };
const TERM_DATES = { Q1: "2025-10-24", Q2: "2026-01-16", Q3: "2026-03-20", Q4: "2026-06-05" };

/** Small stable hash → 0…1, so a student's "ability" and each grade don't depend on generation order. */
function unit(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Builds last year's records from this year's students and teaching assignments.
 * A student now in Class 03 was in Class 02 last year; Class 01 students are new this year.
 * Returns { year, grades, archive }.
 */
export function makePastYear({ students, assignments, classes, routine }) {
  const grades = [];
  const enrollment = {};
  for (const s of students) {
    const now = CLASSES.indexOf(s.class);
    if (now <= 0) continue; // new this year (or graduated / unknown class)
    const was = CLASSES[now - 1];
    enrollment[s.id] = was;
    const ability = 70 + unit(s.id) * 26; // 70–96
    for (const a of assignments.filter((x) => x.class === was)) {
      for (const t of TERMS) {
        const score = Math.round(Math.max(60, Math.min(99, ability + (unit(`${s.id}|${a.subject}|${t.key}`) - 0.5) * 14)));
        grades.push({
          id: gradeId(PAST_YEAR.key, s.id, a.subject, t.key), year: PAST_YEAR.key, studentId: s.id, class: was,
          subject: a.subject, term: t.key, score, published: true, updatedBy: a.teacherId, updatedAt: TERM_DATES[t.key],
        });
      }
    }
  }
  const archive = {
    id: PAST_YEAR.key, label: PAST_YEAR.label, start: PAST_YEAR.start, end: PAST_YEAR.end,
    closedAt: `${PAST_YEAR.end}T17:00:00.000Z`, closedBy: "USR-1", sample: true,
    classes, assignments, routine, enrollment,
  };
  return { year: PAST_YEAR, grades, archive };
}
