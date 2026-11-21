import { useMemo } from "react";
import { useData } from "./DataContext.jsx";
import { buildReport } from "./scope.js";
import { NONE, attendanceByStudent } from "./stats.js";

/**
 * Per-student figures for this school year: Map studentId → { attendance, average }.
 * `average` is the general average of published grades, calculated exactly like the report card.
 */
export function useStudentStats() {
  const { students, grades, attendance, assignments, teachers } = useData();
  return useMemo(() => {
    const att = attendanceByStudent(attendance);
    const gradesBy = new Map();
    for (const g of grades) if (g.published) (gradesBy.get(g.studentId) || gradesBy.set(g.studentId, []).get(g.studentId)).push(g);
    const out = new Map();
    for (const s of students) {
      out.set(s.id, { attendance: att.get(s.id) || NONE, average: buildReport(s, { grades: gradesBy.get(s.id) || [], assignments, teachers }).average });
    }
    return out;
  }, [students, grades, attendance, assignments, teachers]);
}
