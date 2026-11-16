// GET /api/public  →  what the sign-in page shows before anyone signs in (school name and totals only)
import { getDb } from "./_lib/db.js";
import { loadSettings } from "./_lib/access.js";
import { allow, send } from "./_lib/http.js";

export default async function handler(req, res) {
  if (!allow(req, res, ["GET"])) return;
  try {
    const db = await getDb();
    const [{ school }, students, teachers, classes] = await Promise.all([
      loadSettings(db),
      db.collection("students").estimatedDocumentCount(),
      db.collection("teachers").estimatedDocumentCount(),
      db.collection("classes").estimatedDocumentCount(),
    ]);
    return send(res, 200, { ok: true, school: { name: school.name, motto: school.motto }, counts: { students, teachers, classes } });
  } catch {
    return send(res, 503, { ok: false, error: "The server is unavailable right now." });
  }
}
