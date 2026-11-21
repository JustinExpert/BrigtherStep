// Adds the sample closed school year 2025–2026 to an existing database, built from its current
// students and teaching assignments (see src/samplePastYear.js). For testing past-year report cards.
//
// Run: npm run db:add-past-year            (adds it if it isn't there)
//      npm run db:add-past-year -- --remove  (takes the sample year out again)
// Only touches 2025–2026 records; everything else is left alone.
import { makePastYear, PAST_YEAR } from "../src/samplePastYear.js";
import { connect, dbName, redact, uri } from "./db.mjs";

if (!uri) { console.log("MONGODB_URI is empty in .env — run npm run db:check first."); process.exit(1); }
const remove = process.argv.includes("--remove");

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  const settings = db.collection("settings");
  const school = (await settings.findOne({ _id: "school" }))?.value;
  if (!school?.academicYear?.key) throw new Error("School settings have no school year key. Run npm run db:migrate-years first.");
  if (school.academicYear.key === PAST_YEAR.key) throw new Error(`${PAST_YEAR.label} is the open school year here, so it can't be added as a past year.`);
  if (school.academicYear.start <= PAST_YEAR.end) throw new Error(`The open year starts ${school.academicYear.start}, which isn't after ${PAST_YEAR.label} ends.`);
  const pastYears = school.pastYears || [];
  const has = pastYears.some((y) => y.key === PAST_YEAR.key);

  if (remove) {
    if (!has) { console.log(`${PAST_YEAR.label} isn't in "${dbName}". Nothing changed.`); process.exit(0); }
    const archive = await db.collection("year_archives").findOne({ _id: PAST_YEAR.key });
    if (!archive?.sample) throw new Error(`${PAST_YEAR.label} here wasn't added by this script, so it won't be removed.`);
    const g = await db.collection("grades").deleteMany({ year: PAST_YEAR.key });
    await db.collection("classes").deleteMany({ year: PAST_YEAR.key, sample: true });
    await db.collection("enrollments").deleteMany({ year: PAST_YEAR.key, sample: true });
    await db.collection("year_archives").deleteOne({ _id: PAST_YEAR.key });
    await settings.updateOne({ _id: "school" }, { $set: { "value.pastYears": pastYears.filter((y) => y.key !== PAST_YEAR.key) } });
    console.log(`Removed ${PAST_YEAR.label}: ${g.deletedCount} grades and its snapshot.`);
    process.exit(0);
  }
  if (has) { console.log(`${PAST_YEAR.label} is already in "${dbName}". Nothing changed. (Use -- --remove to take it out.)`); process.exit(0); }

  const [students, assignments, classes] = await Promise.all(["students", "assignments", "classes"].map((c) =>
    db.collection(c).find({}).toArray().then((rows) => rows.map(({ _id, ...r }) => ({ id: _id, ...r })))));
  const routine = (await settings.findOne({ _id: "routine" }))?.value || {};
  const { grades, archive, sections, enrollments } = makePastYear({ students, assignments, classes: classes.filter((c) => c.year === school.academicYear.key), routine });

  const withId = ({ id, ...r }) => ({ _id: id, ...r });
  if (sections.length) await db.collection("classes").insertMany(sections.map(withId), { ordered: false });
  if (grades.length) await db.collection("grades").insertMany(grades.map(withId), { ordered: false });
  if (enrollments.length) await db.collection("enrollments").insertMany(enrollments.map(withId), { ordered: false });
  const { id, ...a } = archive;
  await db.collection("year_archives").replaceOne({ _id: id }, a, { upsert: true });
  const sorted = [...pastYears, PAST_YEAR].sort((x, y) => x.start.localeCompare(y.start)); // oldest first
  await settings.updateOne({ _id: "school" }, { $set: { "value.pastYears": sorted } });
  console.log(`Added ${PAST_YEAR.label} to "${dbName}": ${grades.length} published grades for ${Object.keys(archive.enrollment).length} students, plus the year snapshot.`);
} catch (e) {
  console.log("FAILED: " + redact(e?.message || e));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
