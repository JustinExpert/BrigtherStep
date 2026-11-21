// Sections (a grade level's class in one school year, e.g. "Grade 2 – B") as the app uses them.
import { useMemo } from "react";
import { useData } from "./DataContext.jsx";
import { GRADUATED } from "../constants.js";
import { bySchoolOrder, sectionLabel } from "../levels.js";

/**
 * { byId, current, label(id), ofLevel(level), levelOf(id) } — `current` is this school year's
 * sections in school order (Nursery … Grade 12, then by name).
 */
export function useSections() {
  const { classes, school } = useData();
  return useMemo(() => {
    const year = school.academicYear.key;
    const byId = new Map(classes.map((c) => [c.id, c]));
    const current = classes.filter((c) => c.year === year).sort(bySchoolOrder);
    const label = (id) => (id === GRADUATED ? "Graduated" : sectionLabel(byId.get(id), id));
    return {
      byId, current, label,
      ofLevel: (level) => current.filter((c) => !level || c.level === level),
      levelOf: (id) => byId.get(id)?.level,
    };
  }, [classes, school.academicYear.key]);
}
