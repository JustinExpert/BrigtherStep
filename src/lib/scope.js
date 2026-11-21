// Who-teaches-what helpers. Admins see every class; a teacher sees only the classes they
// are assigned to teach (plus the class they are class teacher of); others see none.
import { useMemo } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useData } from "./DataContext.jsx";
import { ADMINS } from "./permissions.js";
import { DATA, TERMS, termLabel } from "../constants.js";
import { bySchoolOrder } from "../levels.js";

/**
 * This school year's sections a user works with, in school order: admins all of them; a teacher the
 * sections they teach (assignments) plus those they advise (`homeroom` = the first one they advise).
 */
export function useScope() {
  const { user } = useAuth();
  const { assignments, classes, school } = useData();
  return useMemo(() => {
    const year = school.academicYear.key;
    const current = classes.filter((c) => c.year === year).sort(bySchoolOrder).map((c) => c.id);
    if (ADMINS.includes(user.role)) return { all: true, classes: current, assignments, advised: [], inScope: () => true };
    if (user.role !== "teacher") return { all: false, classes: [], assignments: [], advised: [], inScope: () => false };
    const mine = assignments.filter((a) => a.teacherId === user.teacherId);
    const advised = classes.filter((c) => c.year === year && c.adviser === user.teacherId).map((c) => c.id);
    const set = new Set([...mine.map((a) => a.class), ...advised]);
    return { all: false, classes: current.filter((id) => set.has(id)), assignments: mine, advised, homeroom: advised[0], inScope: (cls) => set.has(cls) };
  }, [user, assignments, classes, school.academicYear.key]);
}

export const WHOLE_SCHOOL = "Whole school";
/** The section an announcement is for (null = whole school). */
const audienceClass = (aud) => (aud && aud !== WHOLE_SCHOOL ? aud.replace(/^Class /, "") : null);

/**
 * Announcements this person may see: admins see all; everyone else sees whole-school ones plus
 * those for their classes (teacher: classes they teach; student: own class; parent: children's).
 * Pass a student to get what that student sees (used on a parent's child overview).
 */
export function useVisibleNotices(forStudent) {
  const { user } = useAuth();
  const { notices, students } = useData();
  const scope = useScope();
  return useMemo(() => {
    let classes;
    if (forStudent) classes = [forStudent.class];
    else if (ADMINS.includes(user.role)) return notices;
    else if (user.role === "teacher") classes = scope.classes;
    else if (user.role === "student") classes = students.filter((s) => s.id === user.studentId).map((s) => s.class);
    else classes = students.filter((s) => (user.childIds || []).includes(s.id)).map((s) => s.class);
    return notices.filter((n) => { const c = audienceClass(n.audience); return !c || classes.includes(c); });
  }, [forStudent, user, notices, students, scope.classes]);
}

/** Name of the teacher assigned to a subject in a class. */
export function teacherFor(assignments, teachers, cls, subject) {
  const a = assignments.find((x) => x.class === cls && x.subject === subject);
  return (a && teachers.find((t) => t.id === a.teacherId)?.name) || "—";
}

/**
 * A teacher's own weekly timetable: [day][period] → { class, subject, clash } or null.
 * `clash` lists any other classes they are booked in at the same time.
 */
export function teacherWeek(routine, assignments, teacherId) {
  const mine = assignments.filter((a) => a.teacherId === teacherId);
  return DATA.DAYS.map((_, d) => DATA.PERIODS.map((_, p) => {
    const hits = Object.entries(routine)
      .filter(([cls, week]) => week[d][p].subject && mine.some((a) => a.class === cls && a.subject === week[d][p].subject))
      .map(([cls, week]) => ({ class: cls, subject: week[d][p].subject }));
    return hits.length ? { ...hits[0], clash: hits.slice(1) } : null;
  }));
}

/** Subjects a class takes (from its timetable), in first-seen order. */
export const subjectsOf = (routine, cls) => [...new Set((routine[cls] || []).flat().map((s) => s.subject).filter(Boolean))];

/**
 * If putting `subject` into class `cls` at (day, period) would double-book its teacher,
 * returns { teacherId, class } of the other booking; otherwise null.
 */
export function findClash(routine, assignments, cls, day, period, subject) {
  const a = subject && assignments.find((x) => x.class === cls && x.subject === subject);
  if (!a) return null;
  for (const [other, week] of Object.entries(routine)) {
    if (other === cls) continue;
    const s = week[day][period].subject;
    if (s && assignments.some((x) => x.class === other && x.subject === s && x.teacherId === a.teacherId)) return { teacherId: a.teacherId, class: other, subject: s };
  }
  return null;
}

export { termLabel };

/**
 * Report for one student from published grades:
 * rows: [{ subject, teacher, terms: { Q1: 88, … }, final }], general average, and the class the grades were for.
 * `past: true` is for a closed school year: the student may have been in another class then, so subjects,
 * class and teachers come from the grades themselves instead of this year's teaching assignments.
 */
export function buildReport(student, { grades, assignments, teachers }, { past = false } = {}) {
  const mine = grades.filter((g) => g.studentId === student.id && g.published);
  const subjects = past
    ? [...new Set(mine.map((g) => g.subject))].sort()
    : assignments.filter((a) => a.class === student.class).map((a) => a.subject);
  const teacherName = (subject) => (past
    ? teachers.find((t) => t.id === mine.find((g) => g.subject === subject)?.updatedBy)?.name || "—"
    : teacherFor(assignments, teachers, student.class, subject));
  const rows = subjects.map((subject) => {
    const terms = Object.fromEntries(TERMS.map((t) => [t.key, mine.find((g) => g.subject === subject && g.term === t.key)?.score ?? null]));
    const scores = Object.values(terms).filter((v) => v !== null);
    return {
      subject, teacher: teacherName(subject), terms,
      final: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    };
  });
  const finals = rows.map((r) => r.final).filter((v) => v !== null);
  const average = finals.length ? Math.round((finals.reduce((a, b) => a + b, 0) / finals.length) * 10) / 10 : null;
  return { rows, average, cls: past ? mine[0]?.class : student.class };
}
