// Quarterly grade calculation from activities grouped into weighted components (DepEd-style).
// Pure functions — no React — so the sample-data generator can use them too.

export const COMPONENTS = [
  { key: "WW", label: "Written Work", short: "WW", hint: "Quizzes, seatwork, short tests" },
  { key: "PT", label: "Performance Tasks", short: "PT", hint: "Projects, presentations, labs" },
  { key: "QA", label: "Quarterly Assessment", short: "QA", hint: "End-of-quarter exam" },
];

const w = (WW, PT, QA) => ({ WW, PT, QA });
/** Default weights (%) by subject. Editable per school in School Setup. */
export const DEFAULT_WEIGHTS = {
  Mathematics: w(40, 40, 20),
  Science: w(40, 40, 20),
  English: w(30, 50, 20),
  History: w(30, 50, 20),
  Geography: w(30, 50, 20),
  Art: w(20, 60, 20),
  Music: w(20, 60, 20),
  "Physical Ed.": w(20, 60, 20),
  Computer: w(20, 60, 20),
};
const FALLBACK = w(30, 50, 20);

export const weightsFor = (school, subject) => school?.weights?.[subject] || DEFAULT_WEIGHTS[subject] || FALLBACK;
export const weightTotal = (wt) => COMPONENTS.reduce((a, c) => a + (Number(wt[c.key]) || 0), 0);

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Computes one student's quarterly grade.
 * - Each component % = points earned ÷ points possible, over the activities the student has a score for.
 *   (A blank score means "not entered yet" and is skipped; enter 0 for missing work.)
 * - Grade = weighted average of the component %s. If a component has no scores yet,
 *   the remaining weights are scaled up so the grade still reads out of 100.
 */
export function computeGrade(activities, studentId, weights) {
  const components = {};
  let weighted = 0;
  let usedWeight = 0;
  let entered = 0;
  for (const c of COMPONENTS) {
    const acts = activities.filter((a) => a.component === c.key);
    let earned = 0;
    let possible = 0;
    for (const a of acts) {
      const s = a.scores?.[studentId];
      if (s === undefined || s === null || s === "") continue;
      earned += Number(s);
      possible += Number(a.maxScore);
      entered++;
    }
    const pct = possible > 0 ? (earned / possible) * 100 : null;
    components[c.key] = pct === null ? null : round1(pct);
    if (pct !== null) {
      weighted += pct * (Number(weights[c.key]) || 0);
      usedWeight += Number(weights[c.key]) || 0;
    }
  }
  // Full precision: rounding happens once, when shown or put on the report card (no double rounding).
  const grade = usedWeight > 0 ? weighted / usedWeight : null;
  return { components, grade, entered, total: activities.length };
}

/**
 * DepEd transmutation table (DepEd Order No. 8, s. 2015): initial grade → transmuted grade.
 * 60–100 maps to 75–100 in steps of 1.6; 0–59.99 maps to 60–74 in steps of 4.
 * e.g. 100 → 100, 98.40 → 99, 60.00 → 75, 59.99 → 74, 0 → 60.
 */
export function transmute(initial) {
  if (initial === null || initial === undefined) return null;
  const g = Math.max(0, Math.min(100, initial));
  return g >= 60 ? Math.min(100, 75 + Math.floor((g - 60) / 1.6 + 1e-9)) : 60 + Math.floor(g / 4 + 1e-9);
}

/**
 * The quarterly grade shown to students: the transmuted grade when the school uses the DepEd
 * table, otherwise the weighted percentage rounded to a whole number.
 */
export const reportGrade = (grade, school) => (grade === null ? null : school?.transmutation ? transmute(grade) : Math.round(grade));

/** DepEd descriptors with passing mark 75 — applied by "Use DepEd grading" in School Setup. */
export const DEPED_SCALE = [
  { grade: "O", min: 90, remark: "Outstanding" },
  { grade: "VS", min: 85, remark: "Very Satisfactory" },
  { grade: "S", min: 80, remark: "Satisfactory" },
  { grade: "FS", min: 75, remark: "Fairly Satisfactory" },
  { grade: "DME", min: 0, remark: "Did Not Meet Expectations" },
];

/** Score must be a number from 0 to the activity's max (up to one decimal place). */
export const validScore = (v, max) => v === "" || (/^\d+(\.\d)?$/.test(String(v)) && Number(v) >= 0 && Number(v) <= Number(max));
