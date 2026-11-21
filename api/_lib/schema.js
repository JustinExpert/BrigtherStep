// What a valid record looks like, per collection. Every add/update is checked here before it's saved,
// so wrong data (a grade of 150, a student without a name, a score for a student who doesn't exist)
// never reaches the database. The rules match the app's forms.
import { GRADUATED, TERMS } from "../../src/constants.js";
import { GRADES, gradeLabel, gradeOf, levelOf, offers, sectionLabel } from "../../src/levels.js";
import { COMPONENTS } from "../../src/lib/gradeCalc.js";
import { bad } from "./access.js";

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s) => typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const today = () => new Date().toISOString().slice(0, 10);
const yearsFromToday = (n) => `${Number(today().slice(0, 4)) + n}${today().slice(4)}`;

// ---------- Field rules ----------
// { label, type, required, max, oneOf, min, maxValue, integer, after, before, pattern, subject }
// type "list" = an array of short texts (each one of `oneOf`); `subject: true` = one of the school's subjects.
const text = (label, max, more = {}) => ({ label, type: "string", max, ...more });
const list = (label, more = {}) => ({ label, type: "list", ...more });
const SUBJECT = (max = 60) => req(text("Subject", max, { subject: true }));
const req = (rule) => ({ ...rule, required: true });
const date = (label, more = {}) => ({ label, type: "date", ...more });
const num = (label, min, maxValue, more = {}) => ({ label, type: "number", min, maxValue, ...more });
const PHONE = /^[+\d(][\d\s()+.-]{2,29}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const RULES = {
  students: {
    name: req(text("Full name", 100)),
    gender: text("Gender", 10, { oneOf: ["Male", "Female"] }),
    class: req(text("Section", 40, { ref: "studentSection" })),
    roll: req(text("Roll", 10)),
    dob: req(date("Date of birth", { after: "1950-01-01", before: today })),
    phone: req(text("Phone", 30, { pattern: PHONE })),
    parent: req(text("Parent / guardian", 100)),
    email: text("Email", 254, { pattern: EMAIL }),
    address: req(text("Address", 200)),
    admittedYear: num("Admission year", 1950, 2100, { integer: true }),
    color: text("Colour", 7, { pattern: COLOR }),
    graduatedYear: text("Graduation year", 9, { pattern: /^\d{4}-\d{4}$/ }),
  },
  teachers: {
    name: req(text("Full name", 100)),
    gender: text("Gender", 10, { oneOf: ["Male", "Female"] }),
    subject: SUBJECT(),
    phone: req(text("Phone", 30, { pattern: PHONE })),
    email: req(text("Email", 254, { pattern: EMAIL })),
    joined: req(date("Joining date", { after: "1950-01-01", before: () => yearsFromToday(1) })),
    salary: num("Monthly salary", 0, 10_000_000),
    color: text("Colour", 7, { pattern: COLOR }),
    photo: text("Photo", 400_000, { pattern: PHOTO }),
  },
  // A section of one grade level in one school year, e.g. Grade 1 – Sampaguita (2026–2027).
  classes: {
    year: req(text("School year", 9, { pattern: /^\d{4}-\d{4}$/ })),
    level: req(text("Level", 20, { oneOf: (ctx) => ctx.levels })),
    grade: req(text("Grade level", 4)),
    name: req(text("Section name", 40)),
    adviser: text("Adviser", 40, { ref: "teacher" }),
    room: text("Room", 20),
    capacity: num("Capacity", 1, 200, { integer: true }),
    strand: text("Strand", 20, { oneOf: (ctx) => ["", ...(ctx.settings.school.strands || [])] }),
  },
  // A subject and the grade levels that take it (Senior High: optionally only some strands).
  subjects: {
    name: req(text("Subject name", 60, { pattern: /^[^|$]+$/ })),
    code: req(text("Code", 20)),
    teacher: text("Teacher", 100, { ref: "teacherName" }),
    type: text("Type", 20, { oneOf: ["Theory", "Practical"] }),
    // Any known grade: a subject keeps grades of levels that are switched off (only sections of on levels can use it).
    grades: req(list("Grade levels", { oneOf: GRADES.map((g) => g.key) })),
    strands: list("Strands", { oneOf: (ctx) => ctx.settings.school.strands || [] }),
  },
  notices: {
    title: req(text("Title", 150)),
    body: req(text("Message", 5000)),
    type: text("Category", 20, { oneOf: ["general", "event", "exam", "course", "teacher"] }),
    audience: text("Send to", 40, { ref: "audience" }), // "Whole school" or a section
    date: req(date("Date", { after: "2000-01-01", before: () => yearsFromToday(1) })),
    author: text("Author", 100), authorId: text("Author", 40), year: text("School year", 9), // set by the server
  },
  assignments: {
    class: req(text("Section", 40, { ref: "currentSection" })),
    subject: SUBJECT(),
    teacherId: req(text("Teacher", 40, { ref: "teacher" })),
  },
  grades: {
    studentId: req(text("Student", 40, { ref: "student" })),
    class: req(text("Section", 40, { ref: "section" })),
    subject: SUBJECT(),
    term: req(text("Quarter", 4, { oneOf: TERMS.map((t) => t.key) })),
    score: req(num("Grade", 0, 100)),
    published: req({ label: "Published", type: "boolean" }),
    updatedBy: text("Updated by", 40), updatedAt: date("Updated on"), year: req(text("School year", 9)),
  },
  activities: {
    class: req(text("Section", 40, { ref: "section" })),
    subject: SUBJECT(),
    term: req(text("Quarter", 4, { oneOf: TERMS.map((t) => t.key) })),
    year: req(text("School year", 9)),
    component: req(text("Component", 4, { oneOf: COMPONENTS.map((c) => c.key) })),
    title: req(text("Title", 60)),
    maxScore: req(num("Highest possible score", 1, 1000, { integer: true })),
    date: date("Date", { after: "2000-01-01", before: () => yearsFromToday(1) }),
    createdBy: text("Created by", 40),
    scores: { label: "Scores", type: "scores" },
  },
};

/**
 * Checks one record. `incoming` is what the request sent (unknown fields are refused);
 * `merged` is the whole record as it will be saved (all rules are checked on it).
 * Returns the references to other records that must exist: { students: Set, teachers: Set, teacherNames: Set }.
 */
export function checkRecord(col, incoming, merged, ctx, refs = newRefs()) {
  const rules = RULES[col];
  if (!rules) return refs;
  const what = { students: "student", teachers: "teacher", classes: "class", subjects: "subject", notices: "announcement", assignments: "teaching assignment", grades: "grade", activities: "activity" }[col];
  for (const k of Object.keys(incoming)) if (k !== "id" && !rules[k]) bad(`Unknown field "${k}" for a ${what}.`);

  for (const [key, r] of Object.entries(rules)) {
    const v = merged[key];
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (empty) { if (r.required) bad(`${r.label} is required.`); continue; }
    const fail = (msg) => bad(`${r.label} ${msg}.`);
    switch (r.type) {
      case "string": {
        if (typeof v !== "string") fail("must be text");
        if (v.length > r.max) fail(`must be at most ${r.max} characters`);
        const options = typeof r.oneOf === "function" ? r.oneOf(ctx) : r.oneOf;
        if (options && !options.includes(v)) fail(`must be one of: ${options.filter(Boolean).join(", ")}`);
        if (r.pattern && !r.pattern.test(v)) fail("isn't valid");
        if (r.subject && !ctx.subjectByName.has(v)) fail(`"${v}" isn't one of the school's subjects (see the Subjects page)`);
        if (r.ref === "student") refs.students.add(v);
        if (r.ref === "teacher") refs.teachers.add(v);
        if (r.ref === "teacherName") refs.teacherNames.add(v);
        if (["section", "currentSection", "studentSection", "audience"].includes(r.ref)) refs[r.ref].push(v);
        break;
      }
      case "date": {
        if (!validDate(v)) fail("must be a real date (YYYY-MM-DD)");
        const before = typeof r.before === "function" ? r.before() : r.before;
        if (r.after && v < r.after) fail(`must be on or after ${r.after}`);
        if (before && v > before) fail(`must be on or before ${before}`);
        break;
      }
      case "number":
        if (typeof v !== "number" || !Number.isFinite(v)) fail("must be a number");
        if (r.integer && !Number.isInteger(v)) fail("must be a whole number");
        if (v < r.min || v > r.maxValue) fail(`must be between ${r.min} and ${r.maxValue}`);
        break;
      case "list": {
        if (!Array.isArray(v) || v.length > 60 || v.some((x) => typeof x !== "string")) fail("must be a list");
        if (new Set(v).size !== v.length) fail("lists the same item twice");
        const options = typeof r.oneOf === "function" ? r.oneOf(ctx) : r.oneOf;
        const wrong = options && v.find((x) => !options.includes(x));
        if (wrong !== undefined) fail(`can't include "${wrong}"`);
        if (r.required && !v.length) fail("needs at least one");
        break;
      }
      case "boolean":
        if (typeof v !== "boolean") fail("must be true or false");
        break;
      case "scores": {
        if (!isObj(v)) fail("must be a list of student scores");
        const max = merged.maxScore;
        for (const [sid, s] of Object.entries(v)) {
          if (!sid.startsWith("STU-") || sid.length > 40) bad(`Scores: "${sid}" isn't a student id.`);
          if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > max) bad(`Scores: each score must be from 0 to ${max} (got ${JSON.stringify(s)} for ${sid}).`);
          refs.students.add(sid);
        }
        break;
      }
    }
  }
  if (col === "classes") {
    const g = gradeOf(merged.grade);
    if (!g || g.level !== merged.level) bad(`${merged.grade} isn't a grade level in ${levelOf(merged.level)?.label || merged.level}.`);
    if (merged.strand && !levelOf(merged.level)?.strands) bad("Only Senior High sections have a strand.");
  }
  if (col === "subjects" && merged.strands?.length && !merged.grades.some((g) => levelOf(gradeOf(g)?.level)?.strands)) bad("Only Senior High subjects can be limited to some strands.");
  // Teaching, grades and activities: the section must take the subject (its grade level, and strand in Senior High).
  if (["assignments", "grades", "activities"].includes(col) && ctx.sections.has(merged.class) && ctx.subjectByName.has(merged.subject)) {
    const sec = ctx.sections.get(merged.class);
    if (!offers(ctx.subjectByName.get(merged.subject), sec)) bad(`${sectionLabel(sec)} doesn't take ${merged.subject}. Add ${gradeLabel(sec.grade)}${sec.strand ? ` (${sec.strand})` : ""} to the subject on the Subjects page first.`);
  }
  return refs;
}

export const newRefs = () => ({ students: new Set(), teachers: new Set(), teacherNames: new Set(), section: [], currentSection: [], studentSection: [], audience: [] });

/** One query per kind: every referenced student/teacher must exist. */
export async function checkRefs(db, refs, ctx) {
  if (ctx) {
    const label = (id) => `"${id}"`;
    for (const id of refs.section) if (!ctx.sections.has(id)) bad(`Section ${label(id)} doesn't exist.`);
    for (const id of refs.currentSection) if (!ctx.currentSections.has(id)) bad(`Section ${label(id)} isn't one of this school year's sections.`);
    for (const id of refs.studentSection) if (id !== GRADUATED && !ctx.currentSections.has(id)) bad(`Section ${label(id)} isn't one of this school year's sections.`);
    for (const id of refs.audience) if (id !== "Whole school" && !ctx.currentSections.has(id)) bad(`Announcements go to the whole school or one of this year's sections.`);
  }
  const missing = async (col, ids, field = "_id") => {
    if (!ids.size) return null;
    const found = new Set((await db.collection(col).find({ [field]: { $in: [...ids] } }, { projection: { [field]: 1 } }).toArray()).map((d) => d[field]));
    return [...ids].find((id) => !found.has(id)) ?? null;
  };
  const [s, t, n] = await Promise.all([missing("students", refs.students), missing("teachers", refs.teachers), missing("teachers", refs.teacherNames, "name")]);
  if (s) bad(`Student ${s} doesn't exist.`);
  if (t) bad(`Teacher ${t} doesn't exist.`);
  if (n) bad(`There's no teacher named "${n}".`);
}

// ---------- School settings ----------
const SCHOOL_KEYS = ["name", "motto", "address", "phone", "email", "website", "academicYear", "pastYears", "passingMark", "grading", "weights", "transmutation", "strands"];

/** Checks the whole school profile as it will be saved (School Setup). */
export function checkSchool(patch, school, ctx) {
  for (const k of Object.keys(patch)) if (!SCHOOL_KEYS.includes(k)) bad(`Unknown school setting "${k}".`);
  const s = school;
  const t = (v, label, max, required) => {
    if (v === undefined || v === null || v === "") { if (required) bad(`${label} is required.`); return; }
    if (typeof v !== "string" || v.length > max) bad(`${label} must be text of at most ${max} characters.`);
  };
  t(s.name, "School name", 100, true); t(s.motto, "Motto", 120); t(s.address, "Address", 200); t(s.phone, "Phone", 30);
  t(s.email, "Contact email", 254); if (s.email && !EMAIL.test(s.email)) bad("Contact email isn't valid.");
  t(s.website, "Website", 120); if (s.website && !/^https?:\/\/\S+$/.test(s.website)) bad("Website must start with http:// or https://.");
  const ay = s.academicYear;
  if (!isObj(ay)) bad("School year is missing.");
  t(ay.label, "School year label", 20, true);
  if (!validDate(ay.start) || !validDate(ay.end) || ay.start >= ay.end) bad("The school year must have real start and end dates, and end after it starts.");
  if (typeof s.passingMark !== "number" || s.passingMark < 0 || s.passingMark > 100) bad("Passing mark must be from 0 to 100.");
  if (!Array.isArray(s.grading) || !s.grading.length || s.grading.length > 20) bad("The grading scale needs 1 to 20 rows.");
  for (const g of s.grading) {
    if (!isObj(g) || typeof g.grade !== "string" || !g.grade.trim() || g.grade.length > 5) bad("Each grading row needs a grade of up to 5 characters.");
    if (typeof g.min !== "number" || g.min < 0 || g.min > 100) bad(`Grade ${g.grade}: the minimum must be from 0 to 100.`);
    if (typeof g.remark !== "string" || g.remark.length > 40) bad(`Grade ${g.grade}: the remark must be at most 40 characters.`);
  }
  if (new Set(s.grading.map((g) => g.min)).size !== s.grading.length) bad("Two grades can't start at the same percentage.");
  if (!s.grading.some((g) => g.min === 0)) bad("The lowest grade must start at 0%.");
  if (!isObj(s.weights)) bad("Grade weights are missing.");
  for (const [subject, w] of Object.entries(s.weights)) {
    if (!ctx.subjectByName.has(subject)) bad(`Grade weights: unknown subject "${subject}".`);
    if (!isObj(w) || Object.keys(w).some((k) => !COMPONENTS.some((c) => c.key === k))) bad(`Grade weights for ${subject} are invalid.`);
    const vals = COMPONENTS.map((c) => w[c.key]);
    if (vals.some((v) => typeof v !== "number" || v < 0 || v > 100)) bad(`Grade weights for ${subject} must each be from 0 to 100.`);
    if (vals.reduce((a, b) => a + b, 0) !== 100) bad(`Grade weights for ${subject} must add up to 100%.`);
  }
  if (typeof s.transmutation !== "boolean") bad("The DepEd transmutation setting must be on or off.");
  if (!Array.isArray(s.strands) || s.strands.length > 30 || s.strands.some((x) => typeof x !== "string" || !x.trim() || x.length > 20)) bad("Strands must be a list of short names.");
  if (new Set(s.strands.map((x) => x.toUpperCase())).size !== s.strands.length) bad("Each strand can only be listed once.");
}
