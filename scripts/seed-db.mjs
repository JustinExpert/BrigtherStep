// Loads the BrighterStep sample data into MongoDB Atlas.
// Run: npm run db:seed            (only fills an empty database)
//      npm run db:seed -- --reset (deletes BrighterStep data first, then reloads the sample)
import { DATA, SEED } from "../src/data.js";
import { DEFAULT_PERMISSIONS } from "../src/lib/permissions.js";
import { connect, dbName, redact, uri } from "./db.mjs";

const COLLECTIONS = ["students", "teachers", "notices", "classes", "subjects", "users", "assignments", "grades", "activities", "enrollments"];
const reset = process.argv.includes("--reset");

if (!uri) { console.log("MONGODB_URI is empty in .env — run npm run db:check first."); process.exit(1); }

// Our records already have stable string ids (STU-43100, USR-1 …); MongoDB keeps them as _id.
const withId = (rows) => rows.map(({ id, ...rest }) => ({ _id: id, ...rest }));

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  const hasData = COLLECTIONS.some((c) => existing.includes(c));

  if (hasData && !reset) {
    console.log(`Database "${dbName}" already has BrighterStep data. Nothing changed.`);
    console.log("To start over from the sample data, run:  npm run db:seed -- --reset");
    process.exit(0);
  }
  if (reset) {
    for (const c of [...COLLECTIONS, "settings", "attendance", "year_archives"]) if (existing.includes(c)) await db.collection(c).drop();
    console.log("Removed the existing BrighterStep data.");
  }

  const counts = {};
  for (const c of COLLECTIONS) {
    const rows = withId(c === "users" ? SEED.users : DATA[c]);
    if (rows.length) await db.collection(c).insertMany(rows, { ordered: true });
    counts[c] = rows.length;
  }
  // Single documents: school profile, permission matrix, timetable.
  await db.collection("settings").insertMany([
    { _id: "school", value: SEED.school },
    { _id: "permissions", value: DEFAULT_PERMISSIONS },
    { _id: "routine", value: DATA.routine },
  ]);
  await db.collection("attendance").createIndex({ class: 1, date: 1 }, { unique: true });
  // Sample attendance: every school day of the first year up to the demo's "today".
  const attendance = Object.entries(DATA.attendance).map(([key, marks]) => {
    const [cls, date] = key.split("|");
    return { _id: key, class: cls, date, marks, year: SEED.school.academicYear.key };
  });
  if (attendance.length) await db.collection("attendance").insertMany(attendance);
  // Snapshot of the sample closed year (2025–2026); its grades are in DATA.grades.
  await db.collection("year_archives").insertMany(DATA.archives.map(({ id, ...a }) => ({ _id: id, ...a })));

  // Indexes for the queries the app makes (and one unique rule: one account per email;
  // sparse because student accounts may have no email and sign in with their student ID).
  await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection("users").createIndex({ studentId: 1 }, { sparse: true });
  await db.collection("students").createIndex({ class: 1, roll: 1 });
  // Grades and activities are always read for one school year, so `year` leads (same as api/_lib/access.js).
  await db.collection("grades").createIndex({ studentId: 1, year: 1, published: 1 });
  await db.collection("grades").createIndex({ year: 1, class: 1, subject: 1, term: 1 });
  await db.collection("activities").createIndex({ year: 1, class: 1, subject: 1, term: 1 });
  await db.collection("attendance").createIndex({ year: 1, class: 1 });
  await db.collection("notices").createIndex({ year: 1, audience: 1 });
  await db.collection("assignments").createIndex({ class: 1, subject: 1 }, { unique: true });
  await db.collection("assignments").createIndex({ teacherId: 1 });
  await db.collection("classes").createIndex({ year: 1, level: 1, grade: 1 });
  await db.collection("enrollments").createIndex({ studentId: 1, year: 1 });
  await db.collection("enrollments").createIndex({ year: 1, class: 1 });

  const total = Object.values(counts).reduce((a, b) => a + b, 0) + 3;
  console.log(`Loaded ${total} records into "${dbName}":`);
  for (const [c, n] of Object.entries(counts)) console.log(`  ${c.padEnd(12)} ${n}`);
  console.log("  settings     3 (school, permissions, routine)");
  console.log(`  attendance   ${attendance.length} (sample school days)`);
} catch (e) {
  console.log("SEED FAILED: " + redact(e?.message || e));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
