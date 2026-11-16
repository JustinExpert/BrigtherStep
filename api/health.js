// GET /api/health — confirms the server can reach MongoDB Atlas.
// Returns only safe facts (status, region, timing, record counts); never the connection string.
import { getDb, safeReason } from "./_lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }
  const started = Date.now();
  const base = { service: "brighterstep-api", region: process.env.VERCEL_REGION || "local", time: new Date().toISOString() };
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const [users, students] = await Promise.all([db.collection("users").estimatedDocumentCount(), db.collection("students").estimatedDocumentCount()]);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, database: "connected", latencyMs: Date.now() - started, records: { users, students }, ...base }));
  } catch (e) {
    res.statusCode = 503;
    res.end(JSON.stringify({ ok: false, database: "error", reason: safeReason(e), ...base }));
  }
}
