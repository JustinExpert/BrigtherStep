// Roles and per-module access levels. The matrix is the single source of truth for
// which menu items appear, which pages open, and where add/edit/delete buttons show.
// (UI-level only — a real backend must enforce the same rules on every request.)

export const ROLES = [
  { key: "superadmin", label: "Super Admin", desc: "Owns the system: school setup, roles and all accounts.", color: "#5327ae" },
  { key: "admin", label: "School Admin", desc: "Runs day-to-day school operations and manages users.", color: "#7b2cdf" },
  { key: "teacher", label: "Teacher", desc: "Manages classes, attendance, exams and notices.", color: "#ff7a3d" },
  { key: "student", label: "Student", desc: "Sees their own schedule, exams, attendance and fees.", color: "#2fb36c" },
  { key: "parent", label: "Parent", desc: "Follows their children's progress, attendance and fees.", color: "#2f8cf0" },
];
export const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]));
export const ROLE_COLOR = Object.fromEntries(ROLES.map((r) => [r.key, r.color]));
export const ADMINS = ["superadmin", "admin"];
export const STAFF = ["superadmin", "admin", "teacher"];

export const LEVELS = ["none", "view", "edit"];
export const LEVEL_LABEL = { none: "No access", view: "View", edit: "Full" };

export const MODULES = [
  { key: "school", label: "School Setup", group: "Administration" },
  { key: "users", label: "User Management", group: "Administration" },
  { key: "roles", label: "Roles & Permissions", group: "Administration" },
  { key: "students", label: "Students", group: "Academic" },
  { key: "teachers", label: "Teachers", group: "Academic" },
  { key: "classes", label: "Classes", group: "Academic" },
  { key: "subjects", label: "Subjects", group: "Academic" },
  { key: "routine", label: "Routine / Timetable", group: "Academic" },
  { key: "attendance", label: "Attendance", group: "Academic" },
  { key: "exams", label: "Exam Schedule", group: "Assessment" },
  { key: "onlineExams", label: "Online Exams", group: "Assessment" },
  { key: "notices", label: "Notices", group: "Communication" },
  { key: "library", label: "Library", group: "Services" },
  { key: "fees", label: "Fees", group: "Services" },
  { key: "transport", label: "Transport", group: "Services" },
  { key: "hostel", label: "Hostel", group: "Services" },
];

const row = (superadmin, admin, teacher, student, parent) => ({ superadmin, admin, teacher, student, parent });
export const DEFAULT_PERMISSIONS = {
  school: row("edit", "view", "none", "none", "none"),
  users: row("edit", "edit", "none", "none", "none"),
  roles: row("edit", "view", "none", "none", "none"),
  students: row("edit", "edit", "view", "none", "none"),
  teachers: row("edit", "edit", "view", "none", "none"),
  classes: row("edit", "edit", "view", "none", "none"),
  subjects: row("edit", "edit", "view", "view", "view"),
  routine: row("view", "view", "view", "view", "view"),
  attendance: row("edit", "edit", "edit", "none", "none"),
  exams: row("edit", "edit", "edit", "view", "view"),
  onlineExams: row("edit", "edit", "edit", "view", "none"),
  notices: row("edit", "edit", "edit", "view", "view"),
  library: row("edit", "edit", "view", "view", "none"),
  fees: row("edit", "edit", "none", "none", "none"),
  transport: row("edit", "edit", "none", "none", "view"),
  hostel: row("edit", "edit", "none", "none", "none"),
};

// Modules that list other people's records — students and parents must never get these.
const PRIVATE_LISTS = ["school", "users", "roles", "students", "teachers", "attendance", "fees"];

/**
 * Cells that can't be changed: the Super Admin always keeps full access, only admins can manage
 * users/roles, and students/parents can never see other people's records.
 */
export const isLocked = (module, role) =>
  role === "superadmin" ||
  (["users", "roles"].includes(module) && !ADMINS.includes(role)) ||
  (["student", "parent"].includes(role) && PRIVATE_LISTS.includes(module));

// Locked cells always use the default, even if stored data says otherwise.
export const levelOf = (perms, module, role) =>
  (isLocked(module, role) ? DEFAULT_PERMISSIONS[module]?.[role] : perms?.[module]?.[role] ?? DEFAULT_PERMISSIONS[module]?.[role]) ?? "none";
export const allows = (perms, module, role, need = "view") => LEVELS.indexOf(levelOf(perms, module, role)) >= LEVELS.indexOf(need);
