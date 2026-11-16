// Sample data for the BrighterStep demo. All people and places are fictional.
import { SEED_HASHES } from "./seedHashes.js";
let seed = 11;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, l = 2) => String(n).padStart(l, "0");

const MALE = ["Liam", "Noah", "Ethan", "Lucas", "Arjun", "Kai", "Omar", "Mateo", "Ravi", "Theo", "Jonah", "Elias", "Finn", "Hugo", "Sam", "Jacob", "Guy", "Floyd"];
const FEMALE = ["Ava", "Mia", "Zara", "Isla", "Sofia", "Leah", "Chloe", "Nina", "Ella", "Yuna", "Priya", "Maya", "Aria", "Lena", "Iris", "Eleanor", "Jenny", "Jane"];
const LAST = ["Santos", "Patel", "Kim", "Okafor", "Nguyen", "Garcia", "Rossi", "Haddad", "Cruz", "Tanaka", "Brown", "Silva", "Ali", "Dubois", "Lopez", "Chen", "Novak", "Reyes", "Pena", "Wilson", "Cooper", "Miles"];
const STREETS = ["TA-107 Newyork", "Australia, Sydney", "12 Rose St, Manila", "45 King Rd, London", "8 Elm Ave, Toronto", "22 Bay St, Auckland"];
export const AVATAR_COLORS = ["#7b2cdf", "#ff7a3d", "#2f8cf0", "#2fb36c", "#e2456e", "#5327ae", "#f2a516"];

export const CLASSES = ["01", "02", "03", "04", "05", "06"];
export const SUBJECTS = ["Mathematics", "English", "Science", "History", "Geography", "Art", "Music", "Physical Ed.", "Computer"];

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
    _r: void pick([0, 0, 0, 0, 0]), // keeps the generated sample names the same as before
    year: 2026,
    color: pick(AVATAR_COLORS),
  };
});

const teachers = [
  ["Grace Okafor", "Female", "Mathematics"], ["Daniel Cruz", "Male", "Science"], ["Hannah Kim", "Female", "English"],
  ["Ravi Patel", "Male", "Computer"], ["Elena Rossi", "Female", "History"], ["Marcus Brown", "Male", "Geography"],
  ["Aiko Tanaka", "Female", "Art"], ["Samir Haddad", "Male", "Physical Ed."], ["Lucia Garcia", "Female", "Music"],
  ["Peter Novak", "Male", "Mathematics"], ["Chloe Dubois", "Female", "English"], ["Owen Silva", "Male", "Science"],
].map(([name, gender, subject], i) => ({
  id: "TCH-" + (201 + i),
  name, gender, subject,
  class: CLASSES[i % CLASSES.length],
  phone: `+123 77${pad(int(0, 99999), 5)}`,
  email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@brighterstep.test",
  joined: `${int(2015, 2025)}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
  salary: int(32, 58) * 100,
  color: AVATAR_COLORS[i % AVATAR_COLORS.length],
}));

const notices = [
  { id: "N1", type: "teacher", title: "New Teacher", body: "Please welcome Owen Silva, who joins the Science department this week.", date: "2026-11-16", author: "Admin" },
  { id: "N2", type: "event", title: "Parent–Teacher Conference", body: "Parent–teacher conferences are on November 21. Please book a slot with your child’s class teacher.", date: "2026-11-15", author: "Admin" },
  { id: "N3", type: "course", title: "New Course", body: "An after-school robotics course opens for classes 04–06. Sign up at the office.", date: "2026-11-10", author: "Admin" },
  { id: "N4", type: "event", title: "Science Fair", body: "The annual science fair will be held in the main hall on November 28.", date: "2026-11-06", author: "Daniel Cruz" },
  { id: "N5", type: "exam", title: "Mid-term Timetable", body: "Mid-term exams start December 1. Check your class timetable for any changes.", date: "2026-11-02", author: "Exams Office" },
];

const classes = CLASSES.map((c, i) => ({
  id: "CLS-" + c, name: "Class " + c, section: pick(["A", "B"]), teacher: teachers[i].name, room: "R-" + (101 + i), capacity: 40,
}));

const subjects = SUBJECTS.map((s, i) => ({
  id: "SUB-" + (301 + i), name: s, code: s.slice(0, 3).toUpperCase() + "-" + (101 + i),
  teacher: (teachers.find((t) => t.subject === s) || teachers[0]).name,
  type: ["Science", "Computer", "Art", "Physical Ed."].includes(s) ? "Practical" : "Theory",
  classes: "01–06",
}));

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS = ["08:00", "08:50", "09:40", "10:50", "11:40", "12:30"];
const routine = Object.fromEntries(CLASSES.map((c) => [c, DAYS.map(() => PERIODS.map(() => {
  const s = pick(SUBJECTS);
  return { subject: s }; // the teacher comes from the class/subject teaching assignment
}))]));

const attendanceChart = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  students: [88, 91, 86, 93, 95, 84, 0, 82, 94, 92, 90, 0],
  teachers: [96, 97, 94, 98, 97, 93, 0, 91, 98, 97, 96, 0],
};

// ---------- Teaching assignments (who teaches which subject in which class) ----------
// Subjects with two teachers are split: classes 01–03 get the first, 04–06 the second.
const assignments = [];
CLASSES.forEach((cls, ci) => {
  [...new Set(routine[cls].flat().map((s) => s.subject))].forEach((subject) => {
    const options = teachers.filter((t) => t.subject === subject);
    const teacher = options[ci < 3 ? 0 : options.length - 1] || teachers[0];
    assignments.push({ id: `ASG-${cls}-${subject.replace(/W+/g, "")}`, class: cls, subject, teacherId: teacher.id });
  });
});

// ---------- Grades (score 0–100 per student, subject and quarter) ----------
export const TERMS = [
  { key: "Q1", label: "1st Quarter" }, { key: "Q2", label: "2nd Quarter" },
  { key: "Q3", label: "3rd Quarter" }, { key: "Q4", label: "4th Quarter" },
];
// Q1 is published for everyone. Q2 is published too, except Mathematics in classes 01–03,
// which is saved as a draft so the demo teacher has grades to review and publish.
const grades = [];
students.forEach((s) => {
  assignments.filter((a) => a.class === s.class).forEach((a) => {
    ["Q1", "Q2"].forEach((term) => {
      const draft = term === "Q2" && a.subject === "Mathematics" && ["01", "02", "03"].includes(s.class);
      grades.push({
        id: `${s.id}|${a.subject}|${term}`, studentId: s.id, class: s.class, subject: a.subject, term,
        score: Math.max(55, Math.min(100, s.percent + int(-12, 12))), published: !draft,
        updatedBy: a.teacherId, updatedAt: term === "Q1" ? "2026-10-24" : "2026-11-14",
      });
    });
  });
});

export const DATA = { students, teachers, notices, classes, subjects, routine, attendanceChart, DAYS, PERIODS, assignments, grades };

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

const school = {
  name: "Northfield Academy",
  motto: "Every day, a brighter step.",
  address: "120 Learning Lane, Northfield",
  phone: "+123 555 0100",
  email: "office@brighterstep.test",
  website: "https://brighterstep.test",
  academicYear: { label: "2026–2027", start: "2026-08-17", end: "2027-06-11" },
  passingMark: 60,
  grading: [
    { grade: "A", min: 90, remark: "Outstanding" },
    { grade: "B", min: 80, remark: "Very good" },
    { grade: "C", min: 70, remark: "Good" },
    { grade: "D", min: 60, remark: "Passed" },
    { grade: "F", min: 0, remark: "Failed" },
  ],
};

export const SEED = { users, school };
