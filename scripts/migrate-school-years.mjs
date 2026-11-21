// One-time upgrade: tags existing grades and activities with the school year.
// Before: grade id "STU-1|Mathematics|Q1" (a new year would overwrite it).
// After:  grade id "2026-2027|STU-1|Mathematics|Q1", plus `year` on grades and activities.
//
// Run: npm run db:migrate-years
// Safe to run again: records that already have a year are left alone.
// A JSON backup of the grades, activities and school settings is written first.
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
  const schoolDoc = await settings.findOne({ _id: "school" });
  const school = schoolDoc?.value;
  if (!school?.academicYear?.start || !school?.academicYear?.end) throw new Error("School settings have no academic year. Set it in School Setup first.");

  const year = school.academicYear.key || `${school.academicYear.start.slice(0, 4)}-${school.academicYear.end.slice(0, 4)}`;
  const grades = await db.collection("grades").find({ year: { $exists: false } }).toArray();
  const activities = await db.collection("activities").find({ year: { $exists: false } }).toArray();
  const needsSettings = !school.academicYear.key || !Array.isArray(school.pastYears);

  if (!grades.length && !activities.length && !needsSettings) {
    console.log(`Nothing to do: everything in "${dbName}" already has a school year.`);
    process.exit(0);
  }

  const file = path.join(os.tmpdir(), `brighterstep-before-years-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ db: dbName, school, grades, activities }));
  console.log(`Backup written: ${file}`);

  if (needsSettings) {
    await settings.updateOne({ _id: "school" }, { $set: { "value.academicYear.key": year, "value.pastYears": school.pastYears || [] } });
    console.log(`School year key set to ${year}.`);
  }
  if (activities.length) {
    const r = await db.collection("activities").updateMany({ year: { $exists: false } }, { $set: { year } });
    console.log(`Activities tagged with ${year}: ${r.modifiedCount}`);
  }
  if (grades.length) {
    // New ids start with the year. Insert the new copies first, then remove the old ones.
    const renamed = grades.map(({ _id, ...g }) => ({ ...g, _id: `${year}|${_id}`, year }));
    await db.collection("grades").insertMany(renamed, { ordered: false }).catch((e) => { if (e?.code !== 11000) throw e; });
    const r = await db.collection("grades").deleteMany({ _id: { $in: grades.map((g) => g._id) }, year: { $exists: false } });
    console.log(`Grades moved to ${year}: ${renamed.length} (old copies removed: ${r.deletedCount})`);
  }
  console.log("Done.");
} catch (e) {
  console.log("MIGRATION FAILED: " + redact(e?.message || e));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
