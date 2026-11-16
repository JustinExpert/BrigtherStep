// POST /api/auth/logout  →  ends the session and clears the cookie
import { endSession } from "../_lib/auth.js";
import { allow, sameOriginJson, send } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!allow(req, res, ["POST"])) return;
  const csrf = sameOriginJson(req);
  if (csrf) return send(res, 403, { ok: false, error: csrf });
  try {
    return send(res, 200, { ok: true }, { "Set-Cookie": await endSession(req) });
  } catch {
    return send(res, 503, { ok: false, error: "Sign-out is unavailable right now." });
  }
}
