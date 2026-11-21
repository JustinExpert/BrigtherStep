// Upgrade to subjects per grade level (one-time, safe to run again).
//   subjects  the old free-text "classes" field ("Grades 1–6") → a list of grade levels (`grades`) and `strands`.
//             The 9 demo subjects get Grades 1–10 (Mathematics also Nursery to Kindergarten), so their
//             Elementary sections keep every subject they had. Other subjects get Grades 1–6: check them on the Subjects page.
//   catalog   sample Kinder learning domains and Senior High subjects are added (only names that don't exist yet).
// Subject names don't change, so grades, activities, assignments and the timetable are untouched.
//
// Run: npm run db:migrate-subjects
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA } from "../src/data.js";
import { connect, dbName, redact, uri } from "./db.mjs";

if (!uri) { console.log("MONGODB_URI is empty in .env — run npm run db:check first."); process.exit(1); }

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  const seedByName = new Map(DATA.subjects.map((s) => [s.name, s]));
  const old = await db.collection("subjects").find({ grades: { $exists: false } }).toArray();
  const backupFile = path.join(os.tmpdir(), `brighterstep-before-subjects-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ db: dbName, old }));

  // 1. Existing subjects: grade levels instead of the "classes" text
  const G1_6 = ["G1", "G2", "G3", "G4", "G5", "G6"];
  for (const s of old) {
    const grades = seedByName.get(s.name)?.grades || G1_6;
    await db.collection("subjects").updateOne({ _id: s._id }, { $set: { grades, strands: [] }, $unset: { classes: "" } });
    if (!seedByName.has(s.name)) console.log(`  ${s.name}: set to Grades 1–6 (was "${s.classes}") — check it on the Subjects page`);
  }
  if (old.length) console.log(`Subjects: ${old.length} now list their grade levels.`);

  // 2. Sample subjects for Kinder and Senior High (skipped when the name or id is already used)
  const have = await db.collection("subjects").find({}, { projection: { name: 1 } }).toArray();
  const names = new Set(have.map((s) => s.name.toLowerCase())), ids = new Set(have.map((s) => s._id));
  const add = DATA.subjects.filter((s) => !names.has(s.name.toLowerCase()) && !ids.has(s.id)).map(({ id, ...s }) => ({ _id: id, ...s }));
  if (add.length) { await db.collection("subjects").insertMany(add); console.log(`Catalog: added ${add.length} Kinder and Senior High subjects.`); }

  if (!old.length && !add.length) console.log(`Nothing to do: "${dbName}" already has subjects per grade level.`);
  else console.log(`Done. Backup of the changed records: ${backupFile}`);
} catch (e) {
  console.log("MIGRATION FAILED: " + redact(e?.message || e));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
