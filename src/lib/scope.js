// Who-teaches-what helpers. Admins see every class; a teacher sees only the classes they
// are assigned to teach (plus the class they are class teacher of); others see none.
import { useMemo } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useData } from "./DataContext.jsx";
import { ADMINS } from "./permissions.js";
import { CLASSES, DATA, TERMS } from "../data.js";

export function useScope() {
  const { user } = useAuth();
  const { assignments, teachers } = useData();
  return useMemo(() => {
    if (ADMINS.includes(user.role)) return { all: true, classes: CLASSES, assignments, inScope: () => true };
    if (user.role !== "teacher") return { all: false, classes: [], assignments: [], inScope: () => false };
    const mine = assignments.filter((a) => a.teacherId === user.teacherId);
    const homeroom = teachers.find((t) => t.id === user.teacherId)?.class;
    const classes = [...new Set([...mine.map((a) => a.class), ...(homeroom ? [homeroom] : [])])].sort();
    return { all: false, classes, assignments: mine, homeroom, inScope: (cls) => classes.includes(cls) };
  }, [user, assignments, teachers]);
}

export const WHOLE_SCHOOL = "Whole school";
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

export const termLabel = (key) => TERMS.find((t) => t.key === key)?.label || key;

/**
 * Report for one student from published grades:
 * rows: [{ subject, teacher, terms: { Q1: 88, … }, final }], general average, attempted count.
 */
export function buildReport(student, { grades, assignments, teachers }) {
  const mine = grades.filter((g) => g.studentId === student.id && g.published);
  const subjects = assignments.filter((a) => a.class === student.class).map((a) => a.subject);
  const rows = subjects.map((subject) => {
    const terms = Object.fromEntries(TERMS.map((t) => [t.key, mine.find((g) => g.subject === subject && g.term === t.key)?.score ?? null]));
    const scores = Object.values(terms).filter((v) => v !== null);
    return {
      subject, teacher: teacherFor(assignments, teachers, student.class, subject), terms,
      final: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    };
  });
  const finals = rows.map((r) => r.final).filter((v) => v !== null);
  const average = finals.length ? Math.round((finals.reduce((a, b) => a + b, 0) / finals.length) * 10) / 10 : null;
  return { rows, average };
}
