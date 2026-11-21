// GET /api/public  →  what the sign-in page shows before anyone signs in (school name and totals only)
import { getDb } from "./_lib/db.js";
import { enabledLevels, loadSettings } from "./_lib/access.js";
import { allow, send } from "./_lib/http.js";

export default async function handler(req, res) {
  if (!allow(req, res, ["GET"])) return;
  try {
    const db = await getDb();
    const settings = await loadSettings(db);
    const { school } = settings;
    const [students, teachers, classes] = await Promise.all([
      db.collection("students").estimatedDocumentCount(),
      db.collection("teachers").estimatedDocumentCount(),
      // This school year's sections, for the levels this school offers.
      db.collection("classes").countDocuments({ year: school.academicYear?.key, level: { $in: enabledLevels(settings) } }),
    ]);
    // Same for every visitor, so Vercel's edge may serve it for 60 s (browsers still revalidate).
    return send(res, 200, { ok: true, school: { name: school.name, motto: school.motto }, counts: { students, teachers, classes } },
      { "Vercel-CDN-Cache-Control": "s-maxage=60, stale-while-revalidate=300" });
  } catch {
    return send(res, 503, { ok: false, error: "The server is unavailable right now." });
  }
}
