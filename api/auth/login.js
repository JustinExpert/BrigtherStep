// POST /api/auth/login  { email, password, remember }  →  sets the session cookie
// `email` may also be a student ID (students without an email sign in with it).
import { attemptLogin, publicUser, startSession } from "../_lib/auth.js";
import { safeReason } from "../_lib/db.js";
import { allow, readJson, sameOriginJson, send } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!allow(req, res, ["POST"])) return;
  const csrf = sameOriginJson(req);
  if (csrf) return send(res, 403, { ok: false, error: csrf });
  let body;
  try { body = await readJson(req); } catch (e) { return send(res, e.status || 400, { ok: false, error: "Invalid request." }); }
  try {
    const result = await attemptLogin(body?.email, body?.password);
    if (!result.user) return send(res, result.status, { ok: false, error: result.error });
    const setCookie = await startSession(req, result.user, body?.remember === true);
    return send(res, 200, { ok: true, user: publicUser(result.user) }, { "Set-Cookie": setCookie });
  } catch (e) {
    return send(res, 503, { ok: false, error: "Sign-in is unavailable right now. " + safeReason(e) });
  }
}
