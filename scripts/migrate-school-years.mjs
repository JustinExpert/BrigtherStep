// Upgrade: puts the school year on every record that belongs to one, and tidies old fields.
//   grades      id "STU-1|Mathematics|Q1"  →  "2026-2027|STU-1|Mathematics|Q1", plus `year`
//   activities  + `year`
//   attendance  + `year` (from the school year whose dates contain the day)
//   notices     + `year` (from the date posted)
//   students    `year` (admission year) → `admittedYear`; sample-only `_r`, `marks`, `percent`, `attendance` removed
//   settings    school.academicYear.key and school.pastYears
//
// Run: npm run db:migrate-years
// Safe to run again: records that are already up to date are left alone.
// A JSON backup of every record it changes is written first.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { connect, dbName, redact, uri } from "./db.mjs";

if (!uri) { console.log("MONGODB_URI is empty in .env — run npm run db:check first."); process.exit(1); }

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  const settings = db.collection("settings");
  const school = (await settings.findOne({ _id: "school" }))?.value;
  if (!school?.academicYear?.start || !school?.academicYear?.end) throw new Error("School settings have no academic year. Set it in School Setup first.");

  const year = school.academicYear.key || `${school.academicYear.start.slice(0, 4)}-${school.academicYear.end.slice(0, 4)}`;
  const years = [{ ...school.academicYear, key: year }, ...(school.pastYears || [])];
  const yearOf = (date) => years.find((y) => typeof date === "string" && date >= y.start && date <= y.end)?.key || year;

  const noYear = { year: { $exists: false } };
  const grades = await db.collection("grades").find(noYear).toArray();
  const activities = await db.collection("activities").find(noYear).toArray();
  const attendance = await db.collection("attendance").find(noYear).toArray();
  const notices = await db.collection("notices").find(noYear).toArray();
  // Sample-only numbers that were never real records (real figures are now calculated from grades and attendance).
  const FAKE = ["_r", "marks", "percent", "attendance"];
  const students = await db.collection("students").find({ $or: [...FAKE, "year"].map((f) => ({ [f]: { $exists: true } })) }).toArray();
  const needsSettings = !school.academicYear.key || !Array.isArray(school.pastYears);

  if (!grades.length && !activities.length && !attendance.length && !notices.length && !students.length && !needsSettings) {
    console.log(`Nothing to do: everything in "${dbName}" is already up to date.`);
    process.exit(0);
  }

  const file = path.join(os.tmpdir(), `brighterstep-before-migration-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ db: dbName, school, grades, activities, attendance, notices, students }));
  console.log(`Backup written: ${file}`);

  if (needsSettings) {
    await settings.updateOne({ _id: "school" }, { $set: { "value.academicYear.key": year, "value.pastYears": school.pastYears || [] } });
    console.log(`School year key set to ${year}.`);
  }
  if (activities.length) {
    const r = await db.collection("activities").updateMany(noYear, { $set: { year } });
    console.log(`Activities tagged with ${year}: ${r.modifiedCount}`);
  }
  if (grades.length) {
    // New ids start with the year. Insert the new copies first, then remove the old ones.
    const renamed = grades.map(({ _id, ...g }) => ({ ...g, _id: `${year}|${_id}`, year }));
    await db.collection("grades").insertMany(renamed, { ordered: false }).catch((e) => { if (e?.code !== 11000) throw e; });
    const r = await db.collection("grades").deleteMany({ _id: { $in: grades.map((g) => g._id) }, ...noYear });
    console.log(`Grades moved to ${year}: ${renamed.length} (old copies removed: ${r.deletedCount})`);
  }
  if (attendance.length) {
    await db.collection("attendance").bulkWrite(attendance.map((a) => ({ updateOne: { filter: { _id: a._id }, update: { $set: { year: yearOf(a.date) } } } })));
    console.log(`Attendance days tagged: ${attendance.length}`);
  }
  if (notices.length) {
    await db.collection("notices").bulkWrite(notices.map((n) => ({ updateOne: { filter: { _id: n._id }, update: { $set: { year: yearOf(n.date) } } } })));
    console.log(`Announcements tagged: ${notices.length}`);
  }
  if (students.length) {
    // `year` on a student was the admission year; it's renamed so it can't be mistaken for the school year.
    await db.collection("students").bulkWrite(students.map((s) => ({ updateOne: {
      filter: { _id: s._id },
      update: { $unset: Object.fromEntries([...FAKE, "year"].map((f) => [f, ""])), ...(s.year !== undefined && s.admittedYear === undefined ? { $set: { admittedYear: s.year } } : {}) },
    } })));
    console.log(`Students tidied (admission year renamed; sample-only marks/percent/attendance removed): ${students.length}`);
  }
  // Index replaced by the year-first one the server creates.
  await db.collection("notices").dropIndex("audience_1").then(() => console.log("Dropped unused index notices.audience_1"), () => {});
  console.log("Done.");
} catch (e) {
  console.log("MIGRATION FAILED: " + redact(e?.message || e));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
