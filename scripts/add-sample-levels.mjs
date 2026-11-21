// Adds sample sections, students, teaching assignments, timetables, activities and published grades
// for Kinder, Junior High, Senior High and College in the open school year, so every level can be tried.
// Elementary (the original demo) is left alone. Everything added has a recognisable id:
//   sections CLS-SMP-…, students STU-7…, assignments ASG-CLS-SMP-…, activities ACT-SMP-…, enrolments ENR-SMP-…
//
// Run: npm run db:add-sample-levels             (adds them if they aren't there)
//      npm run db:add-sample-levels -- --remove   (takes all of them out again)
import { AVATAR_COLORS, DATA as DISPLAY, DEFAULT_SCHOOL, gradeId, termsFor } from "../src/constants.js";
import { computeGrade, reportGrade, weightsFor } from "../src/lib/gradeCalc.js";
import { offers } from "../src/levels.js";
import { connect, dbName, redact, uri } from "./db.mjs";

if (!uri) { console.log("MONGODB_URI is empty in .env — run npm run db:check first."); process.exit(1); }
const remove = process.argv.includes("--remove");

// [id, level, grade, name, strand, program, room]
const SECTIONS = [
  ["CLS-SMP-K", "kinder", "K", "Rosal", "", "", "K-101"],
  ["CLS-SMP-G7", "junior_high", "G7", "Rizal", "", "", "J-201"],
  ["CLS-SMP-G10", "junior_high", "G10", "Mabini", "", "", "J-204"],
  ["CLS-SMP-G11", "senior_high", "G11", "STEM A", "STEM", "", "S-301"],
  ["CLS-SMP-G12", "senior_high", "G12", "ABM A", "ABM", "", "S-302"],
  ["CLS-SMP-BSIT1", "college", "Y1", "A", "", "BSIT", "C-401"],
  ["CLS-SMP-BSBA1", "college", "Y1", "A", "", "BSBA", "C-402"],
];
const FIRST = ["Andrea", "Bea", "Carlo", "Diego", "Elisa", "Franco", "Gabby", "Hana", "Ivan", "Jasmine", "Kian", "Lia", "Migo", "Nica"];
const LAST = ["Dela Cruz", "Santos", "Reyes", "Bautista", "Garcia", "Mendoza", "Aquino", "Villanueva", "Ramos", "Castillo"];
const PER_SECTION = 6;
// Ages for a date of birth by grade (school year 2026–2027).
const BIRTH_YEAR = { K: 2021, G7: 2014, G10: 2011, G11: 2010, G12: 2009, Y1: 2008 };

let seed = 23;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, l = 2) => String(n).padStart(l, "0");

let client;
try {
  client = await connect();
  const db = client.db(dbName);
  // Same defaults the app fills in for settings saved before they existed (e.g. College programs).
  const school = { ...structuredClone(DEFAULT_SCHOOL), ...((await db.collection("settings").findOne({ _id: "school" }))?.value || {}) };
  const ay = school?.academicYear;
  if (!ay?.key) throw new Error("School settings have no school year. Run npm run db:migrate-years first.");
  const ids = SECTIONS.map((s) => s[0]);

  if (remove) {
    const students = (await db.collection("students").find({ class: { $in: ids } }, { projection: { _id: 1 } }).toArray()).map((s) => s._id);
    const r = await Promise.all([
      db.collection("grades").deleteMany({ $or: [{ class: { $in: ids } }, { studentId: { $in: students } }] }),
      db.collection("activities").deleteMany({ class: { $in: ids } }),
      db.collection("assignments").deleteMany({ class: { $in: ids } }),
      db.collection("enrollments").deleteMany({ $or: [{ class: { $in: ids } }, { studentId: { $in: students } }] }),
      db.collection("attendance").deleteMany({ class: { $in: ids } }),
      db.collection("students").deleteMany({ _id: { $in: students } }),
      db.collection("classes").deleteMany({ _id: { $in: ids } }),
    ]);
    const routine = (await db.collection("settings").findOne({ _id: "routine" }))?.value || {};
    for (const id of ids) delete routine[id];
    await db.collection("settings").updateOne({ _id: "routine" }, { $set: { value: routine } }, { upsert: true });
    console.log(`Removed sample levels: ${r[6].deletedCount} sections, ${r[5].deletedCount} students, ${r[2].deletedCount} assignments, ${r[1].deletedCount} activities, ${r[0].deletedCount} grades.`);
    process.exit(0);
  }

  if (await db.collection("classes").findOne({ _id: { $in: ids } })) { console.log(`Sample levels are already in "${dbName}". Nothing changed (use --remove first to rebuild).`); process.exit(0); }
  const programs = (school.programs || []).map((p) => p.code);
  for (const [, , , , strand, program] of SECTIONS) {
    if (strand && !(school.strands || []).includes(strand)) throw new Error(`Strand ${strand} isn't in School Setup.`);
    if (program && !programs.includes(program)) throw new Error(`Program ${program} isn't in School Setup.`);
  }
  const [subjects, teachers, existingRoutine, existingAsg] = await Promise.all([
    db.collection("subjects").find({}).toArray(), db.collection("teachers").find({}).toArray(),
    db.collection("settings").findOne({ _id: "routine" }).then((d) => d?.value || {}), db.collection("assignments").find({}).toArray(),
  ]);
  if (!teachers.length) throw new Error("There are no teachers to assign.");

  // 1. Sections
  const sections = SECTIONS.map(([_id, level, grade, name, strand, program, room], i) => ({
    _id, year: ay.key, level, grade, name, adviser: teachers[(i + 3) % teachers.length]._id, room, capacity: 40, strand, ...(program ? { program } : {}),
  }));

  // 2. Students and their enrolment
  const students = [], enrollments = [];
  let n = 0;
  for (const sec of sections) {
    const names = [];
    for (let i = 0; i < PER_SECTION; i++) {
      const first = FIRST[int(0, FIRST.length - 1)], last = LAST[int(0, LAST.length - 1)];
      names.push({ first, last, gender: rnd() > 0.5 ? "Male" : "Female" });
    }
    names.sort((a, b) => `${a.first} ${a.last}`.localeCompare(`${b.first} ${b.last}`)).forEach((p, i) => {
      const id = `STU-${70001 + n++}`;
      students.push({
        _id: id, name: `${p.first} ${p.last}`, gender: p.gender, class: sec._id, roll: "#" + pad(i + 1),
        dob: `${BIRTH_YEAR[sec.grade]}-${pad(int(1, 12))}-${pad(int(1, 28))}`, phone: `+63 9${int(10, 99)} ${int(100, 999)} ${pad(int(0, 9999), 4)}`,
        parent: `${FIRST[int(0, FIRST.length - 1)]} ${p.last}`, email: `${p.first}.${id}`.toLowerCase().replace(/\s+/g, "") + "@brighterstep.test",
        address: `${int(1, 300)} Mabuhay St, Quezon City`, admittedYear: Number(ay.key.slice(0, 4)), color: AVATAR_COLORS[n % AVATAR_COLORS.length],
      });
      enrollments.push({ _id: `ENR-SMP-${id}`, studentId: id, year: ay.key, class: sec._id, from: ay.start, to: null, reason: "Enrolled", by: "sample", at: new Date().toISOString() });
    });
  }

  // 3. Teaching assignments: every subject each section takes; a teacher of that subject if there is one.
  const assignments = [];
  let rr = 0;
  for (const sec of sections) {
    for (const sub of subjects.filter((s) => offers(s, sec)).sort((a, b) => a.name.localeCompare(b.name))) {
      const match = teachers.filter((t) => t.subject === sub.name);
      const teacher = match.length ? match[rr % match.length] : teachers[rr % teachers.length];
      rr++;
      assignments.push({ _id: `ASG-${sec._id}-${sub.name.replace(/\W+/g, "")}`, class: sec._id, subject: sub.name, teacherId: teacher._id });
    }
  }

  // 4. Timetables with no teacher double-booked (counting the timetables already in the school).
  const all = [...existingAsg, ...assignments];
  const teacherOf = (cls, subject) => all.find((a) => a.class === cls && a.subject === subject)?.teacherId;
  const routine = { ...existingRoutine };
  for (const sec of sections) {
    const mine = assignments.filter((a) => a.class === sec._id).map((a) => a.subject);
    const count = Object.fromEntries(mine.map((s) => [s, 0]));
    routine[sec._id] = DISPLAY.DAYS.map((_, d) => DISPLAY.PERIODS.map((_, p) => {
      const busy = new Set(Object.entries(routine).filter(([c]) => c !== sec._id).map(([c, week]) => week?.[d]?.[p]?.subject && teacherOf(c, week[d][p].subject)).filter(Boolean));
      const free = mine.filter((s) => !busy.has(teacherOf(sec._id, s)));
      if (!free.length) return { subject: "" };
      const least = Math.min(...free.map((s) => count[s]));
      const subject = free.find((s) => count[s] === least);
      count[subject]++;
      return { subject };
    }));
  }

  // 5. Activities and published grades: K–12 1st and 2nd quarter; College 1st-semester Prelim, Midterm and Finals.
  const activities = [], grades = [];
  const TEMPLATE = [["WW", "Quiz 1", 20], ["WW", "Quiz 2", 20], ["PT", "Project", 50], ["QA", "Exam", 60]];
  const today = new Date().toISOString().slice(0, 10);
  const dateIn = (i, term) => { const d = new Date(`${ay.start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 10 + i * 12 + term * 4); const s = d.toISOString().slice(0, 10); return s > today ? today : s; };
  const ability = Object.fromEntries(students.map((s) => [s._id, int(68, 97)]));
  for (const a of assignments) {
    const sec = sections.find((s) => s._id === a.class);
    const sub = subjects.find((s) => s.name === a.subject);
    const periods = termsFor(sec.level, sub);
    // 2nd semester hasn't started: College and Senior High grade only 1st-semester subjects; others Q1–Q2.
    const use = ["college", "senior_high"].includes(sec.level) && sub.semester ? (sub.semester === 1 ? periods : []) : periods.slice(0, 2);
    const pupils = students.filter((s) => s.class === sec._id);
    if (sec.level === "kinder") { // Kinder: a B / D / C checklist rating per learning area, no activities
      for (const t of use) for (const s of pupils) {
        const r = ability[s._id] + int(-10, 10);
        grades.push({ _id: gradeId(ay.key, s._id, a.subject, t.key), year: ay.key, studentId: s._id, class: sec._id, subject: a.subject, term: t.key,
          rating: r >= 88 ? "C" : r >= 74 ? "D" : "B", published: true, updatedBy: a.teacherId, updatedAt: dateIn(t.key === "Q1" ? 0 : 1, 3) });
      }
      continue;
    }
    use.forEach((t, ti) => {
      const acts = TEMPLATE.map(([component, title, maxScore], i) => ({
        _id: `ACT-SMP-${sec._id.slice(8)}-${a.subject.replace(/\W+/g, "")}-${t.key}-${i + 1}`, class: sec._id, subject: a.subject, term: t.key, year: ay.key,
        component, title: sec.level === "college" ? `${t.short} ${title}` : title, maxScore, date: dateIn(ti, i), createdBy: a.teacherId,
        scores: Object.fromEntries(pupils.map((s) => [s._id, Math.round((maxScore * Math.max(45, Math.min(100, ability[s._id] + int(-9, 9)))) / 100)])),
      }));
      activities.push(...acts);
      const plain = acts.map(({ _id, ...x }) => ({ id: _id, ...x }));
      for (const s of pupils) {
        const { grade } = computeGrade(plain, s._id, weightsFor(school, a.subject));
        grades.push({ _id: gradeId(ay.key, s._id, a.subject, t.key), year: ay.key, studentId: s._id, class: sec._id, subject: a.subject, term: t.key,
          score: reportGrade(grade, school, sec.level), published: true, updatedBy: a.teacherId, updatedAt: acts.at(-1).date });
      }
    });
  }

  await db.collection("classes").insertMany(sections);
  await db.collection("students").insertMany(students);
  await db.collection("enrollments").insertMany(enrollments);
  await db.collection("assignments").insertMany(assignments);
  if (activities.length) await db.collection("activities").insertMany(activities);
  if (grades.length) await db.collection("grades").insertMany(grades);
  await db.collection("settings").updateOne({ _id: "routine" }, { $set: { value: routine } }, { upsert: true });
  console.log(`Added to "${dbName}" (${ay.label}): ${sections.length} sections, ${students.length} students, ${assignments.length} teaching assignments, ${activities.length} activities, ${grades.length} published grades.`);
  for (const s of sections) console.log(`  ${s.program ? s.program + " " : ""}${s.grade} – ${s.name}${s.strand ? ` (${s.strand})` : ""}: ${assignments.filter((a) => a.class === s._id).length} subjects`);
  console.log("Remove them again with: npm run db:add-sample-levels -- --remove");
} catch (e) {
  console.log("FAILED: " + redact(e?.message || e));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
