// Fixed lists and defaults shared by the browser app and the server.
// (The sample records the database is seeded from live in data.js, which the browser never loads.)
import { DEFAULT_WEIGHTS } from "./lib/gradeCalc.js";

export const AVATAR_COLORS = ["#7b2cdf", "#ff7a3d", "#2f8cf0", "#2fb36c", "#e2456e", "#5327ae", "#f2a516"];
export const SUBJECTS = ["Mathematics", "English", "Science", "History", "Geography", "Art", "Music", "Physical Ed.", "Computer"];
export const STRANDS = ["STEM", "ABM", "HUMSS", "GAS", "TVL"];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const PERIODS = ["08:00", "08:50", "09:40", "10:50", "11:40", "12:30"];

export const TERMS = [
  { key: "Q1", label: "1st Quarter" }, { key: "Q2", label: "2nd Quarter" },
  { key: "Q3", label: "3rd Quarter" }, { key: "Q4", label: "4th Quarter" },
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
  grading: [
    { grade: "A", min: 90, remark: "Outstanding" },
    { grade: "B", min: 80, remark: "Very good" },
    { grade: "C", min: 70, remark: "Good" },
    { grade: "D", min: 60, remark: "Passed" },
    { grade: "F", min: 0, remark: "Failed" },
  ],
};
