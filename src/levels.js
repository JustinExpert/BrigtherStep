// School levels and grade levels (Philippine K–12 + College), shared by the server and the app.
// Which levels a school can use is set by the vendor per deployment (ENABLED_LEVELS); the school
// then creates its own sections (e.g. "Grade 1 – Sampaguita") for each school year.

export const LEVELS = [
  { key: "kinder", label: "Kinder", grades: [["N", "Nursery"], ["PK", "Pre-Kinder"], ["K", "Kindergarten"]] },
  { key: "elementary", label: "Elementary", grades: [1, 2, 3, 4, 5, 6].map((n) => [`G${n}`, `Grade ${n}`]) },
  { key: "junior_high", label: "Junior High", grades: [7, 8, 9, 10].map((n) => [`G${n}`, `Grade ${n}`]) },
  { key: "senior_high", label: "Senior High", grades: [["G11", "Grade 11"], ["G12", "Grade 12"]], strands: true },
  // College has its own model (programs, units, semesters); it isn't available until that module exists.
  { key: "college", label: "College", grades: [["Y1", "1st Year"], ["Y2", "2nd Year"], ["Y3", "3rd Year"], ["Y4", "4th Year"]], available: false },
].map((l) => ({ ...l, available: l.available !== false, grades: l.grades.map(([key, label]) => ({ key, label, level: l.key })) }));

export const LEVEL_KEYS = LEVELS.map((l) => l.key);
/** Every K–12 level that can be switched on today (College comes with its own module). */
export const DEFAULT_LEVELS = LEVELS.filter((l) => l.available).map((l) => l.key);
export const levelOf = (key) => LEVELS.find((l) => l.key === key);

/** All grades in school order: Nursery … Grade 12, then College years. */
export const GRADES = LEVELS.flatMap((l) => l.grades);
export const gradeOf = (key) => GRADES.find((g) => g.key === key);
export const gradeLabel = (key) => gradeOf(key)?.label ?? key;

/**
 * Reads the vendor's ENABLED_LEVELS setting ("kinder,elementary"). Unknown or not-yet-available
 * levels are ignored; empty or unset means every available level (the demo).
 */
export function parseEnabledLevels(text) {
  const wanted = String(text || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const ok = wanted.filter((k) => levelOf(k)?.available);
  return ok.length ? LEVEL_KEYS.filter((k) => ok.includes(k)) : DEFAULT_LEVELS;
}

/**
 * The grade a student moves up to at the end of the year, within the levels this school offers.
 * Kindergarten → Grade 1 only if Elementary is offered, Grade 6 → Grade 7 only if Junior High is, …
 * Returns null when the student finishes the school's last grade (they graduate).
 */
export function nextGrade(key, enabledLevels) {
  const order = GRADES.filter((g) => enabledLevels.includes(g.level) && g.level !== "college");
  const i = order.findIndex((g) => g.key === key);
  if (i < 0 || i === order.length - 1) return null;
  const next = order[i + 1];
  // Don't jump a gap (e.g. Grade 6 → Grade 11 when Junior High isn't offered): that's leaving the school.
  const a = GRADES.findIndex((g) => g.key === key), b = GRADES.findIndex((g) => g.key === next.key);
  return b === a + 1 ? next.key : null;
}

/** "Grade 1 – Sampaguita" for a section record (or a fallback for an id we don't know). */
export const sectionLabel = (section, fallbackId) => (section ? `${gradeLabel(section.grade)} – ${section.name}` : fallbackId ? `Class ${fallbackId}` : "—");

/** Sort sections by school order of their grade, then by name. */
export const bySchoolOrder = (a, b) => GRADES.findIndex((g) => g.key === a.grade) - GRADES.findIndex((g) => g.key === b.grade) || String(a.name).localeCompare(String(b.name));

/**
 * Whether a section takes a subject: the subject lists the section's grade level, and (Senior High)
 * it is either a core subject (no strands listed) or listed for the section's strand.
 */
export const offers = (subject, section) => !!subject && !!section && (subject.grades || []).includes(section.grade)
  && (!subject.strands?.length || subject.strands.includes(section.strand));

/** The levels a subject is taught in, e.g. ["elementary", "junior_high"]. */
export const subjectLevels = (subject) => [...new Set((subject.grades || []).map((g) => gradeOf(g)?.level).filter(Boolean))];
