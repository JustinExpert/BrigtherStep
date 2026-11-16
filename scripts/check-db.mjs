// Checks that MONGODB_URI in .env works. Prints only safe details — never the URI or password.
// Run: npm run db:check
import { connect, dbName, redact, uri } from "./db.mjs";

function problemsWith(u) {
  if (!u) return "MONGODB_URI is empty. Paste the connection string after MONGODB_URI= in .env and save.";
  if (/^["']|["']$/.test(u)) return "Remove the quotes around the connection string.";
  if (!/^mongodb(\+srv)?:\/\//.test(u)) return "The value must start with mongodb+srv:// — copy it again from Atlas → Connect → Drivers.";
  if (/<db_password>|<password>|<db_username>/.test(u)) return "Replace <db_username> and <db_password> (including the < >) with the real username and password.";
  if (!/^mongodb(\+srv)?:\/\/[^:@/]+:[^@]+@[^/?]+/.test(u)) return "The string should look like mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/…";
  if (/\.xxxxx\./.test(u)) return "The cluster address is still the example (xxxxx). Copy your real one from Atlas → Connect → Drivers.";
  return null;
}

const problem = problemsWith(uri);
if (problem) { console.log("NOT CONNECTED: " + problem); process.exit(1); }

const user = decodeURIComponent(uri.match(/^mongodb(?:\+srv)?:\/\/([^:@/]+)/)[1]);
const host = uri.match(/@([^/?]+)/)[1];
console.log(`Checking: user "${user}" on host "${host}", database "${dbName}" …`);

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  await db.command({ ping: 1 });
  const info = await db.admin().command({ buildInfo: 1 }).catch(() => null);
  // Prove we can write and read, then clean up.
  const probe = db.collection("_connection_check");
  const { insertedId } = await probe.insertOne({ at: new Date() });
  const found = await probe.findOne({ _id: insertedId });
  await probe.drop().catch(() => {});
  console.log(`CONNECTED ✔  MongoDB ${info?.version || "?"} · write/read test ${found ? "passed" : "FAILED"}`);
  if (user !== "brighterstep-app") console.log(`Note: the string uses user "${user}". For the app, use brighterstep-app (least access).`);
} catch (e) {
  const msg = redact(e?.message || e);
  let hint = "";
  if (/auth|Authentication failed|bad auth/i.test(msg)) hint = "Wrong username or password. Check the password from Step A (and encode @ : / ? # % if it has them).";
  else if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) hint = "The cluster address can't be found. Copy the string again from Atlas, and check your internet.";
  else if (/Server selection timed out|timed out|ECONNREFUSED|whitelist|IP/i.test(msg)) hint = "Atlas refused the connection. Check Network Access → IP Access List shows 0.0.0.0/0 as Active.";
  console.log("NOT CONNECTED: " + msg + (hint ? "\nHint: " + hint : ""));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
