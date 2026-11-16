// GET  /api/data            →  everything the signed-in user may read
// GET  /api/data?backup=1   →  full backup file (Super Admin only)
// POST /api/data { op, … }  →  one change, checked against the permission matrix and teacher scope
import { currentUser } from "./_lib/auth.js";
import { COLLECTIONS, HttpError, MODULE_OF, VALID, bad, bootstrap, checkId, checkScope, clean, context, deny, loadSettings, toClient } from "./_lib/access.js";
import { CLASSES, DATA, SEED } from "../src/data.js";
import { DEFAULT_PERMISSIONS } from "../src/lib/permissions.js";
import { allow, readJson, sameOriginJson, send } from "./_lib/http.js";

const MAX_BATCH = 2000;
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const withId = (rows) => rows.map(({ id, ...rest }) => ({ _id: id, ...rest }));

export default async function handler(req, res) {
  if (!allow(req, res, ["GET", "POST"])) return;
  try {
    const user = await currentUser(req);
    if (!user) return send(res, 401, { ok: false, error: "Your session has ended. Please sign in again." });

    if (req.method === "GET") {
      if (req.query?.backup ?? new URL(req.url, "http://x").searchParams.get("backup")) return send(res, 200, { ok: true, backup: await exportBackup(user) });
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
      if (body.col === "notices") Object.assign(item, { author: user.name, authorId: user._id });
      checkScope(ctx, user, body.col, item);
      try { await coll.insertOne({ _id: id, ...item }); } catch (e) { if (e?.code === 11000) bad("A record with this id already exists."); throw e; }
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
        if (body.col === "notices" && !ctx.isAdmin && rec.authorId !== user._id && !(rec.authorId === undefined && rec.author === user.name)) deny("You can only delete your own announcements.");
      }
      await coll.deleteMany({ _id: { $in: existing.map((r) => r._id) } });
      return {};
    }

    case "upsertMany": {
      const coll = colOf(body.col);
      if (!Array.isArray(body.items) || body.items.length > MAX_BATCH) bad("Invalid list of records.");
      const items = body.items.map((it) => clean(it));
      const ids = items.map((it) => checkId(body.col, it?.id));
      const existing = new Map((await coll.find({ _id: { $in: ids } }).toArray()).map((r) => [r._id, r]));
      const ops = items.map(({ id, ...rest }) => {
        const before = existing.get(id);
        checkScope(ctx, user, body.col, before);
        const after = { ...before, ...rest, _id: id };
        checkScope(ctx, user, body.col, after);
        return { replaceOne: { filter: { _id: id }, replacement: after, upsert: true } };
      });
      if (ops.length) await coll.bulkWrite(ops, { ordered: true });
      return {};
    }

    case "attendance": {
      needEdit("attendance");
      const [cls, date] = String(body.key || "").split("|");
      if (!CLASSES.includes(cls) || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) bad("Invalid class or date.");
      if (!ctx.isAdmin && !ctx.scope.classes.has(cls)) deny("You can only take attendance for classes you teach.");
      const marks = clean(body.marks);
      if (!isObj(marks) || Object.entries(marks).some(([sid, v]) => !sid.startsWith("STU-") || !["P", "A", "L"].includes(v))) bad("Invalid attendance marks.");
      await db.collection("attendance").updateOne({ _id: `${cls}|${date}` }, { $set: { class: cls, date, marks } }, { upsert: true });
      return {};
    }

    case "school": {
      needEdit("school");
      const patch = clean(body.patch);
      if (!isObj(patch)) bad("Invalid school settings.");
      const { school } = await loadSettings(db);
      await db.collection("settings").updateOne({ _id: "school" }, { $set: { value: { ...school, ...patch } } }, { upsert: true });
      return {};
    }

    case "slot": {
      needEdit("routine");
      const { cls, day, period, subject } = body;
      if (!CLASSES.includes(cls) || !Number.isInteger(day) || day < 0 || day >= DATA.DAYS.length || !Number.isInteger(period) || period < 0 || period >= DATA.PERIODS.length) bad("Invalid timetable slot.");
      if (typeof subject !== "string" || subject.length > 60 || subject.includes("$")) bad("Invalid subject.");
      const { routine } = await loadSettings(db);
      routine[cls][day][period] = { subject };
      await db.collection("settings").updateOne({ _id: "routine" }, { $set: { value: routine } }, { upsert: true });
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
        const list = data.db[c];
        if (!Array.isArray(list)) bad(`The backup is missing ${c}.`);
        rows[c] = list.map((r) => { const x = clean(r); checkId(c, x?.id); return x; });
      }
      if (!rows.users.some((u) => u.role === "superadmin" && u.status === "active" && u.passwordHash)) bad("The backup has no active Super Admin with a password, so restoring it would lock everyone out.");
      await replaceAll(db, {
        rows, attendance: isObj(data.attendance) ? clean(data.attendance) : {},
        school: isObj(data.school) ? clean(data.school) : SEED.school,
        permissions: isObj(data.permissions) ? clean(data.permissions) : DEFAULT_PERMISSIONS,
        routine: isObj(data.routine) ? clean(data.routine) : DATA.routine,
      });
      return {};
    }

    case "reset":
      if (user.role !== "superadmin") deny("Only the Super Admin can reset the demo data.");
      await replaceAll(db, {
        rows: Object.fromEntries(COLLECTIONS.map((c) => [c, c === "users" ? SEED.users : DATA[c]])),
        attendance: {}, school: SEED.school, permissions: DEFAULT_PERMISSIONS, routine: DATA.routine,
      });
      return {};

    default:
      return bad("Unknown operation.");
  }
}

/** Replaces all school data (used by restore and reset). Sessions are kept; removed accounts lose access on their next request. */
async function replaceAll(db, { rows, attendance, school, permissions, routine }) {
  for (const c of COLLECTIONS) {
    await db.collection(c).deleteMany({});
    if (rows[c].length) await db.collection(c).insertMany(withId(rows[c]), { ordered: true });
  }
  await db.collection("attendance").deleteMany({});
  const att = Object.entries(attendance)
    .filter(([key, marks]) => isObj(marks) && /^[^|]+\|\d{4}-\d{2}-\d{2}$/.test(key))
    .map(([key, marks]) => ({ _id: key, class: key.split("|")[0], date: key.split("|")[1], marks }));
  if (att.length) await db.collection("attendance").insertMany(att);
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
  // Includes password hashes so accounts keep working after a restore. Keep backup files private.
  return { app: "brighterstep", version: 1, exportedAt: new Date().toISOString(), data: { db: out, attendance, school, permissions, routine } };
}
