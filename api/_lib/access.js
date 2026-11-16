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
      if (k.startsWith("$") || k.includes(".") || k === "__proto__" || k === "constructor" || k === "prototype" || k.length > 100) bad("Invalid field name.");
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
  if (col === "grades" ? !/^[A-Z0-9-]+\|[^|$]{1,60}\|[A-Z0-9]{1,6}$/i.test(id) : !(id.startsWith(PREFIX[col]) && id.length > PREFIX[col].length && /^[^$\u0000-\u001f]+$/.test(id))) bad("Invalid id.");
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
  const settings = await loadSettings(db);
  const can = (module, need = "view") => allows(settings.permissions, module, user.role, need);
  let scope = { classes: new Set(), pairs: new Set() };
  if (user.role === "teacher") {
    const [assignments, teachers] = await Promise.all([
      db.collection("assignments").find({ teacherId: user.teacherId || "-" }).toArray(),
      db.collection("teachers").find({ _id: user.teacherId || "-" }).toArray(),
    ]);
    scope = teacherScope(user, assignments, teachers);
  }
  return { db, settings, can, scope, isAdmin: ADMINS.includes(user.role) };
}

const audienceClass = (aud) => (aud && aud !== WHOLE_SCHOOL ? String(aud).replace(/^Class /, "") : null);
const teacherCard = ({ id, name, subject, class: cls, gender, color, photo }) => ({ id, name, subject, class: cls, gender, color, photo });

/** Everything this user may read, in the shape the app's data store uses. */
export async function bootstrap(user) {
  const ctx = await context(user);
  const { db, settings, can, scope, isAdmin } = ctx;
  const all = Object.fromEntries(await Promise.all(COLLECTIONS.map(async (c) => [c, (await db.collection(c).find({}).toArray()).map(toClient)])));
  const attendanceDocs = await db.collection("attendance").find({}).toArray();
  const self = publicUser(await db.collection("users").findOne({ _id: user._id }));
  const out = { classes: all.classes, subjects: all.subjects, assignments: all.assignments };
  let attendance = {};

  if (isAdmin || user.role === "teacher") {
    const inClass = (cls) => isAdmin || scope.classes.has(cls);
    out.students = can("students") ? all.students : [];
    out.teachers = can("teachers") ? all.teachers : all.teachers.map(teacherCard);
    out.grades = can("grades") ? all.grades.filter((g) => isAdmin || scope.pairs.has(`${g.class}|${g.subject}`) || scope.classes.has(g.class)) : [];
    out.activities = can("grades") ? all.activities.filter((a) => isAdmin || scope.pairs.has(`${a.class}|${a.subject}`)) : [];
    out.notices = all.notices.filter((n) => isAdmin || !audienceClass(n.audience) || inClass(audienceClass(n.audience)));
    out.users = can("users") ? all.users.map(({ id, ...u }) => publicUser({ _id: id, ...u })) : [self];
    if (can("attendance")) for (const d of attendanceDocs) if (inClass(d.class)) attendance[d._id] = d.marks;
  } else {
    // Students and parents: only their own (or their children's) records.
    const mine = new Set(user.role === "student" ? [user.studentId] : user.childIds || []);
    out.students = all.students.filter((s) => mine.has(s.id));
    const myClasses = new Set(out.students.map((s) => s.class));
    out.teachers = all.teachers.map(teacherCard);
    out.grades = all.grades.filter((g) => g.published && mine.has(g.studentId));
    out.activities = [];
    out.notices = all.notices.filter((n) => !audienceClass(n.audience) || myClasses.has(audienceClass(n.audience)));
    out.users = [self];
    for (const d of attendanceDocs) {
      if (!myClasses.has(d.class)) continue;
      const marks = Object.fromEntries(Object.entries(d.marks || {}).filter(([sid]) => mine.has(sid)));
      if (Object.keys(marks).length) attendance[d._id] = marks;
    }
  }
  return { db: out, attendance, school: settings.school, permissions: settings.permissions, routine: settings.routine };
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
