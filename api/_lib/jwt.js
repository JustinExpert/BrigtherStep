// Minimal JWT (HS256) signed with JWT_SECRET. No dependency: Node's crypto does HMAC-SHA256.
import crypto from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const HEADER = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const ISSUER = "brighterstep";

/** The signing key. Must be set and long enough, or every sign-in fails safely. */
function secret() {
  const s = process.env.JWT_SECRET || "";
  if (s.length < 32) throw Object.assign(new Error("JWT_SECRET is missing or shorter than 32 characters"), { code: "NO_SECRET" });
  return s;
}

const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest();

/** Signs { sub, sid, role } with an expiry `ttlSeconds` from now. */
export function signJwt(claims, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...claims, iss: ISSUER, iat: now, exp: now + Math.floor(ttlSeconds) }));
  return `${HEADER}.${body}.${b64url(sign(`${HEADER}.${body}`))}`;
}

/** Returns the claims of a valid, unexpired token, or null. */
export function verifyJwt(token) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [h, b, s] = token.split(".");
  if (!h || !b || !s || h !== HEADER) return null; // only our exact header (blocks alg=none tricks)
  const want = sign(`${h}.${b}`);
  const got = Buffer.from(s, "base64url");
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(b, "base64url").toString("utf8")); } catch { return null; }
  if (claims?.iss !== ISSUER || typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
  return claims;
}
