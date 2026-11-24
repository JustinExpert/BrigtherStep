// POST /api/auth/change-password  { current, next }  →  signed-in user changes their password
import { currentUser, passwordProblems, setPassword, verifyPassword } from "../_lib/auth.js";
import { allow, readJson, sameOriginJson, send } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!allow(req, res, ["POST"])) return;
  const csrf = sameOriginJson(req);
  if (csrf) return send(res, 403, { ok: false, error: csrf });
  let body;
  try { body = await readJson(req); } catch (e) { return send(res, e.status || 400, { ok: false, error: "Invalid request." }); }
  try {
    const user = await currentUser(req, { allowTemporary: true });
    if (!user) return send(res, 401, { ok: false, error: "Not signed in." });
    const { current, next } = body || {};
    if (typeof current !== "string" || current.length > 128 || !verifyPassword(current, user)) {
      return send(res, 400, { ok: false, error: "Your current password is incorrect." });
    }
    const problems = passwordProblems(next);
    if (problems.length) return send(res, 400, { ok: false, error: `New password needs ${problems.join(", ")}.` });
    if (current === next) return send(res, 400, { ok: false, error: "Choose a password different from your current one." });
    await setPassword(req, user, next);
    return send(res, 200, { ok: true });
  } catch {
    return send(res, 503, { ok: false, error: "Password change is unavailable right now." });
  }
}
