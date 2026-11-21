// Who may see and change what. The server is the authority: the browser only gets the records
// a role may read, and every change is checked here against the permission matrix and the
// teacher's class scope (the same rules the app's menus and buttons follow).
import { CLASSES, DATA, SEED } from "../../src/data.js";
import { ADMINS, DEFAULT_PERMISSIONS, LEVELS, MODULES, ROLES, allows, isLocked } from "../../src/lib/permissions.js";
import { getDb } from "./db.js";
import { publicUser } from "./auth.js";

export const COLLECTIONS = ["students", "teachers", "notices", "classes", "subjects", "users", "assignments", "grades", "activities"];
/** Which permission module guards each collection (users have their own endpoint). */
export const MODULE_OF = { students: "students", teachers: "teachers", notices: "notices", classes: "classes", subjects: "subjects", assignments: "assignments", grades: "grades", activities: "grades" };
export const PREFIX = { students: "STU-", teachers: "TCH-", notices: "N", classes: "CLS-", subjects: "SUB-", users: "USR-", assignments: "ASG-", grades: "", activities: "ACT-" };
export const WHOLE_SCHOOL = "Whole school";

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const deny = (msg = "You don't have permission to do that.") => { throw new HttpError(403, msg); };
export const bad = (msg) => { throw new HttpError(400, msg); };

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
export const toClient = ({ _id, ...rest }) => ({ id: _id, ...rest });

/**
 * Accepts only plain JSON data that is safe to store: no "$" operators, no dotted keys,
 * no prototype tricks, limited depth. Returns a clean copy.
 */
export function clean(value, depth = 0) {
  if (depth > 8) bad("Data is nested too deeply.");
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    if (typeof value === "string" && value.length > 20_000) bad("A text field is too long.");
    if (typeof value === "number" && !Number.isFinite(value)) bad("Invalid number.");
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (isObj(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // A dot in a top-level name would act as a nested path in an update ($set: { "a.b": … }), so it's refused there.
      // Deeper down it's just data (e.g. grade weights for the subject "Physical Ed.").
      if (k.startsWith("$") || (depth === 0 && k.includes(".")) || k === "__proto__" || k === "constructor" || k === "prototype" || k.length > 100) bad("Invalid field name.");
      if (v !== undefined) out[k] = clean(v, depth + 1);
    }
    return out;
  }
  return bad("Invalid data.");
}

/** Validates a record id for a collection (grades use "student|subject|term"). */
export function checkId(col, id) {
  if (typeof id !== "string" || id.length > 80) bad("Invalid id.");
  // Ids are stored as plain string values (never as field names), so spaces and dots are fine.
  // Grade ids start with the school year: "2026-2027|STU-43100|Mathematics|Q1".
  if (col === "grades" ? !/^\d{4}-\d{4}\|[A-Z0-9-]+\|[^|$]{1,60}\|[A-Z0-9]{1,6}$/i.test(id) : !(id.startsWith(PREFIX[col]) && id.length > PREFIX[col].length && /^[^$\u0000-\u001f]+$/.test(id))) bad("Invalid id.");
  return id;
}

/** School profile, permission matrix and timetable (with defaults filled in). */
export async function loadSettings(db) {
  const docs = await db.collection("settings").find({}).toArray();
  const get = (id) => docs.find((d) => d._id === id)?.value;
  const saved = get("permissions") || {};
  const permissions = Object.fromEntries(MODULES.map((m) => [m.key, Object.fromEntries(ROLES.map((r) => [r.key, saved?.[m.key]?.[r.key] || DEFAULT_PERMISSIONS[m.key][r.key]]))]));
  return { school: { ...structuredClone(SEED.school), ...(get("school") || {}) }, permissions, routine: get("routine") || structuredClone(DATA.routine) };
}

/** A teacher's classes and class+subject pairs (assignments plus homeroom class). */
export function teacherScope(user, assignments, teachers) {
  if (user.role !== "teacher" || !user.teacherId) return { classes: new Set(), pairs: new Set() };
  const mine = assignments.filter((a) => a.teacherId === user.teacherId);
  const homeroom = teachers.find((t) => (t._id ?? t.id) === user.teacherId)?.class;
  return {
    classes: new Set([...mine.map((a) => a.class), ...(homeroom ? [homeroom] : [])]),
    pairs: new Set(mine.map((a) => `${a.class}|${a.subject}`)),
  };
}

/** The request context: settings, permission check and (for teachers) scope. */
export async function context(user) {
  const db = await getDb();
  const isTeacher = user.role === "teacher";
  const [settings, assignments, teachers] = await Promise.all([
    loadSettings(db),
    isTeacher ? db.collection("assignments").find({ teacherId: user.teacherId || "-" }).toArray() : [],
    isTeacher ? db.collection("teachers").find({ _id: user.teacherId || "-" }, { projection: { class: 1 } }).toArray() : [],
  ]);
  const can = (module, need = "view") => allows(settings.permissions, module, user.role, need);
  const scope = teacherScope(user, assignments, teachers);
  return { db, settings, can, scope, isAdmin: ADMINS.includes(user.role) };
}

const audienceClass = (aud) => (aud && aud !== WHOLE_SCHOOL ? String(aud).replace(/^Class /, "") : null);

const SECRET_FIELDS = { passwordHash: 0, salt: 0, resetTokenHash: 0, resetExpires: 0 };
const TEACHER_CARD = { name: 1, subject: 1, class: 1, gender: 1, color: 1, photo: 1 };
const audienceFilter = (classes) => ({ $or: [{ audience: { $in: [null, "", WHOLE_SCHOOL] } }, { audience: { $exists: false } }, { audience: { $in: [...classes].flatMap((c) => [`Class ${c}`, c]) } }] });

/** The open school year's key, e.g. "2026-2027". */
export const currentYear = (settings) => settings.school.academicYear?.key;
export const ownStudentIds = (user) => (user.role === "student" ? [user.studentId].filter(Boolean) : user.childIds || []);

/** Which grades this user may read, before the school-year filter (null = none). */
export function gradeFilter(ctx, user) {
  if (ctx.isAdmin) return ctx.can("grades") ? {} : null;
  if (user.role === "teacher") return ctx.can("grades") ? { class: { $in: [...ctx.scope.classes] } } : null; // taught classes + homeroom
  return { studentId: { $in: ownStudentIds(user) }, published: true };
}

/** One school year's grades this user may read (used for report cards of past years). */
export async function gradesForYear(user, year, studentId, cls) {
  if (typeof year !== "string" || !/^\d{4}-\d{4}$/.test(year)) bad("Invalid school year.");
  if (studentId !== null && studentId !== undefined && (typeof studentId !== "string" || !studentId.startsWith("STU-") || studentId.length > 40)) bad("Invalid student.");
  if (cls !== null && cls !== undefined && !CLASSES.includes(cls)) bad("Invalid class.");
  const ctx = await context(user);
  let filter = gradeFilter(ctx, user);
  // In a past year the student was in another class, so a teacher's access follows the students
  // in their classes *now* (not the classes they teach now, which held other students back then).
  if (filter && user.role === "teacher") {
    const mine = await ctx.db.collection("students").find({ class: { $in: [...ctx.scope.classes] } }, { projection: { _id: 1 } }).toArray();
    filter = { studentId: { $in: mine.map((s) => s._id) } };
  }
  if (!filter) return [];
  // A report card asks for one student; a class report for the class as it was that year.
  const narrow = { ...(studentId ? { studentId } : {}), ...(cls ? { class: cls } : {}) };
  return (await ctx.db.collection("grades").find({ $and: [filter, { year, ...narrow }] }).toArray()).map(toClient);
}

/** Grades and activities can only be changed in the open school year; past years are read-only. */
export function checkYear(ctx, col, rec) {
  if (!rec || (col !== "grades" && col !== "activities")) return;
  const year = currentYear(ctx.settings);
  const id = String(rec._id ?? rec.id ?? "");
  if (!year || rec.year !== year || (col === "grades" && !id.startsWith(year + "|"))) {
    deny(`Past school years are read-only. Grades can only be changed for the current school year (${ctx.settings.school.academicYear?.label}).`);
  }
}

/**
 * Everything this user may read, in the shape the app's data store uses.
 * Each role's filter runs inside MongoDB, so only the records that are sent are read.
 */
export async function bootstrap(user) {
  await ensureIndexes();
  const ctx = await context(user);
  const { db, settings, can, scope, isAdmin } = ctx;
  const find = async (col, filter = {}, projection) => (await db.collection(col).find(filter, projection && { projection }).toArray()).map(toClient);
  const none = async () => [];
  const self = publicUser(user);
  const year = currentYear(settings); // only the open school year's grades, activities, attendance and announcements load
  const grades = () => { const f = gradeFilter(ctx, user); return f ? find("grades", { ...f, year }) : none(); };
  let q; // collection → promise of rows
  let attendanceFilter = null; // null = no attendance
  let ownStudents = null; // students/parents: only these students' marks

  if (isAdmin || user.role === "teacher") {
    // Staff: grades, gradebook activities and attendance are the bulk of a school's data, so they
    // load per page (api/_lib/views.js: one class, one student, or dashboard totals), not here.
    q = {
      students: can("students") ? find("students") : none(),
      teachers: can("teachers") ? find("teachers") : find("teachers", {}, TEACHER_CARD),
      grades: none(),
      activities: none(),
      notices: find("notices", { ...(isAdmin ? {} : audienceFilter(scope.classes)), year }),
      users: can("users") ? find("users", {}, SECRET_FIELDS) : Promise.resolve([self]),
    };
  } else {
    // Students and parents: only their own (or their children's) records.
    ownStudents = ownStudentIds(user);
    const students = await find("students", { _id: { $in: ownStudents } });
    const myClasses = new Set(students.map((s) => s.class));
    q = {
      students: Promise.resolve(students),
      teachers: find("teachers", {}, TEACHER_CARD),
      grades: grades(),
      activities: none(),
      notices: find("notices", { ...audienceFilter(myClasses), year }),
      users: Promise.resolve([self]),
    };
    attendanceFilter = { class: { $in: [...myClasses] }, year };
  }

  const [classes, subjects, assignments, attendanceDocs, ...rows] = await Promise.all([
    find("classes"), find("subjects"), find("assignments"),
    attendanceFilter ? db.collection("attendance").find(attendanceFilter).toArray() : [],
    ...Object.values(q),
  ]);
  const out = { classes, subjects, assignments, ...Object.fromEntries(Object.keys(q).map((k, i) => [k, rows[i]])) };
  if (out.users !== undefined && can("users")) out.users = out.users.map(({ id, ...u }) => publicUser({ _id: id, ...u }));

  const attendance = {};
  for (const d of attendanceDocs) {
    if (!ownStudents) { attendance[d._id] = d.marks; continue; }
    const marks = Object.fromEntries(Object.entries(d.marks || {}).filter(([sid]) => ownStudents.includes(sid)));
    if (Object.keys(marks).length) attendance[d._id] = marks;
  }
  return { db: out, attendance, school: settings.school, permissions: settings.permissions, routine: settings.routine };
}

let indexesReady = null;
/** Creates the indexes the role filters use (once per server instance; cheap no-op if they exist). */
export function ensureIndexes() {
  // Must match the definitions scripts/seed-db.mjs creates. A failure is logged, never fatal.
  indexesReady ||= getDb().then((db) => Promise.allSettled([
    db.collection("grades").createIndex({ studentId: 1, year: 1, published: 1 }),
    db.collection("grades").createIndex({ year: 1, class: 1, subject: 1, term: 1 }),
    db.collection("activities").createIndex({ year: 1, class: 1, subject: 1, term: 1 }),
    db.collection("attendance").createIndex({ class: 1, date: 1 }, { unique: true }),
    db.collection("assignments").createIndex({ teacherId: 1 }),
    db.collection("attendance").createIndex({ year: 1, class: 1 }),
    db.collection("notices").createIndex({ year: 1, audience: 1 }),
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ resetTokenHash: 1 }, { sparse: true }),
    db.collection("sessions").createIndex({ userId: 1 }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ])).then((results) => {
    for (const r of results) if (r.status === "rejected") console.error("[indexes]", r.reason?.message);
  }, (e) => { indexesReady = null; console.error("[indexes]", e?.message); });
  return indexesReady;
}

/** Checks that a teacher may change this grade/activity/attendance/notice record. Admins pass. */
export function checkScope(ctx, user, col, rec) {
  if (ctx.isAdmin || !rec) return;
  if (user.role !== "teacher") deny();
  if (col === "grades" || col === "activities") {
    if (!ctx.scope.pairs.has(`${rec.class}|${rec.subject}`)) deny("You can only change grades for classes and subjects you teach.");
  } else if (col === "notices") {
    const cls = audienceClass(rec.audience);
    if (cls && !ctx.scope.classes.has(cls)) deny("You can only post to the whole school or to classes you teach.");
  }
}

export const VALID = { CLASSES, LEVELS, MODULES, ROLES, isLocked };
