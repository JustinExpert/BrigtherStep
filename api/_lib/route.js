// Shared request handling for POST routes: method check, CSRF check, JSON body, error mapping.
import { HttpError } from "./access.js";
import { safeReason } from "./db.js";
import { allow, readJson, sameOriginJson, send } from "./http.js";

/** Wraps fn(body, req) → result object. Throw HttpError for user-facing errors. */
export function postRoute(fn, { limit } = {}) {
  return async (req, res) => {
    if (!allow(req, res, ["POST"])) return;
    const csrf = sameOriginJson(req);
    if (csrf) return send(res, 403, { ok: false, error: csrf });
    let body;
    try { body = await readJson(req, limit); } catch (e) {
      return send(res, e.status || 400, { ok: false, error: e.status === 413 ? "That's too much data (photos must be small)." : "Invalid request." });
    }
    try {
      const result = await fn(body && typeof body === "object" ? body : {}, req, res);
      return send(res, 200, { ok: true, ...result });
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { ok: false, error: e.message });
      console.error(`[api] ${req.url}`, e?.message);
      return send(res, 503, { ok: false, error: "The server couldn't complete that. " + safeReason(e) });
    }
  };
}
