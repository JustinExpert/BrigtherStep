// Sample data for the BrighterStep demo. All people and places are fictional.
import { SEED_HASHES } from "./seedHashes.js";
import { computeGrade, DEFAULT_WEIGHTS, reportGrade } from "./lib/gradeCalc.js";
import { AVATAR_COLORS, DAYS, DEFAULT_SCHOOL, PERIODS, gradeId, STRANDS, TERMS } from "./constants.js";
import { makePastYear } from "./samplePastYear.js";

export { AVATAR_COLORS, STRANDS, TERMS };
// The sample Elementary sections' subjects (the full subject list, for every level, is SUBJECT_CATALOG below).
export const SUBJECTS = ["Mathematics", "English", "Science", "History", "Geography", "Art", "Music", "Physical Ed.", "Computer"];
// Sample sections: Elementary Grade 1 … Grade 6 (ids kept from the original demo).
const CLASSES = ["01", "02", "03", "04", "05", "06"];
const school = structuredClone(DEFAULT_SCHOOL);
let seed = 11;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, l = 2) => String(n).padStart(l, "0");

const MALE = ["Liam", "Noah", "Ethan", "Lucas", "Arjun", "Kai", "Omar", "Mateo", "Ravi", "Theo", "Jonah", "Elias", "Finn", "Hugo", "Sam", "Jacob", "Guy", "Floyd"];
const FEMALE = ["Ava", "Mia", "Zara", "Isla", "Sofia", "Leah", "Chloe", "Nina", "Ella", "Yuna", "Priya", "Maya", "Aria", "Lena", "Iris", "Eleanor", "Jenny", "Jane"];
const LAST = ["Santos", "Patel", "Kim", "Okafor", "Nguyen", "Garcia", "Rossi", "Haddad", "Cruz", "Tanaka", "Brown", "Silva", "Ali", "Dubois", "Lopez", "Chen", "Novak", "Reyes", "Pena", "Wilson", "Cooper", "Miles"];
const STREETS = ["TA-107 Newyork", "Australia, Sydney", "12 Rose St, Manila", "45 King Rd, London", "8 Elm Ave, Toronto", "22 Bay St, Auckland"];

const students = Array.from({ length: 64 }, (_, i) => {
  const gender = rnd() > 0.48 ? "Male" : "Female";
  const first = pick(gender === "Male" ? MALE : FEMALE);
  const last = pick(LAST);
  const marks = int(780, 1190);
  return {
    id: "STU-" + (43100 + i),
    name: `${first} ${last}`,
    gender,
    roll: "#" + pad(int(1, 40)),
    address: pick(STREETS),
    class: pick(CLASSES),
    dob: `${int(2010, 2017)}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
    phone: `+123 ${int(5, 9)}98${pad(int(0, 9999), 4)}`,
    parent: `${pick([...MALE, ...FEMALE])} ${last}`,
    email: `${first}.${last}.${43100 + i}`.toLowerCase() + "@brighterstep.test", // ID keeps it unique
    marks,
    percent: Math.round((marks / 1200) * 100),
    attendance: int(78, 100),
    // The pick() call only advances the random sequence so the sample names stay the same as before.
    admittedYear: (pick([0, 0, 0, 0, 0]), 2026), // year the student joined (not the school year)
    color: pick(AVATAR_COLORS),
  };
});

// Roll numbers: unique within each class, in alphabetical order.
CLASSES.forEach((c) => students.filter((s) => s.class === c).sort((a, b) => a.name.localeCompare(b.name)).forEach((s, i) => { s.roll = "#" + pad(i + 1); }));


const teachers = [
  ["Grace Okafor", "Female", "Mathematics"], ["Daniel Cruz", "Male", "Science"], ["Hannah Kim", "Female", "English"],
  ["Ravi Patel", "Male", "Computer"], ["Elena Rossi", "Female", "History"], ["Marcus Brown", "Male", "Geography"],
  ["Aiko Tanaka", "Female", "Art"], ["Samir Haddad", "Male", "Physical Ed."], ["Lucia Garcia", "Female", "Music"],
  ["Peter Novak", "Male", "Mathematics"], ["Chloe Dubois", "Female", "English"], ["Owen Silva", "Male", "Science"],
].map(([name, gender, subject], i) => ({
  id: "TCH-" + (201 + i),
  name, gender, subject,
  phone: `+123 77${pad(int(0, 99999), 5)}`,
  email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@brighterstep.test",
  joined: `${int(2015, 2025)}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
  salary: int(32, 58) * 100,
  color: AVATAR_COLORS[i % AVATAR_COLORS.length],
}));

const notices = [
  { id: "N1", type: "teacher", title: "New Teacher", body: "Please welcome Owen Silva, who joins the Science department this week.", date: "2026-11-16", author: "Admin", audience: "Whole school" },
  { id: "N2", type: "event", title: "Parent–Teacher Conference", body: "Parent–teacher conferences are on November 21. Please book a slot with your child’s class teacher.", date: "2026-11-15", author: "Admin", audience: "Whole school" },
  { id: "N3", type: "course", title: "New Course", body: "An after-school robotics course opens for classes 04–06. Sign up at the office.", date: "2026-11-10", author: "Admin", audience: "Whole school" },
  { id: "N4", type: "event", title: "Science Fair", body: "The annual science fair will be held in the main hall on November 28.", date: "2026-11-06", author: "Daniel Cruz", audience: "Whole school" },
  { id: "N6", type: "event", title: "Class 02 Field Trip", body: "Class 02 visits the Science Museum on November 25. Bring the signed permission slip by Friday.", date: "2026-11-14", author: "Grace Okafor", audience: "02" },
  { id: "N5", type: "exam", title: "Mid-term Timetable", body: "Mid-term exams start December 1. Check your class timetable for any changes.", date: "2026-11-02", author: "Exams Office", audience: "Whole school" },
].map((n) => ({ ...n, year: DEFAULT_SCHOOL.academicYear.key })); // posted in the first school year

const classes = CLASSES.map((c, i) => ({
  id: c, year: DEFAULT_SCHOOL.academicYear.key, level: "elementary", grade: `G${i + 1}`, name: pick(["A", "B"]),
  adviser: teachers[i].id, room: "R-" + (101 + i), capacity: 40, strand: "",
}));

// ---------- Subjects, and the grade levels that take them ----------
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => `G${a + i}`);
const KINDER = ["N", "PK", "K"], SHS = ["G11", "G12"];
const subjects = SUBJECTS.map((s, i) => ({
  id: "SUB-" + (301 + i), name: s, code: s.slice(0, 3).toUpperCase() + "-" + (101 + i),
  teacher: (teachers.find((t) => t.subject === s) || teachers[0]).name,
  type: ["Science", "Computer", "Art", "Physical Ed."].includes(s) ? "Practical" : "Theory",
  grades: s === "Mathematics" ? [...KINDER, ...range(1, 10)] : range(1, 10), strands: [],
}));
// Senior High subjects taught in the 2nd semester (the rest are 1st semester).
const SHS_SEM2 = ["Personal Development", "Understanding Culture, Society and Politics", "General Biology 1", "Fundamentals of ABM 1", "Philippine Politics and Governance"];
/** Sample subjects for the other levels: Kinder learning domains and Senior High core and strand subjects. */
export const SUBJECT_CATALOG = [
  ["Language, Literacy and Communication", "KLLC", KINDER], ["Socio-Emotional Development", "KSED", KINDER],
  ["Values Development", "KVD", KINDER], ["Physical Health and Motor Development", "KPHMD", KINDER],
  ["Aesthetic and Creative Development", "KACD", KINDER], ["Understanding the Physical and Natural Environment", "KUPNE", KINDER],
  ["Oral Communication", "SHS-OC", SHS], ["General Mathematics", "SHS-GM", SHS], ["Earth and Life Science", "SHS-ELS", SHS],
  ["Physical Education and Health", "SHS-PEH", SHS], ["Personal Development", "SHS-PD", SHS], ["Understanding Culture, Society and Politics", "SHS-UCSP", SHS],
  ["Pre-Calculus", "STEM-PC", SHS, ["STEM"]], ["General Biology 1", "STEM-GB1", SHS, ["STEM"]],
  ["Business Mathematics", "ABM-BM", SHS, ["ABM"]], ["Fundamentals of ABM 1", "ABM-F1", SHS, ["ABM"]],
  ["Creative Writing", "HUM-CW", SHS, ["HUMSS"]], ["Philippine Politics and Governance", "HUM-PPG", SHS, ["HUMSS"]],
  ["Humanities 1", "GAS-H1", SHS, ["GAS"]], ["Computer Systems Servicing", "TVL-CSS", SHS, ["TVL"]],
].map(([name, code, grades, strands = []], i) => ({ id: "SUB-" + (310 + i), name, code, teacher: "", type: "Theory", grades, strands,
  ...(grades === SHS ? { semester: SHS_SEM2.includes(name) ? 2 : 1 } : {}) }));
// College: general education subjects every program takes, and a few program subjects (units, semester).
SUBJECT_CATALOG.push(...[
  ["Purposive Communication", "GE-PC", 1, 3], ["Mathematics in the Modern World", "GE-MMW", 1, 3], ["Understanding the Self", "GE-US", 2, 3],
  ["Physical Education 1", "PE-1", 1, 2], ["Introduction to Computing", "IT-101", 1, 3, ["BSIT"]], ["Computer Programming 1", "IT-102", 2, 3, ["BSIT"]],
  ["Principles of Management", "BA-101", 1, 3, ["BSBA"]], ["The Teaching Profession", "ED-101", 2, 3, ["BEED"]],
].map(([name, code, semester, units, programs = []], i) => ({ id: "SUB-" + (340 + i), name, code, teacher: "", type: "Theory", grades: ["Y1"], strands: [], units, semester, programs })));
subjects.push(...SUBJECT_CATALOG);

// Who teaches a subject in a class: subjects with two teachers are split, 01–03 → first, 04–06 → second.
const teacherOf = (cls, subject) => {
  const options = teachers.filter((t) => t.subject === subject);
  return options[CLASSES.indexOf(cls) < 3 ? 0 : options.length - 1] || teachers[0];
};
// Clash-free timetable: in every period each teacher is in at most one class, and each class
// gets every subject about equally often (max 2 of the same subject a day).
const routine = Object.fromEntries(CLASSES.map((c) => [c, DAYS.map(() => PERIODS.map(() => ({ subject: "" })))]));
const weekly = Object.fromEntries(CLASSES.map((c) => [c, Object.fromEntries(SUBJECTS.map((s) => [s, 0]))]));
DAYS.forEach((_, d) => PERIODS.forEach((_, p) => {
  const busy = new Set();
  const order = [...CLASSES].sort(() => rnd() - 0.5);
  order.forEach((cls) => {
    const todayCount = (s) => routine[cls][d].filter((x) => x.subject === s).length;
    const free = SUBJECTS.filter((s) => !busy.has(teacherOf(cls, s).id) && todayCount(s) < 2);
    const pool = free.length ? free : SUBJECTS;
    const least = Math.min(...pool.map((s) => weekly[cls][s]));
    const subject = pick(pool.filter((s) => weekly[cls][s] === least));
    routine[cls][d][p] = { subject }; // the teacher comes from the class/subject teaching assignment
    weekly[cls][subject]++;
    busy.add(teacherOf(cls, subject).id);
  });
}));


// ---------- Teaching assignments (who teaches which subject in which class) ----------
// Subjects with two teachers are split: classes 01–03 get the first, 04–06 the second.
const assignments = [];
CLASSES.forEach((cls, ci) => {
  [...new Set(routine[cls].flat().map((s) => s.subject).filter(Boolean))].forEach((subject) => {
    const teacher = teacherOf(cls, subject);
    assignments.push({ id: `ASG-${cls}-${subject.replace(/\W+/g, "")}`, class: cls, subject, teacherId: teacher.id });
  });
});

// ---------- Grades (score 0–100 per student, subject and quarter) ----------
// Activities per class, subject and quarter, grouped into weighted components. The quarterly
// grade is computed from them. Q1 and Q2 have scores; Q2 Mathematics in classes 01–03 is not
// published yet so the demo teacher has grades to review and publish.
const TEMPLATES = [
  ["WW", "Quiz 1", 20], ["WW", "Quiz 2", 20], ["WW", "Seatwork", 10],
  ["PT", "Group Project", 50], ["PT", "Performance Task", 40], ["QA", "Quarterly Exam", 60],
];
const DATES = { Q1: ["2026-09-04", "2026-09-18", "2026-09-25", "2026-10-02", "2026-10-09", "2026-10-21"],
  Q2: ["2026-10-30", "2026-11-06", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"] };
const YEAR = DEFAULT_SCHOOL.academicYear.key; // sample grades belong to the first school year
const activities = [];
const grades = [];
assignments.forEach((a) => {
  const pupils = students.filter((s) => s.class === a.class);
  const level = Object.fromEntries(pupils.map((s) => [s.id, s.percent + int(-10, 10)])); // ability in this subject
  ["Q1", "Q2"].forEach((term) => {
    const acts = TEMPLATES.map(([component, title, maxScore], i) => ({
      id: `ACT-${a.class}-${a.subject.replace(/\W+/g, "")}-${term}-${i + 1}`, class: a.class, subject: a.subject, term, year: YEAR,
      component, title, maxScore, date: DATES[term][i], createdBy: a.teacherId,
      scores: Object.fromEntries(pupils.map((s) => [s.id, Math.round((maxScore * Math.max(40, Math.min(100, level[s.id] + int(-8, 8)))) / 100)])),
    }));
    activities.push(...acts);
    const draft = term === "Q2" && a.subject === "Mathematics" && ["01", "02", "03"].includes(a.class);
    pupils.forEach((s) => {
      const { grade } = computeGrade(acts, s.id, DEFAULT_WEIGHTS[a.subject]);
      grades.push({
        id: gradeId(YEAR, s.id, a.subject, term), year: YEAR, studentId: s.id, class: s.class, subject: a.subject, term,
        score: reportGrade(grade), published: !draft, updatedBy: a.teacherId, updatedAt: DATES[term][5],
      });
    });
  });
});

// ---------- Attendance (school days from the start of the year to the demo's "today") ----------
// Uses its own random sequence so all the sample data above stays exactly the same.
let aSeed = 7;
const aRnd = () => (aSeed = (aSeed * 9301 + 49297) % 233280) / 233280;
const DEMO_TODAY = "2026-11-20";
const attendance = {}; // { "class|date": { studentId: "P" | "A" | "L" } }
const habit = Object.fromEntries(students.map((s) => [s.id, 0.02 + aRnd() * 0.12])); // how often each student is absent
for (let d = new Date(`${DEFAULT_SCHOOL.academicYear.start}T12:00:00Z`); d.toISOString().slice(0, 10) <= DEMO_TODAY; d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue; // weekends
  const date = d.toISOString().slice(0, 10);
  for (const cls of CLASSES) {
    const marks = {};
    for (const s of students.filter((x) => x.class === cls)) {
      const r = aRnd();
      marks[s.id] = r < habit[s.id] ? "A" : r < habit[s.id] + 0.04 ? "L" : "P";
    }
    if (Object.keys(marks).length) attendance[`${cls}|${date}`] = marks;
  }
}

// The generator's internal numbers (marks, percent, attendance) shaped the sample grades above;
// they're not real records, so they aren't stored. Real figures are calculated from grades and attendance.
const studentRecords = students.map(({ marks, percent, attendance: _att, ...s }) => s);

const enrollments = studentRecords.map((st) => ({
  id: `ENR-${st.id}-${DEFAULT_SCHOOL.academicYear.key}`, studentId: st.id, year: DEFAULT_SCHOOL.academicYear.key, class: st.class,
  from: DEFAULT_SCHOOL.academicYear.start, to: null, reason: "Enrolled", by: "USR-1", at: `${DEFAULT_SCHOOL.academicYear.start}T00:00:00.000Z`,
}));

// ---------- Last school year (2025–2026), already closed ----------
const past = makePastYear({ students: studentRecords, assignments, classes, routine });
school.pastYears = [past.year];
const archives = [past.archive]; // year_archives: one snapshot per closed year

export const DATA = { students: studentRecords, teachers, notices, subjects, routine, DAYS, PERIODS, assignments, grades: [...grades, ...past.grades], activities, attendance, archives,
  classes: [...classes, ...past.sections], enrollments: [...enrollments, ...past.enrollments] };

// ---------- User accounts ----------
// Passwords are stored only as PBKDF2 hashes (see seedHashes.js). Demo passwords are shown on the login page.
const account = (id, email, name, role, extra = {}) => ({
  id, email, name, role, status: "active", phone: "", idNumber: "", photo: null,
  createdAt: "2026-08-01", lastLogin: null, ...SEED_HASHES[email], ...extra,
});
const users = [
  account("USR-1", "superadmin@brighterstep.test", "Alex Navarro", "superadmin", { idNumber: "SA-0001", phone: "+123 7000001" }),
  account("USR-2", "admin@brighterstep.test", "Maya Reyes", "admin", { idNumber: "ADM-0001", phone: "+123 7000002" }),
  account("USR-3", "teacher@brighterstep.test", "Grace Okafor", "teacher", { idNumber: "TCH-201", teacherId: "TCH-201", phone: teachers[0].phone }),
  account("USR-4", "student@brighterstep.test", students[0].name, "student", { idNumber: students[0].id, studentId: students[0].id, phone: students[0].phone }),
  account("USR-5", "parent@brighterstep.test", students[0].parent, "parent", { idNumber: "PAR-0001", childIds: [students[0].id] }),
  account("USR-6", "daniel.cruz@brighterstep.test", "Daniel Cruz", "teacher", { idNumber: "TCH-202", teacherId: "TCH-202" }),
  account("USR-7", "lena.novak@brighterstep.test", "Lena Novak", "student", { status: "pending", createdAt: "2026-11-15", note: "Self-registered" }),
  account("USR-8", "elena.rossi@brighterstep.test", "Elena Rossi", "teacher", { status: "inactive", idNumber: "TCH-205", teacherId: "TCH-205", note: "On leave" }),
  account("USR-9", "tomas.reyes@brighterstep.test", "Tomas Reyes", "parent", { status: "pending", createdAt: "2026-11-16", childIds: [students[2].id], note: "Self-registered" }),
];


export const SEED = { users, school };
