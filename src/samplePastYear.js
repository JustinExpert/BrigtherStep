// Sample data for one closed school year (2025–2026), so the report card's year selector can be tried.
// Deterministic: the same students always get the same grades, whether it's built for a fresh
// demo database (data.js) or added to an existing one (scripts/add-past-year.mjs).
import { TERMS, gradeId } from "./constants.js";
import { GRADES } from "./levels.js";

export const PAST_YEAR = { key: "2025-2026", label: "2025–2026", start: "2025-08-18", end: "2026-06-12" };
const TERM_DATES = { Q1: "2025-10-24", Q2: "2026-01-16", Q3: "2026-03-20", Q4: "2026-06-05" };

/** Small stable hash → 0…1, so a student's "ability" and each grade don't depend on generation order. */
function unit(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** The grade before this one within the same level (Grade 3 → Grade 2), or null for a level's first grade. */
function previousGrade(key) {
  const i = GRADES.findIndex((g) => g.key === key);
  return i > 0 && GRADES[i - 1].level === GRADES[i].level ? GRADES[i - 1].key : null;
}

/**
 * Builds last year's records from this year's sections, students and teaching assignments.
 * A student now in Grade 3 – A was in Grade 2 – A last year; students in a level's first grade are new.
 * Returns { year, sections, grades, enrollments, archive }.
 */
export function makePastYear({ students, assignments, classes, routine }) {
  const current = classes.filter((c) => c.grade); // sections (with a grade level)
  const sections = [];
  const pastOf = new Map(); // current section id → last year's section (one grade lower, same name)
  for (const c of current) {
    const was = previousGrade(c.grade);
    if (!was) continue;
    const id = `CLS-P${PAST_YEAR.key.slice(0, 4)}-${was}-${String(c.name).replace(/[^A-Za-z0-9]/g, "")}`;
    let sec = sections.find((s) => s.id === id);
    if (!sec) {
      sec = { id, year: PAST_YEAR.key, level: c.level, grade: was, name: c.name, adviser: "", room: c.room || "", capacity: c.capacity || 40, strand: "", sample: true };
      sections.push(sec);
    }
    pastOf.set(c.id, sec);
  }

  const grades = [], enrollments = [], enrollment = {};
  for (const s of students) {
    const sec = pastOf.get(s.class);
    if (!sec) continue; // new this year
    enrollment[s.id] = sec.id;
    enrollments.push({ id: `ENR-${s.id}-${PAST_YEAR.key}`, studentId: s.id, year: PAST_YEAR.key, class: sec.id, from: PAST_YEAR.start, to: PAST_YEAR.end, reason: "Enrolled", by: "USR-1", at: `${PAST_YEAR.start}T00:00:00.000Z`, sample: true });
    // Subjects and teachers: those of this year's section in the grade the student was in then.
    const then = current.find((c) => c.grade === sec.grade && c.name === sec.name) || current.find((c) => c.grade === sec.grade);
    const ability = 70 + unit(s.id) * 26; // 70–96
    for (const a of assignments.filter((x) => then && x.class === then.id)) {
      for (const t of TERMS) {
        const score = Math.round(Math.max(60, Math.min(99, ability + (unit(`${s.id}|${a.subject}|${t.key}`) - 0.5) * 14)));
        grades.push({
          id: gradeId(PAST_YEAR.key, s.id, a.subject, t.key), year: PAST_YEAR.key, studentId: s.id, class: sec.id,
          subject: a.subject, term: t.key, score, published: true, updatedBy: a.teacherId, updatedAt: TERM_DATES[t.key],
        });
      }
    }
  }
  const archive = {
    id: PAST_YEAR.key, label: PAST_YEAR.label, start: PAST_YEAR.start, end: PAST_YEAR.end,
    closedAt: `${PAST_YEAR.end}T17:00:00.000Z`, closedBy: "USR-1", sample: true,
    classes: sections, assignments, routine, enrollment,
  };
  return { year: PAST_YEAR, sections, grades, enrollments, archive };
}
