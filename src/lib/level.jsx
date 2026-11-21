// The level tabs (Kinder · Elementary · Junior High · Senior High …).
// Only levels the school bought (ENABLED_LEVELS) appear, and a teacher only sees the levels they teach.
// The choice is remembered between pages and kept in the link (?level=elementary).
import { createContext, useCallback, useContext, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { useData } from "./DataContext.jsx";
import { useScope } from "./scope.js";
import { useSections } from "./sections.js";
import { levelOf as levelInfo } from "../levels.js";

const KEY = "brighterstep.level";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } };

const LevelContext = createContext({ level: null, levels: [], setLevel: () => {}, inLevel: () => true });

export function LevelProvider({ children }) {
  const { user } = useAuth();
  const { levels: enabled = [] } = useData();
  const scope = useScope();
  const sections = useSections();
  const [params, setParams] = useSearchParams();

  const levels = useMemo(() => {
    if (!user || ["student", "parent"].includes(user.role)) return [];
    if (user.role === "teacher") {
      const mine = new Set(scope.classes.map((id) => sections.levelOf(id)));
      return enabled.filter((l) => mine.has(l));
    }
    return enabled;
  }, [user, enabled, scope.classes, sections]);

  // URL first, then the last choice, then the first level that has sections this year.
  const level = [params.get("level"), read()].find((l) => l && levels.includes(l))
    || levels.find((l) => sections.current.some((s) => s.level === l)) || levels[0] || null;

  const setLevel = useCallback((l) => {
    write(l);
    setParams((p) => { const n = new URLSearchParams(p); n.set("level", l); return n; }, { replace: true });
  }, [setParams]);
  const inLevel = useCallback((sectionId) => !level || sections.levelOf(sectionId) === level, [level, sections]);

  const value = useMemo(() => ({ level, levels, setLevel, inLevel }), [level, levels, setLevel, inLevel]);
  return <LevelContext.Provider value={value}>{children}</LevelContext.Provider>;
}

/** { level, levels, setLevel, inLevel(sectionId) } */
export const useLevel = () => useContext(LevelContext);

/** The tab bar. Hidden when there's only one level to choose from. */
export function LevelTabs() {
  const { level, levels, setLevel } = useLevel();
  if (levels.length < 2) return null;
  return (
    <nav className="level-tabs" aria-label="School level">
      {levels.map((l) => (
        <button key={l} type="button" className={l === level ? "on" : ""} aria-current={l === level ? "page" : undefined} onClick={() => setLevel(l)}>
          {levelInfo(l)?.label || l}
        </button>
      ))}
    </nav>
  );
}
