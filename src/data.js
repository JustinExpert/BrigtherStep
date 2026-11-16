// Sample data for the BrighterStep demo. All people and places are fictional.
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
    email: `${first}.${last}`.toLowerCase() + "@student.brighterstep.test",
    marks,
    percent: Math.round((marks / 1200) * 100),
    attendance: int(78, 100),
    fees: pick(["Paid", "Paid", "Paid", "Pending", "Overdue"]),
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
  { id: "N2", type: "fees", title: "Fees Structure", body: "The fee structure for Term 3 has been published. Payment is due by December 15.", date: "2026-11-15", author: "Accounts" },
  { id: "N3", type: "course", title: "New Course", body: "An after-school robotics course opens for classes 04–06. Sign up at the office.", date: "2026-11-10", author: "Admin" },
  { id: "N4", type: "event", title: "Science Fair", body: "The annual science fair will be held in the main hall on November 28.", date: "2026-11-06", author: "Daniel Cruz" },
  { id: "N5", type: "exam", title: "Mid-term Timetable", body: "Mid-term exams start December 1. The timetable is on the Exam page.", date: "2026-11-02", author: "Exams Office" },
];

const books = [
  ["The Number Devil", "H. M. Enzensberger", "Mathematics"], ["A Short History of Nearly Everything", "Bill Bryson", "Science"],
  ["Charlotte's Web", "E. B. White", "English"], ["The Diary of a Young Girl", "Anne Frank", "History"],
  ["National Geographic Kids Atlas", "NG Kids", "Geography"], ["The Art Book for Children", "Phaidon", "Art"],
  ["Hello Ruby", "Linda Liukas", "Computer"], ["Wonder", "R. J. Palacio", "English"], ["Matilda", "Roald Dahl", "English"],
  ["The Way Things Work Now", "David Macaulay", "Science"],
].map(([title, author, subject], i) => {
  const copies = int(3, 12);
  return { id: "BK-" + (501 + i), title, author, subject, class: pick(CLASSES), copies, available: int(0, copies) };
});

const classes = CLASSES.map((c, i) => ({
  id: "CLS-" + c, name: "Class " + c, section: pick(["A", "B"]), teacher: teachers[i].name, room: "R-" + (101 + i), capacity: 40,
}));

const subjects = SUBJECTS.map((s, i) => ({
  id: "SUB-" + (301 + i), name: s, code: s.slice(0, 3).toUpperCase() + "-" + (101 + i),
  teacher: (teachers.find((t) => t.subject === s) || teachers[0]).name,
  type: ["Science", "Computer", "Art", "Physical Ed."].includes(s) ? "Practical" : "Theory",
  classes: "01–06",
}));

const exams = [
  ["Mid-term", "Mathematics", "04", "2026-12-01", "09:00"], ["Mid-term", "English", "04", "2026-12-02", "09:00"],
  ["Mid-term", "Science", "05", "2026-12-03", "09:00"], ["Mid-term", "History", "06", "2026-12-04", "10:30"],
  ["Unit test", "Computer", "03", "2026-11-24", "11:00"], ["Unit test", "Geography", "02", "2026-11-25", "11:00"],
].map(([name, subject, cls, date, time], i) => ({ id: "EX-" + (601 + i), name, subject, class: cls, date, time, room: "Hall " + ((i % 3) + 1) }));

const routes = [
  ["Route 1", "North Hills", "BUS-12", "Tomas Reyes", 8, 45], ["Route 2", "Riverside", "BUS-07", "Ana Lopez", 6, 40],
  ["Route 3", "City Centre", "VAN-03", "Kofi Mensah", 5, 35], ["Route 4", "Lakeview", "BUS-15", "Mei Lin", 9, 50],
].map(([route, area, vehicle, driver, stops, fare], i) => ({ id: "TR-" + (701 + i), route, area, vehicle, driver, phone: `+123 66${pad(int(0, 99999), 5)}`, stops, fare }));

const rooms = Array.from({ length: 8 }, (_, i) => {
  const beds = pick([2, 3, 4]);
  return { id: "HS-" + (801 + i), hostel: i < 4 ? "Oak House (Boys)" : "Maple House (Girls)", room: String(101 + (i % 4)), type: beds === 2 ? "Twin" : "Shared", beds, occupied: int(0, beds), fee: beds === 2 ? 320 : 260 };
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS = ["08:00", "08:50", "09:40", "10:50", "11:40", "12:30"];
const routine = Object.fromEntries(CLASSES.map((c) => [c, DAYS.map(() => PERIODS.map(() => {
  const s = pick(SUBJECTS);
  return { subject: s, teacher: (teachers.find((t) => t.subject === s) || teachers[0]).name };
}))]));

const attendanceChart = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  students: [88, 91, 86, 93, 95, 84, 0, 82, 94, 92, 90, 0],
  teachers: [96, 97, 94, 98, 97, 93, 0, 91, 98, 97, 96, 0],
};

const messages = [
  { from: "Grace Okafor", text: "Can we move the maths quiz to Friday?", time: "10m" },
  { from: "Accounts", text: "Term 3 invoices are ready for review.", time: "1h" },
  { from: "Daniel Cruz", text: "The science fair room is booked.", time: "3h" },
];

export const DATA = { students, teachers, notices, books, classes, subjects, exams, routes, rooms, routine, attendanceChart, messages, DAYS, PERIODS };

// Demo accounts. In a real system, credentials are checked by a server, never stored in browser code.
export const DEMO_USERS = [
  { email: "admin@brighterstep.test", password: "admin123", name: "Maya Reyes", role: "admin" },
  { email: "teacher@brighterstep.test", password: "teacher123", name: "Grace Okafor", role: "teacher" },
  // Linked to the first sample student record by ID.
  { email: "student@brighterstep.test", password: "student123", name: students[0].name, role: "student", studentId: students[0].id },
];
