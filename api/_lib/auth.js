// Server-side accounts and sessions.
// Passwords: PBKDF2-SHA256, 100k iterations, per-user salt (same format the app already stores).
// Sessions: random 256-bit token in an HttpOnly cookie; only its SHA-256 hash is stored in MongoDB.
import crypto from "node:crypto";
import { getDb } from "./db.js";
import { cookie, parseCookies } from "./http.js";
import { signJwt, verifyJwt } from "./jwt.js";

export const SESSION_COOKIE = process.env.VERCEL ? "__Host-bs_session" : "bs_session";
const ITERATIONS = 100_000;
const SESSION_HOURS = 12;        // "Remember me" off: 12 hours
const REMEMBER_DAYS = 30;        // "Remember me" on: 30 days
const MAX_ATTEMPTS = 5;          // wrong passwords before a lockout
const LOCK_MINUTES = 5;
const DUMMY = { salt: "AAAAAAAAAAAAAAAAAAAAAA==", passwordHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" };

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("base64url");
export const normEmail = (e) => String(e || "").trim().toLowerCase();

function hash(password, saltB64) {
  return crypto.pbkdf2Sync(String(password), Buffer.from(saltB64, "base64"), ITERATIONS, 32, "sha256");
}

/** Constant-time check; always does the full hash so timing doesn't reveal unknown emails. */
export function verifyPassword(password, user) {
  const target = user?.salt && user?.passwordHash ? user : DUMMY;
  const got = hash(password, target.salt);
  const want = Buffer.from(target.passwordHash, "base64");
  const ok = want.length === got.length && crypto.timingSafeEqual(got, want);
  return ok && target !== DUMMY;
}

/** The account without secret fields — safe to send to the browser. */
export function publicUser(u) {
  if (!u) return null;
  const { _id, passwordHash, salt, resetTokenHash, resetExpires, ...rest } = u;
  return { id: _id, ...rest };
}

let indexesReady = false;
async function ensureIndexes(db) {
  if (indexesReady) return;
  await Promise.all([
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("sessions").createIndex({ userId: 1 }),
    db.collection("login_attempts").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  indexesReady = true;
}

/** Returns seconds left if this email is locked out, else 0. */
export async function lockSecondsLeft(db, email) {
  const a = await db.collection("login_attempts").findOne({ _id: email });
  return a?.lockedUntil && a.lockedUntil > new Date() ? Math.ceil((a.lockedUntil - new Date()) / 1000) : 0;
}

async function recordFailure(db, email) {
  const now = new Date();
  const doc = await db.collection("login_attempts").findOneAndUpdate(
    { _id: email },
    { $inc: { count: 1 }, $setOnInsert: { firstAt: now }, $set: { expiresAt: new Date(now.getTime() + 60 * 60_000) } },
    { upsert: true, returnDocument: "after" },
  );
  if ((doc?.count || 0) >= MAX_ATTEMPTS) {
    await db.collection("login_attempts").updateOne({ _id: email }, { $set: { count: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } });
    return true;
  }
  return false;
}

/**
 * Checks email + password. Returns { user } on success or { error, status } on failure.
 * Wrong email and wrong password give the same message; account status is only revealed
 * after the correct password (so it can't be used to probe accounts).
 */
export async function attemptLogin(email, password) {
  const db = await getDb();
  await ensureIndexes(db);
  const e = normEmail(email);
  if (!e || e.length > 254 || typeof password !== "string" || !password || password.length > 128) {
    return { status: 400, error: "Enter your email and password." };
  }
  const locked = await lockSecondsLeft(db, e);
  if (locked) return { status: 429, error: `Too many attempts. Try again in ${Math.ceil(locked / 60)} minute(s).` };

  const user = await db.collection("users").findOne({ email: e });
  if (!verifyPassword(password, user)) {
    const nowLocked = await recordFailure(db, e);
    return { status: 401, error: nowLocked ? `Too many attempts. Login locked for ${LOCK_MINUTES} minutes.` : "Incorrect email or password." };
  }
  await db.collection("login_attempts").deleteOne({ _id: e });
  if (user.status === "pending") return { status: 403, error: "Your account is waiting for approval by the school admin." };
  if (user.status === "inactive") return { status: 403, error: "This account has been deactivated. Please contact the school admin." };
  return { user };
}

/**
 * Creates a session and returns the Set-Cookie header value.
 * The cookie holds a JWT signed with JWT_SECRET: { sub: user id, sid: session id, role, exp }.
 * The session id is also stored in MongoDB, so logout, password changes and deactivation
 * take effect at once (a bare JWT would stay valid until it expires).
 */
export async function startSession(req, user, remember) {
  const db = await getDb();
  await ensureIndexes(db);
  const sid = crypto.randomBytes(18).toString("base64url");
  const ttlMs = remember ? REMEMBER_DAYS * 864e5 : SESSION_HOURS * 3600e3;
  const jwt = signJwt({ sub: user._id, sid, role: user.role }, ttlMs / 1000); // fails before any write if JWT_SECRET is missing
  const now = new Date();
  await db.collection("sessions").insertOne({
    _id: sid, userId: user._id, createdAt: now, expiresAt: new Date(now.getTime() + ttlMs),
    userAgent: String(req.headers?.["user-agent"] || "").slice(0, 200),
  });
  await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLogin: now.toISOString() } });
  // Without "remember me" the cookie has no Max-Age, so it ends when the browser closes.
  return cookie(req, SESSION_COOKIE, jwt, remember ? { maxAge: ttlMs / 1000 } : {});
}

/** The verified JWT claims from this request's cookie, or null. A forged or expired token never reaches the database. */
function sessionClaims(req) {
  const claims = verifyJwt(parseCookies(req)[SESSION_COOKIE]);
  return claims && typeof claims.sid === "string" && typeof claims.sub === "string" ? claims : null;
}

/** Returns the signed-in, active user for this request, or null. */
export async function currentUser(req) {
  const claims = sessionClaims(req);
  if (!claims) return null;
  const db = await getDb();
  const session = await db.collection("sessions").findOne({ _id: claims.sid, userId: claims.sub, expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await db.collection("users").findOne({ _id: claims.sub });
  return user && user.status === "active" ? user : null; // deactivated accounts lose access at once
}

export async function endSession(req) {
  const claims = sessionClaims(req);
  if (claims) {
    const db = await getDb();
    await db.collection("sessions").deleteOne({ _id: claims.sid });
  }
  return cookie(req, SESSION_COOKIE, "", { maxAge: 0 });
}

/** Signs a user out everywhere (used when an admin deactivates or deletes an account). */
export async function endAllSessions(userId) {
  const db = await getDb();
  await db.collection("sessions").deleteMany({ userId });
}

/** Same rules as the app's sign-up form. Returns a list of problems; empty means OK. */
export function passwordProblems(pw) {
  const out = [];
  if (typeof pw !== "string") return ["a password"];
  if (pw.length < 8) out.push("at least 8 characters");
  if (!/[a-z]/i.test(pw)) out.push("a letter");
  if (!/\d/.test(pw)) out.push("a number");
  if (pw.length > 128) out.push("at most 128 characters");
  return out;
}

/** A fresh { salt, passwordHash } for a new password. */
export function newSecret(password) {
  const salt = crypto.randomBytes(16).toString("base64");
  return { salt, passwordHash: hash(password, salt).toString("base64") };
}

/** Stores a new password and signs out every other session of this user (all of them when req is null). */
export async function setPassword(req, user, password) {
  const db = await getDb();
  await db.collection("users").updateOne({ _id: user._id }, { $set: newSecret(password), $unset: { resetTokenHash: "", resetExpires: "" } });
  const keep = req && sessionClaims(req)?.sid;
  await db.collection("sessions").deleteMany({ userId: user._id, ...(keep ? { _id: { $ne: keep } } : {}) });
}

/** One-time password-reset token (30 minutes). Only its hash is stored. */
export async function createResetToken(user) {
  const db = await getDb();
  const token = crypto.randomBytes(24).toString("base64url");
  await db.collection("users").updateOne({ _id: user._id }, { $set: { resetTokenHash: sha256(token), resetExpires: Date.now() + 30 * 60_000 } });
  return token;
}

/** The active account a reset token belongs to, or null if it is wrong or expired. */
export async function userForResetToken(token) {
  if (typeof token !== "string" || !token || token.length > 100) return null;
  const db = await getDb();
  const user = await db.collection("users").findOne({ resetTokenHash: sha256(token), resetExpires: { $gt: Date.now() } });
  return user && user.status === "active" ? user : null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
