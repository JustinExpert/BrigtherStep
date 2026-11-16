// Small HTTP helpers for the API (work on Vercel and in the local dev server).

export const MAX_BODY = 32 * 1024;

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

/** Rejects other methods with 405. Returns true when the method is allowed. */
export function allow(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  send(res, 405, { ok: false, error: "Method not allowed" });
  return false;
}

/** Reads a JSON body (≤ 32 KB). Uses req.body when the platform already parsed it. */
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Body too large"), { status: 413 });
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers?.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const isLocal = (req) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers?.host || ""));

/** Builds a Set-Cookie value. Secure + HttpOnly + SameSite=Lax; __Host- prefix pins it to this site. */
export function cookie(req, name, value, { maxAge } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (!isLocal(req)) parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join("; ");
}

/**
 * Basic CSRF defence for state-changing requests: require a JSON body and, when the browser
 * sends an Origin header, require it to match this site.
 */
export function sameOriginJson(req) {
  const type = String(req.headers?.["content-type"] || "");
  if (!type.startsWith("application/json")) return "Send the request as JSON.";
  const origin = req.headers?.origin;
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { return "Bad origin."; }
    if (host !== req.headers?.host) return "Cross-site requests are not allowed.";
  }
  return null;
}

export const clientIp = (req) => String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
