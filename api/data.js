// GET  /api/data            →  everything the signed-in user may read
// GET  /api/data?backup=1   →  full backup file (Super Admin only)
// POST /api/data { op, … }  →  one change, checked against the permission matrix and teacher scope
import crypto from "node:crypto";
import { currentUser, lockSecondsLeft, recordFailure } from "./_lib/auth.js";
import { COLLECTIONS, HttpError, MODULE_OF, VALID, bad, bootstrap, checkId, checkScope, checkYear, clean, context, deny, gradesForYear, loadSettings, toClient } from "./_lib/access.js";
import { getClient } from "./_lib/db.js";
import { loadView } from "./_lib/views.js";
import { checkRecord, checkRefs, checkSchool, newRefs } from "./_lib/schema.js";
import { enroll, rollSections, transferStudent } from "./_lib/sections.js";
import { todayIso } from "../src/lib/utils.js";
import { LEVEL_KEYS, levelOf, offers, sectionLabel } from "../src/levels.js";
import { DATA, SEED } from "../src/data.js";
import { DEFAULT_PERMISSIONS } from "../src/lib/permissions.js";
import { allow, readJson, sameOriginJson, send } from "./_lib/http.js";

const MAX_BATCH = 2000;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const GRADUATED = "Graduated"; // class given to students who finish the top class
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const withId = (rows) => rows.map(({ id, ...rest }) => ({ _id: id, ...rest }));

export default async function handler(req, res) {
  if (!allow(req, res, ["GET", "POST"])) return;
  try {
    const user = await currentUser(req);
    if (!user) return send(res, 401, { ok: false, error: "Your session has ended. Please sign in again." });

    if (req.method === "GET") {
      const params = new URL(req.url, "http://x").searchParams;
      if (params.get("backup")) return send(res, 200, { ok: true, backup: await exportBackup(user) });
      if (params.get("year")) return send(res, 200, { ok: true, grades: await gradesForYear(user, params.get("year"), params.get("student"), params.get("class")) });
      if (params.get("view")) return send(res, 200, { ok: true, ...(await loadView(user, params)) });
      return send(res, 200, { ok: true, data: await bootstrap(user) });
    }

    const csrf = sameOriginJson(req);
    if (csrf) return send(res, 403, { ok: false, error: csrf });
    const body = await readJson(req, 4 * 1024 * 1024); // a restored backup can be a few MB
    const result = await mutate(user, body);
    return send(res, 200, { ok: true, ...result });
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { ok: false, error: e.message });
    if (e?.status === 413) return send(res, 413, { ok: false, error: "That's too much data for one request." });
    if (e instanceof SyntaxError) return send(res, 400, { ok: false, error: "Invalid request." });
    console.error("[api/data]", e?.message);
    return send(res, 503, { ok: false, error: "Couldn't save to the server. Please try again." });
  }
}

async function mutate(user, body) {
  if (!isObj(body)) bad("Invalid request.");
  const { op } = body;
  const ctx = await context(user);
  const { db, can } = ctx;
  const needEdit = (module) => { if (!can(module, "edit")) deny(); };
  const colOf = (col) => {
    if (!MODULE_OF[col]) bad(col === "users" ? "Accounts are changed through /api/users." : "Unknown collection.");
    needEdit(MODULE_OF[col]);
    return db.collection(col);
  };

  switch (op) {
    case "add": {
      const coll = colOf(body.col);
      const item = clean(body.item);
      if (!isObj(item)) bad("Invalid record.");
      const id = checkId(body.col, item.id);
      delete item.id;
      if (body.col === "notices") Object.assign(item, { author: user.name, authorId: user._id, year: ctx.settings.school.academicYear.key });
      checkScope(ctx, user, body.col, item);
      checkYear(ctx, body.col, { ...item, _id: id });
      await checkRefs(db, checkRecord(body.col, item, item, ctx), ctx);
      if (body.col === "classes") await checkSection(db, ctx, id, item);
      if (body.col === "subjects") await checkSubject(db, ctx, id, item, null);
      try { await coll.insertOne({ _id: id, ...item }); } catch (e) { if (e?.code === 11000) bad("A record with this id already exists."); throw e; }
      if (body.col === "students" && ctx.currentSections.has(item.class)) {
        const ay = ctx.settings.school.academicYear, today = todayIso();
        await enroll(db, { studentId: id, cls: item.class, year: ay.key, from: today < ay.start ? ay.start : today > ay.end ? ay.end : today, reason: "Admitted", by: user._id });
      }
      return { record: toClient({ _id: id, ...item }) };
    }

    case "update": {
      const coll = colOf(body.col);
      const id = checkId(body.col, body.id);
      const patch = clean(body.patch);
      if (!isObj(patch)) bad("Invalid change.");
      delete patch.id; delete patch._id;
      if (body.col === "notices") { delete patch.author; delete patch.authorId; }
      const existing = await coll.findOne({ _id: id });
      if (!existing) throw new HttpError(404, "That record no longer exists.");
      checkScope(ctx, user, body.col, existing);
      checkScope(ctx, user, body.col, { ...existing, ...patch });
      checkYear(ctx, body.col, existing);
      checkYear(ctx, body.col, { ...existing, ...patch });
      await checkRefs(db, checkRecord(body.col, patch, { ...existing, ...patch }, ctx), ctx);
      if (body.col === "students" && "class" in patch && patch.class !== existing.class) bad("Use Transfer to move a student to another section (it keeps their history).");
      if (body.col === "classes") {
        if (["year", "level", "grade"].some((k) => k in patch && patch[k] !== existing[k])) bad("A section's school year, level and grade can't be changed. Create a new section instead.");
        await checkSection(db, ctx, id, { ...existing, ...patch });
      }
      if (body.col === "subjects") await checkSubject(db, ctx, id, { ...existing, ...patch }, existing);
      if (body.col === "grades" && ["studentId", "subject", "term", "year"].some((k) => k in patch && patch[k] !== existing[k])) bad("A grade's student, subject, quarter and year can't be changed.");
      if (Object.keys(patch).length) await coll.updateOne({ _id: id }, { $set: patch });
      return {};
    }

    case "remove": {
      const coll = colOf(body.col);
      const ids = [].concat(body.ids).map((id) => checkId(body.col, id));
      if (!ids.length || ids.length > MAX_BATCH) bad("Choose between 1 and 2000 records.");
      const existing = await coll.find({ _id: { $in: ids } }).toArray();
      for (const rec of existing) {
        checkScope(ctx, user, body.col, rec);
        checkYear(ctx, body.col, rec);
        if (body.col === "notices" && !ctx.isAdmin && rec.authorId !== user._id && !(rec.authorId === undefined && rec.author === user.name)) deny("You can only delete your own announcements.");
        if (body.col === "classes") {
          const used = await Promise.all([["students", { class: rec._id }], ["grades", { class: rec._id }], ["attendance", { class: rec._id }], ["enrollments", { class: rec._id }]]
            .map(([c, q]) => db.collection(c).countDocuments(q, { limit: 1 })));
          if (used.some(Boolean)) bad(`${rec.name} still has students or records, so it can't be deleted.`);
        }
        if (body.col === "subjects") {
          const where = await subjectUse(db, rec.name);
          if (where) bad(`${rec.name} is still used by ${where}, so it can't be deleted.`);
        }
      }
      await coll.deleteMany({ _id: { $in: existing.map((r) => r._id) } });
      return {};
    }

    case "upsertMany": {
      const coll = colOf(body.col);
      if (body.col === "subjects") bad("Add or edit subjects one at a time.");
      if (!Array.isArray(body.items) || body.items.length > MAX_BATCH) bad("Invalid list of records.");
      const items = body.items.map((it) => clean(it));
      const ids = items.map((it) => checkId(body.col, it?.id));
      const existing = new Map((await coll.find({ _id: { $in: ids } }).toArray()).map((r) => [r._id, r]));
      const refs = newRefs(); // collected for the whole batch, then checked with one query per kind
      const ops = items.map(({ id, ...rest }) => {
        const before = existing.get(id);
        checkScope(ctx, user, body.col, before);
        checkYear(ctx, body.col, before);
        const after = { ...before, ...rest, _id: id };
        checkScope(ctx, user, body.col, after);
        checkYear(ctx, body.col, after);
        checkRecord(body.col, rest, after, ctx, refs);
        // A grade's id is "year|student|subject|quarter": it must agree with its fields.
        if (body.col === "grades" && id !== `${after.year}|${after.studentId}|${after.subject}|${after.term}`) bad("A grade's id doesn't match its student, subject, quarter and year.");
        return { replaceOne: { filter: { _id: id }, replacement: after, upsert: true } };
      });
      await checkRefs(db, refs, ctx);
      if (ops.length) await coll.bulkWrite(ops, { ordered: true });
      return {};
    }

    case "attendance": {
      needEdit("attendance");
      const [cls, date] = String(body.key || "").split("|");
      if (!ctx.currentSections.has(cls) || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) bad("Invalid class or date.");
      if (!ctx.isAdmin && !ctx.scope.classes.has(cls)) deny("You can only take attendance for classes you teach.");
      const marks = clean(body.marks);
      if (!isObj(marks) || Object.entries(marks).some(([sid, v]) => !sid.startsWith("STU-") || !["P", "A", "L"].includes(v))) bad("Invalid attendance marks.");
      // Attendance belongs to the open school year: only its dates can be recorded or changed.
      const ay = ctx.settings.school.academicYear;
      if (date < ay.start || date > ay.end) bad(`Attendance can only be recorded for dates in the current school year (${ay.start} to ${ay.end}).`);
      await db.collection("attendance").updateOne({ _id: `${cls}|${date}` }, { $set: { class: cls, date, marks, year: ay.key } }, { upsert: true });
      return {};
    }

    case "school": {
      needEdit("school");
      const patch = clean(body.patch);
      if (!isObj(patch)) bad("Invalid school settings.");
      const { school } = await loadSettings(db);
      // The year's label and dates can be edited; its key and the list of past years change only via "newYear".
      const y = isObj(patch.academicYear) ? patch.academicYear : {};
      const academicYear = { ...school.academicYear, ...pick(y, ["label", "start", "end"]), key: school.academicYear.key };
      const next = { ...school, ...patch, academicYear, pastYears: school.pastYears || [] };
      checkSchool(patch, next, ctx);
      // A College program in use can't be removed, or shortened below a year level that has sections.
      for (const s of [...ctx.sections.values()].filter((x) => x.program && x.year === school.academicYear.key)) {
        const p = next.programs.find((x) => x.code === s.program);
        if (!p) bad(`Program ${s.program} still has sections this year (${sectionLabel(s)}), so it can't be removed.`);
        if (Number(s.grade.slice(1)) > p.years) bad(`${p.code} has a ${s.grade.replace("Y", "year ")} section (${sectionLabel(s)}), so it can't be shorter than that.`);
      }
      const usedBy = ctx.subjects.find((x) => (x.programs || []).some((c) => !next.programs.some((p) => p.code === c)));
      if (usedBy) bad(`${usedBy.name} is limited to a program you removed. Change the subject first.`);
      const usedStrand = ctx.subjects.find((x) => (x.strands || []).some((c) => !next.strands.includes(c)));
      if (usedStrand) bad(`${usedStrand.name} is limited to a strand you removed. Change the subject first.`);
      await db.collection("settings").updateOne({ _id: "school" }, { $set: { value: next } }, { upsert: true });
      return {};
    }

    case "newYear": {
      // Closes the open school year (its grades become read-only) and opens the next one.
      needEdit("school");
      const { school } = await loadSettings(db);
      const cur = school.academicYear;
      const { start, end } = body;
      const label = typeof body.label === "string" ? body.label.trim() : "";
      if (!label || label.length > 20) bad("Enter a label for the new school year (e.g. 2027–2028).");
      if (![start, end].every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) || start >= end) bad("The new school year must end after it starts.");
      if (start <= cur.start) bad(`The new school year must start after ${cur.label} started (${cur.start}).`);
      const key = `${start.slice(0, 4)}-${end.slice(0, 4)}`;
      if (key === cur.key || (school.pastYears || []).some((p) => p.key === key)) bad(`School year ${key} already exists.`);
      const next = { ...school, academicYear: { key, label, start, end }, pastYears: [...(school.pastYears || []), pick(cur, ["key", "label", "start", "end"])] };

      // One transaction: either the year changes *and* students move up, or nothing changes.
      const session = (await getClient()).startSession();
      let promoted = 0, graduated = 0, sections = 0;
      try {
        // Snapshot of the closing year's setup, which changes once the new year starts:
        // classes, teaching assignments, timetable and which class each student was in.
        const [classes, assignments, enrolled] = await Promise.all([
          db.collection("classes").find({ year: cur.key }).toArray(), db.collection("assignments").find({}).toArray(),
          db.collection("students").find({}, { projection: { class: 1 } }).toArray(),
        ]);
        const { routine } = await loadSettings(db);
        await session.withTransaction(async () => {
          await db.collection("year_archives").replaceOne({ _id: cur.key }, {
            _id: cur.key, label: cur.label, start: cur.start, end: cur.end, closedAt: new Date().toISOString(), closedBy: user._id,
            classes, assignments, routine, enrollment: Object.fromEntries(enrolled.map((s) => [s._id, s.class])),
          }, { upsert: true, session });
          await db.collection("settings").updateOne({ _id: "school" }, { $set: { value: next } }, { upsert: true, session });
          // New sections for the new year; students move up a grade (or stay, without promotion).
          ({ promoted, graduated, sections } = await rollSections(db, ctx, { cur, next: next.academicYear, promote: body.promote === true, by: user._id }, session));
        });
      } finally {
        await session.endSession();
      }
      return { year: next.academicYear, promoted, graduated, sections };
    }

    case "levels": {
      // Which levels this school may use. Only the vendor changes it: Super Admin account + the VENDOR_KEY code.
      if (user.role !== "superadmin") deny("Only the Super Admin can open the Levels page.");
      const key = process.env.VENDOR_KEY || "";
      if (key.length < 16) bad("Level changes are switched off on this copy: no vendor code (VENDOR_KEY) is set up.");
      const lockId = `vendor:${user._id}`;
      const wait = await lockSecondsLeft(db, lockId);
      if (wait) deny(`Too many wrong codes. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? "s" : ""}.`);
      const got = crypto.createHash("sha256").update(String(body.code ?? "")).digest();
      if (!crypto.timingSafeEqual(got, crypto.createHash("sha256").update(key).digest())) {
        await recordFailure(db, lockId);
        deny("That vendor code isn't right.");
      }
      await db.collection("login_attempts").deleteOne({ _id: lockId });
      const list = Array.isArray(body.levels) ? body.levels : [];
      if (list.some((k) => !levelOf(k))) bad("Unknown level.");
      if (list.some((k) => !levelOf(k).available)) bad(`${list.map(levelOf).find((l) => !l.available).label} isn't available yet.`);
      const levels = LEVEL_KEYS.filter((k) => list.includes(k));
      if (!levels.length) bad("Turn on at least one level.");
      await db.collection("settings").updateOne({ _id: "levels" }, { $set: { value: levels, by: user._id, at: new Date().toISOString() } }, { upsert: true });
      return { levels };
    }

    case "transfer":
      return { transfer: await transferStudent(db, ctx, user, body) };

    case "slot": {
      needEdit("routine");
      const { cls, day, period, subject } = body;
      if (!ctx.currentSections.has(cls) || !Number.isInteger(day) || day < 0 || day >= DATA.DAYS.length || !Number.isInteger(period) || period < 0 || period >= DATA.PERIODS.length) bad("Invalid timetable slot.");
      if (typeof subject !== "string" || subject.length > 60 || subject.includes("$")) bad("Invalid subject.");
      if (subject && !offers(ctx.subjectByName.get(subject), ctx.sections.get(cls))) bad(`${sectionLabel(ctx.sections.get(cls))} doesn't take ${subject}.`);
      const { routine } = await loadSettings(db);
      routine[cls] ||= DATA.DAYS.map(() => DATA.PERIODS.map(() => ({ subject: "" }))); // a new section starts with a free week
      routine[cls][day][period] = { subject };
      await db.collection("settings").updateOne({ _id: "routine" }, { $set: { value: routine } }, { upsert: true });
      return {};
    }

    case "periods": {
      // Start times of the timetable periods, shared by every section ("08:00" … in order).
      needEdit("routine");
      const p = body.periods;
      if (!Array.isArray(p) || p.length !== DATA.PERIODS.length || p.some((t) => typeof t !== "string" || !TIME_RE.test(t))) bad(`Give ${DATA.PERIODS.length} start times like 08:00.`);
      if (p.some((t, i) => i && t <= p[i - 1])) bad("Each period must start after the one before it.");
      await db.collection("settings").updateOne({ _id: "school" }, { $set: { "value.periods": p } });
      return {};
    }

    case "permission": {
      needEdit("roles");
      const { module, role, level } = body;
      if (!VALID.MODULES.some((m) => m.key === module) || !VALID.ROLES.some((r) => r.key === role) || !VALID.LEVELS.includes(level)) bad("Invalid permission.");
      if (VALID.isLocked(module, role)) deny("That permission is fixed and can't be changed.");
      const { permissions } = await loadSettings(db);
      permissions[module][role] = level;
      await db.collection("settings").updateOne({ _id: "permissions" }, { $set: { value: permissions } }, { upsert: true });
      return {};
    }

    case "resetPermissions":
      needEdit("roles");
      await db.collection("settings").updateOne({ _id: "permissions" }, { $set: { value: DEFAULT_PERMISSIONS } }, { upsert: true });
      return {};

    case "restore": {
      if (user.role !== "superadmin") deny("Only the Super Admin can restore a backup.");
      const data = body.backup?.data;
      if (body.backup?.app !== "brighterstep" || !isObj(data) || !isObj(data.db)) bad("That file isn't a valid BrighterStep backup.");
      const rows = {};
      for (const c of COLLECTIONS) {
        const list = data.db[c] ?? (c === "enrollments" ? [] : undefined); // backups from before enrolment history have none
        if (!Array.isArray(list)) bad(`The backup is missing ${c}.`);
        rows[c] = list.map((r) => clean(r));
      }
      // Backups made before school years existed: tag their records so they restore cleanly.
      const school0 = isObj(data.school) ? data.school : SEED.school;
      const backupYear = school0.academicYear?.key || `${String(school0.academicYear?.start || "").slice(0, 4)}-${String(school0.academicYear?.end || "").slice(0, 4)}`;
      if (!/^\d{4}-\d{4}$/.test(backupYear)) bad("The backup's school year is missing or invalid.");
      rows.grades = rows.grades.map((g) => (g.year ? g : { ...g, year: backupYear, id: `${backupYear}|${g.id}` }));
      for (const c of ["activities", "notices"]) rows[c] = rows[c].map((r) => (r.year ? r : { ...r, year: backupYear }));
      for (const c of COLLECTIONS) rows[c].forEach((x) => checkId(c, x?.id));
      if (!rows.users.some((u) => u.role === "superadmin" && u.status === "active" && u.passwordHash)) bad("The backup has no active Super Admin with a password, so restoring it would lock everyone out.");
      await replaceAll(db, {
        rows, attendance: isObj(data.attendance) ? clean(data.attendance) : {},
        school: (() => { const s = isObj(data.school) ? clean(data.school) : structuredClone(SEED.school); s.academicYear = { ...s.academicYear, key: backupYear }; s.pastYears ||= []; return s; })(),
        permissions: isObj(data.permissions) ? clean(data.permissions) : DEFAULT_PERMISSIONS,
        routine: isObj(data.routine) ? clean(data.routine) : DATA.routine,
        archives: Array.isArray(data.archives) ? data.archives.map((a) => clean(a)) : [],
      });
      return {};
    }

    case "reset":
      if (user.role !== "superadmin") deny("Only the Super Admin can reset the demo data.");
      await replaceAll(db, {
        rows: Object.fromEntries(COLLECTIONS.map((c) => [c, c === "users" ? SEED.users : DATA[c]])),
        attendance: DATA.attendance, school: SEED.school, permissions: DEFAULT_PERMISSIONS, routine: DATA.routine, archives: DATA.archives,
      });
      return {};

    default:
      return bad("Unknown operation.");
  }
}

/** A new or edited section: this school year's, and its name unique within its grade (and College program). */
async function checkSection(db, ctx, id, sec) {
  if (sec.year !== ctx.settings.school.academicYear.key) bad("Sections are created for the current school year.");
  // College: unique within the program and year level (BSIT 1st Year – A and BSBA 1st Year – A can both exist).
  const twin = await db.collection("classes").findOne({ _id: { $ne: id }, year: sec.year, grade: sec.grade, name: sec.name, ...(sec.program ? { program: sec.program } : { program: { $in: [null, ""] } }) });
  if (twin) bad(`There's already a section called "${sec.name}" in ${sec.program ? sec.program + " " : ""}that grade this year.`);
}

/** Where a subject (by name) is still used, e.g. "3 grades", or null. Grades, activities, assignments and teachers refer to it by name. */
async function subjectUse(db, name) {
  const counts = await Promise.all(["teachers", "assignments", "grades", "activities"].map((c) => db.collection(c).countDocuments({ subject: name }, { limit: 1 })));
  const used = ["a teacher", "a teaching assignment", "grades", "gradebook activities"].filter((_, i) => counts[i]);
  return used.length ? used.join(", ") : null;
}

/**
 * A new or edited subject: its name is unique, a used subject keeps its name (records refer to it by name),
 * and it isn't taken away from a section that still has a teacher assigned for it.
 */
async function checkSubject(db, ctx, id, sub, existing) {
  const twin = ctx.subjects.find((x) => x._id !== id && x.name.trim().toLowerCase() === sub.name.trim().toLowerCase());
  if (twin) bad(`There's already a subject called "${twin.name}".`);
  if (existing && existing.name !== sub.name) {
    const where = await subjectUse(db, existing.name);
    if (where) bad(`${existing.name} is already used by ${where}, so its name can't be changed. Add a new subject instead.`);
  }
  if (existing) {
    const left = (await db.collection("assignments").find({ subject: existing.name }).toArray())
      .map((a) => ctx.sections.get(a.class)).filter((sec) => sec && !offers(sub, sec));
    if (left.length) bad(`${left.map((sec) => sectionLabel(sec)).join(", ")} still ${left.length > 1 ? "have" : "has"} a teacher assigned for ${existing.name}. Unassign it on Teaching Assignments first.`);
  }
}

/** Replaces all school data (used by restore and reset). Sessions are kept; removed accounts lose access on their next request. */
async function replaceAll(db, { rows, attendance, school, permissions, routine, archives = [] }) {
  for (const c of COLLECTIONS) {
    await db.collection(c).deleteMany({});
    if (rows[c].length) await db.collection(c).insertMany(withId(rows[c]), { ordered: true });
  }
  // Each attendance day belongs to the school year whose dates contain it (else the open year).
  const years = [school.academicYear, ...(school.pastYears || [])];
  const yearOf = (date) => years.find((y) => y?.start && date >= y.start && date <= y.end)?.key || school.academicYear.key;
  await db.collection("attendance").deleteMany({});
  const att = Object.entries(attendance)
    .filter(([key, marks]) => isObj(marks) && /^[^|]+\|\d{4}-\d{2}-\d{2}$/.test(key))
    .map(([key, marks]) => { const [cls, date] = key.split("|"); return { _id: key, class: cls, date, marks, year: yearOf(date) }; });
  if (att.length) await db.collection("attendance").insertMany(att);
  await db.collection("year_archives").deleteMany({});
  const arch = archives.filter((a) => isObj(a) && /^\d{4}-\d{4}$/.test(a.id || a._id || "")).map(({ id, ...a }) => ({ ...a, _id: a._id || id }));
  if (arch.length) await db.collection("year_archives").insertMany(arch);
  for (const [id, value] of Object.entries({ school, permissions, routine })) {
    await db.collection("settings").updateOne({ _id: id }, { $set: { value } }, { upsert: true });
  }
}

async function exportBackup(user) {
  if (user.role !== "superadmin") deny("Only the Super Admin can download a backup.");
  const { db } = await context(user);
  const out = {};
  for (const c of COLLECTIONS) out[c] = (await db.collection(c).find({}).toArray()).map(toClient);
  const attendance = Object.fromEntries((await db.collection("attendance").find({}).toArray()).map((d) => [d._id, d.marks]));
  const { school, permissions, routine } = await loadSettings(db);
  const archives = (await db.collection("year_archives").find({}).toArray()).map(toClient);
  // Includes password hashes so accounts keep working after a restore. Keep backup files private.
  return { app: "brighterstep", version: 1, exportedAt: new Date().toISOString(), data: { db: out, attendance, school, permissions, routine, archives } };
}
