// Validation shared by self-registration, admin-created accounts and profile edits.
import crypto from "node:crypto";
import { EMAIL_RE, normEmail } from "./auth.js";
import { bad } from "./access.js";

export const text = (v, max, label) => {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string" || v.length > max) bad(`${label} is too long.`);
  return v.trim();
};

export function email(v) {
  const e = normEmail(v);
  if (!EMAIL_RE.test(e) || e.length > 254) bad("Enter a valid email address.");
  return e;
}

/** A profile photo: a small JPEG/PNG/WebP data URL from the app's photo picker, or null. */
export function photo(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) bad("Invalid photo.");
  if (v.length > 400_000) bad("That photo is too large.");
  return v;
}

/** Throws if another account already uses this email. */
export async function emailFree(db, e, exceptId) {
  const other = await db.collection("users").findOne({ email: e, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (other) bad("An account with this email already exists.");
}

/**
 * Checks role links (student record, staff record, children) exist and returns the clean fields.
 * A student record has at most one student login (students can sign in with their ID), so
 * nobody can claim a student who already has one. `exceptId`: the account being edited.
 */
export async function links(db, role, { studentId, teacherId, childIds } = {}, exceptId = null) {
  const exists = async (col, id) => typeof id === "string" && id.length <= 40 && !!(await db.collection(col).findOne({ _id: id }, { projection: { _id: 1 } }));
  const out = { studentId: null, teacherId: null, childIds: [] };
  if (role === "student" && studentId) {
    if (!(await exists("students", studentId))) bad(`No student record with ID ${studentId}. Check with the school office.`);
    const taken = await db.collection("users").findOne({ role: "student", studentId, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, { projection: { _id: 1 } });
    if (taken) bad(`Student ${studentId} already has an account. Ask the school office for help signing in.`);
    out.studentId = studentId;
  }
  if (role === "teacher" && teacherId) {
    if (!(await exists("teachers", teacherId))) bad(`No staff record with ID ${teacherId}. Check with the school office.`);
    out.teacherId = teacherId;
  }
  if (role === "parent" && childIds) {
    if (!Array.isArray(childIds) || childIds.length > 20 || childIds.some((id) => typeof id !== "string")) bad("Invalid list of children.");
    const ids = [...new Set(childIds)];
    const found = new Set((await db.collection("students").find({ _id: { $in: ids } }, { projection: { _id: 1 } }).toArray()).map((s) => s._id));
    const missing = ids.find((id) => !found.has(id));
    if (missing) bad(`No student record with ID ${missing}. Check with the school office.`);
    out.childIds = ids;
  }
  return out;
}

/**
 * The email for an account made by an admin. Student accounts linked to their record may have
 * none (young students often don't): they sign in with their student ID. Returns null for none.
 */
export function accountEmail(v, role, studentId) {
  if ((v === undefined || v === null || String(v).trim() === "") && role === "student") {
    if (!studentId) bad("A student account with no email must be linked to a student record (they sign in with its ID).");
    return null;
  }
  return email(v);
}

/** A temporary password that is easy to read off a printed slip: 6 letters, 2 digits (no look-alikes). */
export function readablePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz", digits = "23456789";
  const pick = (set, n) => Array.from(crypto.randomBytes(n), (b) => set[b % set.length]).join("");
  return pick(letters, 6) + pick(digits, 2);
}

export const newUserId = () => "USR-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
