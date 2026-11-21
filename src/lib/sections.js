// Sections (a grade level's class in one school year, e.g. "Grade 2 – B") as the app uses them.
import { useMemo } from "react";
import { useData } from "./DataContext.jsx";
import { GRADUATED } from "../constants.js";
import { bySchoolOrder, offers, sectionLabel, subjectLevels } from "../levels.js";

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

/**
 * The school's subjects: { all, names, forSection(id) → names that section takes, ofLevel(level) → subject records }.
 * A section takes a subject when the subject lists its grade level (and, in Senior High, its strand or no strand).
 */
export function useSubjects() {
  const { subjects } = useData();
  const sections = useSections();
  return useMemo(() => {
    const all = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
    return {
      all, names: all.map((s) => s.name),
      forSection: (id) => all.filter((s) => offers(s, sections.byId.get(id))).map((s) => s.name),
      ofLevel: (level) => all.filter((s) => !level || subjectLevels(s).includes(level)),
    };
  }, [subjects, sections]);
}
