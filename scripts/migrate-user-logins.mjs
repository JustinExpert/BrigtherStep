// Upgrade for student-ID sign-in (one-time, safe to run again).
//   users.email index  unique → unique + sparse, so student accounts with no email are allowed
//                      (they sign in with their student ID). Emails stay unique.
//   users.studentId    new index for signing in with a student ID.
// No account is changed. Reports students with more than one student login: only their
// emails work for signing in until an admin removes the extra login.
//
// Run: npm run db:migrate-user-logins
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { connect, dbName, redact, uri } from "./db.mjs";

if (!uri) { console.log("MONGODB_URI is empty in .env — run npm run db:check first."); process.exit(1); }

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  const users = db.collection("users");
  const indexes = await users.indexes();
  const backupFile = path.join(os.tmpdir(), `brighterstep-user-indexes-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ db: dbName, indexes }, null, 2));

  // Nothing to fix if an account has an empty email (sparse only skips a missing field).
  const blank = await users.countDocuments({ $or: [{ email: null }, { email: "" }], email: { $exists: true } });
  if (blank) { console.log(`Stopped: ${blank} account(s) have an empty email. Fix them first, then run again.`); process.exit(1); }

  const old = indexes.find((i) => i.name === "email_1");
  if (old && !old.sparse) {
    // MongoDB can't hold two indexes on { email: 1 }, so the old one goes first. The gap is a
    // moment; run this when nobody is creating accounts.
    await users.dropIndex("email_1");
    await users.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log("users.email: now unique only when set (student accounts may have no email).");
  } else console.log("users.email: already up to date.");
  await users.createIndex({ studentId: 1 }, { sparse: true });
  console.log("users.studentId: index ready.");

  const dupes = await users.aggregate([
    { $match: { role: "student", studentId: { $type: "string" } } },
    { $group: { _id: "$studentId", n: { $sum: 1 }, accounts: { $push: "$_id" } } },
    { $match: { n: { $gt: 1 } } },
  ]).toArray();
  for (const d of dupes) console.log(`  Student ${d._id} has ${d.n} logins (${d.accounts.join(", ")}): remove the extra one in User Management.`);
  console.log(`Done on ${dbName}. Index list saved to ${backupFile}`);
} catch (e) {
  console.error("Migration failed:", redact(e.message));
  process.exitCode = 1;
} finally {
  await client?.close();
}
