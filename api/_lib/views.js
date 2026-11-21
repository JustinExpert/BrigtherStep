// Data loaded per page (GET /api/data?view=…) instead of all at sign-in, so a large school
// never sends every grade, activity and attendance record to the browser. Everything is for the
// open school year and follows the same permission rules as the rest of the API.
import { bad, context, currentYear, deny, gradeFilter, HttpError, toClient } from "./access.js";

const STAFF_ONLY = "This view is for school staff.";
const isStaff = (ctx, user) => ctx.isAdmin || user.role === "teacher";

/** attendance documents → { "class|date": marks }, optionally only some students' marks. */
function attendanceMap(docs, onlyIds) {
  const out = {};
  for (const d of docs) {
    const marks = onlyIds ? Object.fromEntries(Object.entries(d.marks || {}).filter(([sid]) => onlyIds.includes(sid))) : d.marks;
    if (Object.keys(marks || {}).length) out[d._id] = marks;
  }
  return out;
}

export async function loadView(user, params) {
  const ctx = await context(user);
  const { db, can, scope, isAdmin } = ctx;
  const year = currentYear(ctx.settings);
  const find = async (col, filter) => (await db.collection(col).find(filter).toArray()).map(toClient);
  const gf = gradeFilter(ctx, user);
  const grades = (extra) => (gf ? find("grades", { $and: [gf, { year, ...extra }] }) : []);
  const mayAttendance = (cls) => can("attendance") && (isAdmin || scope.classes.has(cls));
  const view = params.get("view");
  if (!isStaff(ctx, user)) deny(STAFF_ONLY); // students and parents already get all of their own data at sign-in

  switch (view) {
    // One class + subject: every quarter's activities and grades (the gradebook).
    case "gradebook": {
      const cls = params.get("class"), subject = params.get("subject");
      if (!ctx.sections.has(cls) || !subject || subject.length > 60) bad("Choose a class and subject.");
      if (!can("grades") || (!isAdmin && !scope.pairs.has(`${cls}|${subject}`))) deny("You can only open gradebooks for classes and subjects you teach.");
      const [g, activities] = await Promise.all([grades({ class: cls, subject }), find("activities", { year, class: cls, subject })]);
      return { grades: g, activities };
    }

    // One class: its grades and/or attendance (reports, attendance page).
    case "class": {
      const cls = params.get("class");
      if (!ctx.sections.has(cls)) bad("Choose a class.");
      if (!isAdmin && !scope.classes.has(cls)) deny("You can only open classes you teach.");
      const parts = (params.get("parts") || "grades,attendance").split(",");
      const [g, att] = await Promise.all([
        parts.includes("grades") ? grades({ class: cls }) : [],
        parts.includes("attendance") && mayAttendance(cls) ? db.collection("attendance").find({ year, class: cls }).toArray() : [],
      ]);
      return { grades: g, attendance: attendanceMap(att) };
    }

    // One student: their grades and attendance (profile and report card seen by staff).
    case "student": {
      const id = params.get("id");
      if (typeof id !== "string" || !id.startsWith("STU-") || id.length > 40) bad("Invalid student.");
      if (!can("students")) deny();
      const s = await db.collection("students").findOne({ _id: id }, { projection: { class: 1 } });
      if (!s) throw new HttpError(404, "That student no longer exists.");
      // Every section they were in this year, so a transfer doesn't hide earlier attendance.
      const enrolled = await db.collection("enrollments").find({ studentId: id, year }).toArray();
      const sections = [...new Set([s.class, ...enrolled.map((e) => e.class)])].filter(mayAttendance);
      const [g, att] = await Promise.all([
        grades({ studentId: id }),
        sections.length ? db.collection("attendance").find({ year, class: { $in: sections } }).toArray() : [],
      ]);
      const full = can("students") ? await db.collection("students").findOne({ _id: id }) : null;
      return { grades: g, attendance: attendanceMap(att, [id]), enrollments: enrolled.map(toClient), student: full && toClient(full) };
    }

    // One page of the Students list: full records, filtered, searched and sorted by the database.
    // ?level=&class=&q=&sort=name|roll|class|address|dob|phone&dir=1|-1&page=0&per=10 (all=1: up to 10,000 for CSV export)
    case "students": {
      if (!can("students")) deny();
      const int = (k, d) => (Number.isInteger(Number(params.get(k))) ? Number(params.get(k)) : d);
      const per = Math.min(Math.max(int("per", 10), 1), params.get("all") ? 10_000 : 100);
      const page = Math.max(int("page", 0), 0);
      const level = params.get("level"), cls = params.get("class");
      // This year's sections of the level; a teacher only the ones they teach or advise.
      let allowed = [...ctx.sections.values()].filter((s) => s.year === year && (!level || s.level === level)).map((s) => s._id);
      if (!isAdmin) allowed = allowed.filter((id) => scope.classes.has(id));
      if (cls) {
        if (!allowed.includes(cls)) deny("You can only list students in sections you teach.");
        allowed = [cls];
      }
      const filter = { class: { $in: allowed } };
      const q = String(params.get("q") || "").trim().slice(0, 60);
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); // plain text search, never a pattern
        filter.$or = [{ name: rx }, { roll: rx }, { _id: rx }];
      }
      const SORTS = ["name", "roll", "class", "address", "dob", "phone"];
      const key = SORTS.includes(params.get("sort")) ? params.get("sort") : "class";
      const dir = params.get("dir") === "-1" ? -1 : 1;
      const sort = key === "class" ? { class: dir, roll: dir, _id: 1 } : { [key]: dir, _id: 1 };
      const [rows, total] = await Promise.all([
        db.collection("students").find(filter).sort(sort).skip(page * per).limit(per).toArray(),
        db.collection("students").countDocuments(filter),
      ]);
      return { rows: rows.map(toClient), total, page, per };
    }

    // Dashboard figures, calculated by the database.
    case "summary":
      return summary(ctx, user, year);

    default:
      return bad("Unknown view.");
  }
}

/** Present (incl. late) and recorded marks per month, or per student, for attendance matching `match`. */
async function attendanceTotals(db, match, by) {
  const rows = await db.collection("attendance").aggregate([
    { $match: match },
    { $project: { month: { $substrCP: ["$date", 0, 7] }, m: { $objectToArray: "$marks" } } },
    { $unwind: "$m" },
    ...(by.students ? [{ $match: { "m.k": { $in: by.students } } }] : []),
    { $group: {
      _id: by.month ? "$month" : "$m.k",
      days: { $sum: 1 },
      present: { $sum: { $cond: [{ $in: ["$m.v", ["P", "L"]] }, 1, 0] } },
      absent: { $sum: { $cond: [{ $eq: ["$m.v", "A"] }, 1, 0] } },
    } },
  ]).toArray();
  return Object.fromEntries(rows.map((r) => [r._id, { days: r.days, present: r.present, absent: r.absent, rate: Math.round((r.present / r.days) * 100) }]));
}

async function summary(ctx, user, year) {
  const { db, can, scope, isAdmin } = ctx;
  const classes = [...scope.classes];
  const inScope = isAdmin ? {} : { class: { $in: classes } };
  const out = {};

  if (can("attendance")) out.monthly = await attendanceTotals(db, { year, ...inScope }, { month: true });

  // Unpublished grades this year: the whole school for admins (warned about before closing a year).
  if (isAdmin) out.drafts = await db.collection("grades").countDocuments({ year, published: false });

  if (isAdmin && can("grades")) {
    // Top 5 general averages, rounded exactly like the report card (Math.round = floor(x + 0.5)).
    const top = await db.collection("grades").aggregate([
      { $match: { year, published: true } },
      { $group: { _id: { s: "$studentId", subj: "$subject" }, avg: { $avg: "$score" } } },
      { $group: { _id: "$_id.s", finals: { $push: { $floor: { $add: ["$avg", 0.5] } } } } },
      { $project: { average: { $divide: [{ $floor: { $add: [{ $multiply: [{ $avg: "$finals" }, 10] }, 0.5] } }, 10] } } },
      { $sort: { average: -1, _id: 1 } },
      { $limit: 5 },
    ]).toArray();
    const att = can("attendance") ? await attendanceTotals(db, { year }, { students: top.map((t) => t._id) }) : {};
    out.stars = top.map((t) => ({ studentId: t._id, average: t.average, attendanceRate: att[t._id]?.rate ?? null }));
  }

  if (user.role === "teacher") {
    const pairs = [...scope.pairs].map((p) => { const [cls, subject] = p.split("|"); return { class: cls, subject }; });
    out.drafts = pairs.length ? await db.collection("grades").countDocuments({ year, published: false, $or: pairs }) : 0;
    if (can("attendance") && classes.length) {
      const per = await attendanceTotals(db, { year, class: { $in: classes } }, {});
      out.lowAttendance = Object.entries(per).filter(([, v]) => v.rate < 88).map(([studentId, v]) => ({ studentId, ...v })).sort((a, b) => a.rate - b.rate);
    }
  }

  if (user.role === "superadmin") {
    const [grades, activities, attendance] = await Promise.all(["grades", "activities", "attendance"].map((c) => db.collection(c).estimatedDocumentCount()));
    out.counts = { grades, activities, attendance };
  }
  return out;
}
