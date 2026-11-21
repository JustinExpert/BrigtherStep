// Sections, enrolment and transfers.
// A section belongs to one school year, level and grade (e.g. Grade 1 – Sampaguita, 2026–2027).
// `enrollments` records which section each student was in, from when to when, so a transfer
// keeps the history and a past year still knows who was in which section.
import crypto from "node:crypto";
import { GRADUATED } from "../../src/constants.js";
import { bySchoolOrder, gradeOf, nextGrade } from "../../src/levels.js";
import { bad, deny, HttpError } from "./access.js";
import { getClient } from "./db.js";

const newId = (prefix) => prefix + crypto.randomBytes(6).toString("hex").toUpperCase();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Opens an enrolment for a student in a section from a date (closing any open one first). */
export async function enroll(db, { studentId, cls, year, from, reason, by }, session) {
  await db.collection("enrollments").updateMany({ studentId, year, to: null }, { $set: { to: from } }, { session });
  await db.collection("enrollments").insertOne({ _id: newId("ENR-"), studentId, year, class: cls, from, to: null, reason, by, at: new Date().toISOString() }, { session });
}

/**
 * Moves a student to another section of this school year on a date, with a reason.
 * The earlier section's grades and attendance stay where they were; the history records the move.
 */
export async function transferStudent(db, ctx, user, { studentId, toClass, date, reason }) {
  if (!ctx.can("students", "edit")) deny();
  const ay = ctx.settings.school.academicYear;
  const student = await db.collection("students").findOne({ _id: String(studentId || "") });
  if (!student) throw new HttpError(404, "That student no longer exists.");
  if (!ctx.currentSections.has(student.class)) bad("This student isn't in one of this school year's sections, so they can't be transferred.");
  if (!ctx.currentSections.has(toClass)) bad("Choose one of this school year's sections.");
  if (toClass === student.class) bad("The student is already in that section.");
  if (typeof date !== "string" || !DATE_RE.test(date) || date < ay.start || date > ay.end) bad(`The transfer date must be in the current school year (${ay.start} to ${ay.end}).`);
  const text = typeof reason === "string" ? reason.trim() : "";
  if (!text || text.length > 200) bad("Give a short reason for the transfer (up to 200 characters).");
  const open = await db.collection("enrollments").findOne({ studentId: student._id, year: ay.key, to: null });
  if (open && date < open.from) bad(`The transfer date can't be before the student joined their current section (${open.from}).`);

  const from = ctx.sections.get(student.class), to = ctx.sections.get(toClass);
  const session = (await getClient()).startSession();
  try {
    await session.withTransaction(async () => {
      // Students admitted before enrolment history existed get their first entry now.
      if (!open) await db.collection("enrollments").insertOne({ _id: newId("ENR-"), studentId: student._id, year: ay.key, class: student.class, from: ay.start, to: null, reason: "Enrolled", by: user._id, at: new Date().toISOString() }, { session });
      await enroll(db, { studentId: student._id, cls: toClass, year: ay.key, from: date, reason: text, by: user._id }, session);
      await db.collection("students").updateOne({ _id: student._id }, { $set: { class: toClass } }, { session });
    });
  } finally {
    await session.endSession();
  }
  return { from: from?._id, to: to?._id };
}

/**
 * Opens the next school year's sections (copies of this year's, with new ids), teaching assignments and
 * timetable, and moves students: up one grade (when `promote`) or into the copy of their own section.
 * A student whose next grade isn't offered here graduates. Runs inside the caller's transaction.
 */
export async function rollSections(db, ctx, { cur, next, promote, by }, session) {
  const current = [...ctx.sections.values()].filter((s) => s.year === cur.key).sort(bySchoolOrder);
  const copy = new Map(); // old section id → new section document
  const created = [];
  for (const s of current) {
    const n = { ...s, _id: newId("CLS-"), year: next.key };
    copy.set(s._id, n);
    created.push(n);
  }
  // Where a student moving up lands: same section name in the next grade if there is one, else that grade's first section.
  const findIn = (grade, name) => created.filter((s) => s.grade === grade).sort(bySchoolOrder).find((s) => s.name === name)
    || created.filter((s) => s.grade === grade).sort(bySchoolOrder)[0];
  const ensure = (grade, like) => { // a grade with no section yet gets one, named like the student's old section
    const found = findIn(grade, like.name);
    if (found) return found;
    const level = gradeOf(grade).level; // e.g. Grade 7 is Junior High, even when moving up from Elementary
    const n = { _id: newId("CLS-"), year: next.key, level, grade, name: like.name, adviser: "", room: "", capacity: like.capacity || 40, strand: "" };
    created.push(n);
    return n;
  };

  const students = await db.collection("students").find({ class: { $in: current.map((s) => s._id) } }, { session }).toArray();
  const studentOps = [], enrollmentDocs = [];
  let promoted = 0, graduated = 0, stayed = 0;
  for (const st of students) {
    const old = ctx.sections.get(st.class);
    let target = null;
    if (promote) {
      const ng = nextGrade(old.grade, ctx.levels);
      if (ng) { target = ensure(ng, old); promoted++; } else graduated++;
    } else { target = copy.get(old._id); stayed++; }
    studentOps.push({ updateOne: { filter: { _id: st._id }, update: target ? { $set: { class: target._id } } : { $set: { class: GRADUATED, graduatedYear: cur.key } } } });
    if (target) enrollmentDocs.push({ _id: newId("ENR-"), studentId: st._id, year: next.key, class: target._id, from: next.start, to: null, reason: promote ? "Moved up" : "Continued", by, at: new Date().toISOString() });
  }

  // Teaching assignments and timetable carry over to the new sections (admins adjust them as needed).
  const assignments = await db.collection("assignments").find({}, { session }).toArray();
  const newAssignments = assignments.filter((a) => copy.has(a.class)).map((a) => ({ ...a, _id: `ASG-${copy.get(a.class)._id}-${a.subject.replace(/\W+/g, "")}`, class: copy.get(a.class)._id }));
  const routine = (await db.collection("settings").findOne({ _id: "routine" }, { session }))?.value || {};
  const newRoutine = Object.fromEntries(Object.entries(routine).filter(([cls]) => copy.has(cls)).map(([cls, week]) => [copy.get(cls)._id, week]));

  if (created.length) await db.collection("classes").insertMany(created, { session });
  await db.collection("enrollments").updateMany({ year: cur.key, to: null }, { $set: { to: cur.end } }, { session });
  if (enrollmentDocs.length) await db.collection("enrollments").insertMany(enrollmentDocs, { session });
  if (studentOps.length) await db.collection("students").bulkWrite(studentOps, { ordered: false, session });
  await db.collection("assignments").deleteMany({}, { session });
  if (newAssignments.length) await db.collection("assignments").insertMany(newAssignments, { session });
  await db.collection("settings").updateOne({ _id: "routine" }, { $set: { value: newRoutine } }, { upsert: true, session });
  return { promoted, graduated, stayed, sections: created.length };
}
