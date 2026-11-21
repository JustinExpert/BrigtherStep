// Upgrade to school levels and sections (one-time, safe to run again).
//   classes      "CLS-01 · Class 01 · section A" → section "01": Elementary, Grade 1 – A, this school year, with its adviser
//   teachers     the old "class teacher of" field is removed (advisers live on sections now)
//   notices      audience "Class 02" → the section "02"
//   enrollments  every student gets an enrolment record for this school year (start of year)
//   2025–2026    if the sample past year is present, it's rebuilt with its own sections and enrolments
// Ids of existing sections stay "01" … "06", so grades, attendance, timetable and assignments are untouched.
//
// Run: npm run db:migrate-sections
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makePastYear, PAST_YEAR } from "../src/samplePastYear.js";
import { connect, dbName, redact, uri } from "./db.mjs";

if (!uri) { console.log("MONGODB_URI is empty in .env — run npm run db:check first."); process.exit(1); }
const toClient = ({ _id, ...r }) => ({ id: _id, ...r });
const withId = ({ id, ...r }) => ({ _id: id, ...r });

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  const school = (await db.collection("settings").findOne({ _id: "school" }))?.value;
  const ay = school?.academicYear;
  if (!ay?.key) throw new Error("No school year key. Run npm run db:migrate-years first.");

  const legacy = await db.collection("classes").find({ grade: { $exists: false } }).toArray();
  const teachersWithClass = await db.collection("teachers").find({ class: { $exists: true } }).toArray();
  const oldAudience = await db.collection("notices").find({ audience: /^Class \d{2}$/ }).toArray();
  const pastArchive = await db.collection("year_archives").findOne({ _id: PAST_YEAR.key });
  const rebuildPast = !!pastArchive?.sample && !(await db.collection("classes").findOne({ year: PAST_YEAR.key }));
  const backupFile = path.join(os.tmpdir(), `brighterstep-before-sections-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ db: dbName, legacy, teachersWithClass, oldAudience, pastArchive }));

  // 1. Sections
  if (legacy.length) {
    const teachers = await db.collection("teachers").find({}, { projection: { name: 1 } }).toArray();
    const idOfTeacher = (name) => teachers.find((t) => t.name === name)?._id || "";
    for (const c of legacy) {
      const code = /^CLS-(\d{2})$/.exec(c._id)?.[1];
      if (!code) { console.log(`  skipped ${c._id}: not a demo class, please set its level/grade by hand`); continue; }
      const section = { _id: code, year: ay.key, level: "elementary", grade: `G${Number(code)}`, name: c.section || "A",
        adviser: idOfTeacher(c.teacher), room: c.room || "", capacity: c.capacity || 40, strand: "" };
      await db.collection("classes").replaceOne({ _id: code }, section, { upsert: true });
      await db.collection("classes").deleteOne({ _id: c._id });
    }
    console.log(`Sections: ${legacy.length} classes became Elementary sections for ${ay.label}.`);
  }
  // 2. Teachers: the class-teacher field moved to sections
  if (teachersWithClass.length) {
    await db.collection("teachers").updateMany({ class: { $exists: true } }, { $unset: { class: "" } });
    console.log(`Teachers: removed the old "class teacher of" field from ${teachersWithClass.length}.`);
  }
  // 3. Announcements addressed to "Class 02" → section "02"
  for (const n of oldAudience) await db.collection("notices").updateOne({ _id: n._id }, { $set: { audience: n.audience.replace(/^Class /, "") } });
  if (oldAudience.length) console.log(`Announcements: ${oldAudience.length} now addressed to their section.`);
  // 4. Enrolments for this school year
  const current = await db.collection("classes").find({ year: ay.key }, { projection: { _id: 1 } }).toArray();
  const students = await db.collection("students").find({ class: { $in: current.map((c) => c._id) } }).toArray();
  const enrolled = new Set((await db.collection("enrollments").find({ year: ay.key }, { projection: { studentId: 1 } }).toArray()).map((e) => e.studentId));
  const missing = students.filter((s) => !enrolled.has(s._id)).map((s) => ({
    _id: `ENR-${s._id}-${ay.key}`, studentId: s._id, year: ay.key, class: s.class, from: ay.start, to: null, reason: "Enrolled", by: "migration", at: new Date().toISOString(),
  }));
  if (missing.length) { await db.collection("enrollments").insertMany(missing, { ordered: false }); console.log(`Enrolments: ${missing.length} students enrolled in their section from ${ay.start}.`); }
  // 5. Sample past year: rebuild with its own sections and enrolments
  if (rebuildPast) {
    await db.collection("grades").deleteMany({ year: PAST_YEAR.key });
    const [st, asg, cls] = await Promise.all(["students", "assignments", "classes"].map((c) => db.collection(c).find({}).toArray().then((r) => r.map(toClient))));
    const routine = (await db.collection("settings").findOne({ _id: "routine" }))?.value || {};
    const past = makePastYear({ students: st, assignments: asg, classes: cls.filter((c) => c.year === ay.key), routine });
    if (past.sections.length) await db.collection("classes").insertMany(past.sections.map(withId));
    if (past.grades.length) await db.collection("grades").insertMany(past.grades.map(withId));
    if (past.enrollments.length) await db.collection("enrollments").insertMany(past.enrollments.map(withId));
    await db.collection("year_archives").replaceOne({ _id: PAST_YEAR.key }, withId(past.archive), { upsert: true });
    console.log(`Sample ${PAST_YEAR.label}: rebuilt with ${past.sections.length} sections, ${past.grades.length} grades, ${past.enrollments.length} enrolments.`);
  }
  if (!legacy.length && !teachersWithClass.length && !oldAudience.length && !missing.length && !rebuildPast) console.log(`Nothing to do: "${dbName}" already uses sections.`);
  else console.log(`Done. Backup of the changed records: ${backupFile}`);
} catch (e) {
  console.log("MIGRATION FAILED: " + redact(e?.message || e));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
