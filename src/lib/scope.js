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

/** Name of the teacher assigned to a subject in a class. */
export function teacherFor(assignments, teachers, cls, subject) {
  const a = assignments.find((x) => x.class === cls && x.subject === subject);
  return (a && teachers.find((t) => t.id === a.teacherId)?.name) || "—";
}

/** A teacher's own weekly timetable: [day][period] → { class, subject } or null. */
export function teacherWeek(assignments, teacherId) {
  const mine = assignments.filter((a) => a.teacherId === teacherId);
  return DATA.DAYS.map((_, d) => DATA.PERIODS.map((_, p) => {
    for (const [cls, week] of Object.entries(DATA.routine)) {
      const subject = week[d][p].subject;
      if (mine.some((a) => a.class === cls && a.subject === subject)) return { class: cls, subject };
    }
    return null;
  }));
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
