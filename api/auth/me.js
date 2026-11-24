// GET /api/auth/me  →  the signed-in user (no secrets), or { user: null } when nobody is signed in
import { currentUser, publicUser } from "../_lib/auth.js";
import { allow, send } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!allow(req, res, ["GET"])) return;
  try {
    const user = await currentUser(req, { allowTemporary: true });
    if (!user) return send(res, 200, { ok: true, user: null });
    return send(res, 200, { ok: true, user: publicUser(user) });
  } catch {
    return send(res, 503, { ok: false, error: "Account service is unavailable right now." });
  }
}
