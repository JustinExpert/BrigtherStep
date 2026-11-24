// Read-only health check of the BrighterStep database: cross-checks every collection against
// the others (links, ids, school years, value ranges). Changes nothing.
// Run: npm run db:audit
import { ALL_TERMS as TERMS, GRADUATED } from "../src/constants.js";
import { GRADES, gradeOf, levelOf, offers, parseEnabledLevels } from "../src/levels.js";
import { LEVELS, MODULES, ROLES } from "../src/lib/permissions.js";
import { connect, dbName, redact, uri } from "./db.mjs";

if (!uri) { console.log("MONGODB_URI is empty in .env — run npm run db:check first."); process.exit(1); }

const problems = [];
const MAX_SHOWN = 5;
const counts = {};
/** Records a problem; similar ones are grouped so the report stays short. */
function problem(area, message, example) {
  const key = `${area}: ${message}`;
  const p = problems.find((x) => x.key === key);
  if (p) { p.n++; if (p.examples.length < MAX_SHOWN && example) p.examples.push(example); }
  else problems.push({ key, n: 1, examples: example ? [example] : [] });
}
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const YEAR_RE = /^\d{4}-\d{4}$/;

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  const all = async (c) => db.collection(c).find({}).toArray();
  const [students, teachers, classes, subjects, assignments, grades, activities, attendance, notices, users, settings] = await Promise.all(
    ["students", "teachers", "classes", "subjects", "assignments", "grades", "activities", "attendance", "notices", "users", "settings"].map(all));
  Object.assign(counts, { students: students.length, teachers: teachers.length, classes: classes.length, subjects: subjects.length, assignments: assignments.length, grades: grades.length, activities: activities.length, attendance: attendance.length, notices: notices.length, users: users.length });

  // ---------- Subjects (grades, activities, assignments and teachers refer to them by name) ----------
  const SUBJECTS = subjects.map((s) => s.name);
  const subjectByName = new Map(subjects.map((s) => [s.name, s]));
  if (new Set(SUBJECTS.map((n) => n.toLowerCase())).size !== SUBJECTS.length) problem("subjects", "two subjects with the same name");
  for (const s of subjects) {
    if (!Array.isArray(s.grades) || !s.grades.length) problem("subjects", "no grade levels (run npm run db:migrate-subjects)", s._id);
    else if (s.grades.some((g) => !GRADES.some((x) => x.key === g))) problem("subjects", "unknown grade level", s._id);
    if ("classes" in s) problem("subjects", "old free-text \"classes\" field", s._id);
  }

  // ---------- Settings & school years ----------
  const school = settings.find((s) => s._id === "school")?.value;
  const routine = settings.find((s) => s._id === "routine")?.value;
  const perms = settings.find((s) => s._id === "permissions")?.value;
  const ay = school?.academicYear;
  if (!ay) problem("settings", "school has no academicYear");
  else {
    if (!YEAR_RE.test(ay.key || "")) problem("settings", "academicYear.key missing or not like 2026-2027", ay.key);
    if (!isDate(ay.start) || !isDate(ay.end) || ay.start >= ay.end) problem("settings", "academicYear dates invalid", `${ay.start} → ${ay.end}`);
    else if (ay.key && ay.key !== `${ay.start.slice(0, 4)}-${ay.end.slice(0, 4)}`) problem("settings", "academicYear.key doesn't match its dates", `${ay.key} vs ${ay.start}…${ay.end}`);
  }
  const pastYears = school?.pastYears;
  if (!Array.isArray(pastYears)) problem("settings", "school.pastYears missing");
  const knownYears = new Set([ay?.key, ...(pastYears || []).map((y) => y.key)].filter(Boolean));
  for (const y of pastYears || []) if (!YEAR_RE.test(y.key || "") || !isDate(y.start) || !isDate(y.end)) problem("settings", "a past year is malformed", JSON.stringify(y));
  const archives = new Set((await db.collection("year_archives").find({}, { projection: { _id: 1 } }).toArray()).map((a) => a._id));
  for (const y of pastYears || []) if (!archives.has(y.key)) problem("settings", "closed year has no snapshot in year_archives", y.key);
  const yearOfDate = (date) => [ay, ...(pastYears || [])].find((y) => y && date >= y.start && date <= y.end)?.key;
  if (!routine) problem("settings", "routine (timetable) missing");
  else for (const cls of Object.keys(routine)) if (!Array.isArray(routine[cls])) problem("settings", "timetable for a section is malformed", cls);
  if (!perms) problem("settings", "permissions missing");
  else for (const m of MODULES) for (const r of ROLES) if (perms[m.key]?.[r.key] && !LEVELS.includes(perms[m.key][r.key])) problem("settings", "invalid permission level", `${m.key}/${r.key}=${perms[m.key][r.key]}`);

  // ---------- Reference data ----------
  const studentById = new Map(students.map((s) => [s._id, s]));
  const teacherIds = new Set(teachers.map((t) => t._id));
  // ---------- Sections (one school year, level and grade each) ----------
  const savedLevels = settings.find((s) => s._id === "levels")?.value;
  const levels = parseEnabledLevels(Array.isArray(savedLevels) ? savedLevels.join(",") : process.env.ENABLED_LEVELS);
  const sections = await db.collection("classes").find({}).toArray();
  const sectionById = new Map(sections.map((s) => [s._id, s]));
  const validClass = (c) => sectionById.has(c);
  const currentClass = (c) => sectionById.get(c)?.year === ay?.key;
  const seen = new Set();
  for (const s of sections) {
    if (!knownYears.has(s.year)) problem("sections", "school year not in settings", `${s._id}: ${s.year}`);
    if (!levelOf(s.level)) problem("sections", "unknown level", `${s._id}: ${s.level}`);
    else if (!levels.includes(s.level)) problem("sections", "level not enabled for this school (Levels page / ENABLED_LEVELS)", `${s._id}: ${s.level}`);
    if (gradeOf(s.grade)?.level !== s.level) problem("sections", "grade doesn't belong to its level", `${s._id}: ${s.grade}`);
    if (!s.name) problem("sections", "missing name", s._id);
    if (s.adviser && !teacherIds.has(s.adviser)) problem("sections", "adviser doesn't exist", `${s._id} → ${s.adviser}`);
    if ((s.level === "college") !== !!s.program) problem("sections", "College sections need a program (and only they have one)", s._id);
    const k = `${s.year}|${s.program || ""}|${s.grade}|${s.name}`; // College: per program
    if (seen.has(k)) problem("sections", "two sections with the same name in a grade (and program)", k);
    seen.add(k);
  }
  for (const cls of Object.keys(routine || {})) if (!currentClass(cls)) problem("settings", "timetable for a section that isn't this year's", cls);
  for (const s of students) {
    if (s.class !== GRADUATED && !currentClass(s.class)) problem("students", "not in one of this year's sections", `${s._id}: ${s.class}`);
    if (!s.name?.trim()) problem("students", "missing name", s._id);
    for (const f of ["_r", "marks", "percent", "attendance"]) if (f in s) problem("students", `sample-only field "${f}" (not a real record)`, s._id);
    if ("year" in s) problem("students", "old field `year` (admission year) — should be admittedYear", s._id);
    if (s.class === GRADUATED && !knownYears.has(s.graduatedYear)) problem("students", "graduated without a known graduation year", s._id);
  }
  for (const t of teachers) {
    if ("class" in t) problem("teachers", "old \"class teacher of\" field (advisers live on sections now)", t._id);
    if (!SUBJECTS.includes(t.subject)) problem("teachers", "subject not in the subject list", `${t._id}: ${t.subject}`);
  }
  const pairSeen = new Set();
  for (const a of assignments) {
    if (!currentClass(a.class)) problem("assignments", "not for one of this year's sections", a._id);
    if (!SUBJECTS.includes(a.subject)) problem("assignments", "unknown subject", a._id);
    else if (classes.some((c) => c._id === a.class) && !offers(subjectByName.get(a.subject), classes.find((c) => c._id === a.class))) problem("assignments", "section's grade level doesn't take this subject", a._id);
    if (!teacherIds.has(a.teacherId)) problem("assignments", "teacher doesn't exist", `${a._id} → ${a.teacherId}`);
    const k = `${a.class}|${a.subject}`;
    if (pairSeen.has(k)) problem("assignments", "two teachers for the same class+subject", k);
    pairSeen.add(k);
  }

  // ---------- Grades ----------
  const terms = new Set(TERMS.map((t) => t.key));
  for (const g of grades) {
    const [y, sid, subject, term] = String(g._id).split("|");
    if (!g.year) problem("grades", "no school year (run npm run db:migrate-years)", g._id);
    else if (!knownYears.has(g.year)) problem("grades", "school year not in settings", `${g._id}: ${g.year}`);
    if (y !== g.year || sid !== g.studentId || subject !== g.subject || term !== g.term) problem("grades", "id doesn't match its fields", g._id);
    if (!studentById.has(g.studentId)) problem("grades", "student doesn't exist", g._id);
    if (!SUBJECTS.includes(g.subject)) problem("grades", "unknown subject", g._id);
    if (!terms.has(g.term)) problem("grades", "unknown quarter", g._id);
    if (g.rating ? !["B", "D", "C"].includes(g.rating) : g.remark ? !["INC", "DRP"].includes(g.remark) : !(typeof g.score === "number" && g.score >= 0 && g.score <= 100)) problem("grades", "score not 0–100 (and no INC/DRP mark)", `${g._id}: ${g.score}`);
    if (typeof g.published !== "boolean") problem("grades", "published isn't true/false", g._id);
    if (!validClass(g.class)) problem("grades", "unknown class", g._id);
    if (g.year === ay?.key && !assignments.some((a) => a.class === g.class && a.subject === g.subject)) problem("grades", "current-year grade for a class+subject nobody teaches", g._id);
  }

  // ---------- Activities ----------
  for (const a of activities) {
    if (!a.year) problem("activities", "no school year", a._id);
    else if (!knownYears.has(a.year)) problem("activities", "school year not in settings", `${a._id}: ${a.year}`);
    if (!validClass(a.class) || !SUBJECTS.includes(a.subject) || !terms.has(a.term)) problem("activities", "unknown class/subject/quarter", a._id);
    if (!(Number.isInteger(a.maxScore) && a.maxScore >= 1)) problem("activities", "invalid highest possible score", a._id);
    for (const [sid, v] of Object.entries(a.scores || {})) {
      if (!studentById.has(sid)) problem("activities", "score for a student that doesn't exist", `${a._id}: ${sid}`);
      if (!(typeof v === "number" && v >= 0 && v <= a.maxScore)) problem("activities", "score outside 0…max", `${a._id}: ${sid}=${v}/${a.maxScore}`);
    }
  }

  // ---------- Attendance ----------
  for (const r of attendance) {
    if (r._id !== `${r.class}|${r.date}`) problem("attendance", "id doesn't match class|date", r._id);
    if (!validClass(r.class)) problem("attendance", "unknown class", r._id);
    if (!isDate(r.date)) problem("attendance", "invalid date", r._id);
    if (!r.year) problem("attendance", "no school year", r._id);
    else if (r.year !== yearOfDate(r.date)) problem("attendance", "year doesn't match the date", `${r._id}: ${r.year}`);
    for (const [sid, v] of Object.entries(r.marks || {})) {
      if (!studentById.has(sid)) problem("attendance", "mark for a student that doesn't exist", `${r._id}: ${sid}`);
      if (!["P", "A", "L"].includes(v)) problem("attendance", "mark isn't P/A/L", `${r._id}: ${sid}=${v}`);
    }
  }

  // ---------- Announcements ----------
  for (const n of notices) {
    if (!isDate(n.date)) problem("notices", "invalid date", n._id);
    if (!n.year) problem("notices", "no school year", n._id);
    else if (!knownYears.has(n.year)) problem("notices", "school year not in settings", `${n._id}: ${n.year}`);
    const aud = n.audience || "Whole school";
    if (aud !== "Whole school" && !validClass(aud)) problem("notices", "audience isn't a section", `${n._id}: ${aud}`);
    else if (aud !== "Whole school" && sectionById.get(aud).year !== n.year) problem("notices", "audience section is from another school year", `${n._id}: ${aud}`);
  }

  // ---------- Enrolments ----------
  const enrollments = await db.collection("enrollments").find({}).toArray();
  counts.enrollments = enrollments.length;
  for (const e of enrollments) {
    if (!studentById.has(e.studentId)) problem("enrollments", "student doesn't exist", e._id);
    if (!validClass(e.class)) problem("enrollments", "section doesn't exist", `${e._id}: ${e.class}`);
    else if (sectionById.get(e.class).year !== e.year) problem("enrollments", "section is from another school year", e._id);
    if (e.to && e.to < e.from) problem("enrollments", "ends before it starts", e._id);
  }
  for (const s of students.filter((x) => currentClass(x.class))) {
    const open = enrollments.filter((e) => e.studentId === s._id && e.year === ay.key && !e.to);
    if (open.length !== 1) problem("enrollments", open.length ? "more than one open enrolment this year" : "no enrolment this year", s._id);
    else if (open[0].class !== s.class) problem("enrollments", "open enrolment doesn't match the student's section", s._id);
  }

  // ---------- Accounts ----------
  const emails = new Map(), studentLogins = new Map();
  for (const u of users) {
    if (!ROLES.some((r) => r.key === u.role)) problem("users", "unknown role", `${u._id}: ${u.role}`);
    if (!["active", "pending", "inactive"].includes(u.status)) problem("users", "unknown status", `${u._id}: ${u.status}`);
    if (!u.salt || !u.passwordHash) problem("users", "no password set", u._id);
    if (u.email === undefined) {
      // Only a student linked to their record may have no email: they sign in with the student ID.
      if (u.role !== "student" || !u.studentId) problem("users", "no email and no student ID to sign in with", u._id);
    } else {
      const e = String(u.email || "").toLowerCase();
      if (!e) problem("users", "empty email (remove the field instead)", u._id);
      if (emails.has(e)) problem("users", "duplicate email", `${u._id} & ${emails.get(e)}`);
      emails.set(e, u._id);
      if (u.email !== e) problem("users", "email not lowercase", u._id);
    }
    if (u.role === "student" && u.studentId) {
      if (studentLogins.has(u.studentId)) problem("users", "student has two logins", `${u.studentId}: ${studentLogins.get(u.studentId)} & ${u._id}`);
      studentLogins.set(u.studentId, u._id);
    }
    if (u.role === "student" && u.studentId && !studentById.has(u.studentId)) problem("users", "linked student doesn't exist", `${u._id} → ${u.studentId}`);
    if (u.role === "teacher" && u.teacherId && !teacherIds.has(u.teacherId)) problem("users", "linked staff record doesn't exist", `${u._id} → ${u.teacherId}`);
    for (const id of u.childIds || []) if (!studentById.has(id)) problem("users", "linked child doesn't exist", `${u._id} → ${id}`);
    if (u.status === "active" && u.role === "student" && !u.studentId) problem("users", "active student account not linked to a student record", u._id);
    if (u.status === "active" && u.role === "teacher" && !u.teacherId) problem("users", "active teacher account not linked to a staff record", u._id);
  }
  if (!users.some((u) => u.role === "superadmin" && u.status === "active")) problem("users", "no active Super Admin");

  // ---------- Report ----------
  console.log(`Database "${dbName}" · open school year ${ay?.label} (${ay?.key}) · closed years: ${(pastYears || []).map((y) => y.label).join(", ") || "none"}`);
  console.log("Records: " + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "));
  if (!problems.length) console.log("\n✓ No problems found.");
  else {
    console.log(`\n${problems.reduce((n, p) => n + p.n, 0)} problem(s):`);
    for (const p of problems) console.log(`  • ${p.key} — ${p.n}${p.examples.length ? `  e.g. ${p.examples.join("; ")}` : ""}`);
    process.exitCode = 1;
  }
} catch (e) {
  console.log("AUDIT FAILED: " + redact(e?.message || e));
  process.exitCode = 2;
} finally {
  await client?.close().catch(() => {});
}
