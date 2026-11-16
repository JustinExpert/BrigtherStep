// Password hashing with the browser's Web Crypto API (PBKDF2-SHA256, 100k iterations, random salt).
// Note: in production this must run on a server; hashing in the browser only protects the stored data.
const ITERATIONS = 100_000;
const enc = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return { salt: toB64(salt), passwordHash: toB64(bits) };
}

/** Constant-time string comparison. */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, user) {
  if (!user?.salt || !user?.passwordHash) return false;
  const { passwordHash } = await hashPassword(password, user.salt);
  return safeEqual(passwordHash, user.passwordHash);
}

export const randomToken = () =>
  toB64(crypto.getRandomValues(new Uint8Array(24))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function sha256(text) {
  return toB64(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

/** Returns a list of problems; empty means the password is acceptable. */
export function passwordProblems(pw) {
  const out = [];
  if (pw.length < 8) out.push("at least 8 characters");
  if (!/[a-z]/i.test(pw)) out.push("a letter");
  if (!/\d/.test(pw)) out.push("a number");
  if (pw.length > 128) out.push("at most 128 characters");
  return out;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
