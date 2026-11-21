// Fixed lists and defaults shared by the browser app and the server.
// (The sample records the database is seeded from live in data.js, which the browser never loads.)
import { DEFAULT_WEIGHTS } from "./lib/gradeCalc.js";

export const AVATAR_COLORS = ["#7b2cdf", "#ff7a3d", "#2f8cf0", "#2fb36c", "#e2456e", "#5327ae", "#f2a516"];
export const STRANDS = ["STEM", "ABM", "HUMSS", "GAS", "TVL"];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const PERIODS = ["08:00", "08:50", "09:40", "10:50", "11:40", "12:30"];

export const TERMS = [
  { key: "Q1", label: "1st Quarter", sem: 1 }, { key: "Q2", label: "2nd Quarter", sem: 1 },
  { key: "Q3", label: "3rd Quarter", sem: 2 }, { key: "Q4", label: "4th Quarter", sem: 2 },
];

/** Kinder checklist ratings (DepEd): given per learning domain each quarter instead of a number grade. */
export const RATINGS = [
  { key: "B", label: "Beginning", hint: "Rarely shows the expected skills" },
  { key: "D", label: "Developing", hint: "Sometimes shows the expected skills" },
  { key: "C", label: "Consistent", hint: "Always shows the expected skills" },
];

/** College grading periods: Prelim, Midterm and Finals in each semester. A college subject belongs to one semester. */
export const SEMESTERS = [{ key: 1, label: "1st Semester" }, { key: 2, label: "2nd Semester" }];
export const COLLEGE_TERMS = SEMESTERS.flatMap((s) => [["P", "Prelim"], ["M", "Midterm"], ["F", "Finals"]]
  .map(([k, short]) => ({ key: `${s.key}${k}`, short, label: `${s.label} · ${short}`, sem: s.key })));
export const ALL_TERMS = [...TERMS, ...COLLEGE_TERMS];
/**
 * The grading periods of a subject in a level: quarters for K–12 — in Senior High only its semester's two
 * (1st sem Q1–Q2, 2nd sem Q3–Q4); College: its semester's Prelim / Midterm / Finals.
 */
export const termsFor = (level, subject) => {
  const sem = Number(subject?.semester) || 0;
  if (level === "college") return COLLEGE_TERMS.filter((t) => !sem || t.sem === sem);
  if (level === "senior_high" && sem) return TERMS.filter((t) => t.sem === sem);
  return TERMS;
};
export const termLabel = (key) => ALL_TERMS.find((t) => t.key === key)?.label || key;

/** College grade scale: percentage → 1.00 (best) … 3.00 (passing) … 5.00 (failed). Editable per school. */
export const COLLEGE_SCALE = [
  { grade: "1.00", min: 97 }, { grade: "1.25", min: 94 }, { grade: "1.50", min: 91 }, { grade: "1.75", min: 88 }, { grade: "2.00", min: 85 },
  { grade: "2.25", min: 82 }, { grade: "2.50", min: 79 }, { grade: "2.75", min: 76 }, { grade: "3.00", min: 75 }, { grade: "5.00", min: 0 },
];
export const PROGRAMS = [
  { code: "BSIT", name: "BS Information Technology", years: 4 },
  { code: "BSBA", name: "BS Business Administration", years: 4 },
  { code: "BEED", name: "Bachelor of Elementary Education", years: 4 },
];

/** A grade's id: one per school year, student, subject and quarter, so years never overwrite each other. */
export const gradeId = (year, studentId, subject, term) => `${year}|${studentId}|${subject}|${term}`;

/** Class name given to students who finished the top class (set by "Start new school year"). */
export const GRADUATED = "Graduated";

/** Display data the browser uses (kept as DATA so existing pages read DATA.DAYS etc.). */
export const DATA = { DAYS, PERIODS };

/** School profile defaults (used until the server's copy loads, and to seed the database). */
export const DEFAULT_SCHOOL = {
  name: "Northfield Academy",
  motto: "Every day, a brighter step.",
  address: "120 Learning Lane, Northfield",
  phone: "+123 555 0100",
  email: "office@brighterstep.test",
  website: "https://brighterstep.test",
  // The open school year. `key` tags every grade and activity; it never changes once set.
  academicYear: { key: "2026-2027", label: "2026–2027", start: "2026-08-17", end: "2027-06-11" },
  pastYears: [], // closed school years, oldest first: [{ key, label, start, end }]
  passingMark: 60,
  weights: structuredClone(DEFAULT_WEIGHTS), // grade component weights (%) per subject
  transmutation: false, // apply the DepEd transmutation table to quarterly grades
  strands: [...STRANDS],
  periods: [...PERIODS], // start time of each timetable period (same for every section)
  programs: structuredClone(PROGRAMS), // College programs: { code, name, years }
  collegeScale: structuredClone(COLLEGE_SCALE),
  grading: [
    { grade: "A", min: 90, remark: "Outstanding" },
    { grade: "B", min: 80, remark: "Very good" },
    { grade: "C", min: 70, remark: "Good" },
    { grade: "D", min: 60, remark: "Passed" },
    { grade: "F", min: 0, remark: "Failed" },
  ],
};
