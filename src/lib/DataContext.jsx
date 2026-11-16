import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CLASSES, DATA, SEED } from "../data.js";
import { DEFAULT_PERMISSIONS, MODULES, ROLES } from "./permissions.js";

// Store with generic CRUD per collection, saved to this browser's localStorage so changes
// survive a refresh. Each browser/device has its own copy — nothing is shared between users
// (a backup file can carry data from one browser to another).
// To use a real backend, replace these functions with API calls.
const COLLECTIONS = ["students", "teachers", "notices", "classes", "subjects", "users", "assignments", "grades", "activities"];
const PREFIX = { students: "STU-", teachers: "TCH-", notices: "N", classes: "CLS-", subjects: "SUB-", users: "USR-", assignments: "ASG-", grades: "GRD-", activities: "ACT-" };
const STORAGE_KEY = "brighterstep.data.v1";
export const BACKUP_APP = "brighterstep";
export const BACKUP_VERSION = 1;

const SOURCE = { ...DATA, users: SEED.users };
const seedDb = () => Object.fromEntries(COLLECTIONS.map((c) => [c, structuredClone(SOURCE[c])]));
const seedRoutine = () => structuredClone(DATA.routine);
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

/** Fill any missing module/role cells from the defaults. */
function normalizePermissions(saved) {
  return Object.fromEntries(MODULES.map((m) => [m.key, Object.fromEntries(ROLES.map((r) => [r.key, saved?.[m.key]?.[r.key] || DEFAULT_PERMISSIONS[m.key][r.key]]))]));
}

/** A timetable is valid when every class has 5 days × 6 periods of { subject }. */
const validRoutine = (r) => isObj(r) && CLASSES.every((c) => Array.isArray(r[c]) && r[c].length === DATA.DAYS.length
  && r[c].every((day) => Array.isArray(day) && day.length === DATA.PERIODS.length && day.every((s) => isObj(s) && typeof s.subject === "string")));

/**
 * Turns saved (or restored) data into a full, valid state. Keeps each part that looks valid and
 * fills new or broken parts from the sample data — this also upgrades data saved by older versions.
 */
export function normalizeState(saved) {
  if (!isObj(saved) || !isObj(saved.db)) return null;
  const seed = seedDb();
  return {
    db: Object.fromEntries(COLLECTIONS.map((c) => [c, Array.isArray(saved.db[c]) ? saved.db[c] : seed[c]])),
    attendance: isObj(saved.attendance) ? saved.attendance : {},
    school: isObj(saved.school) ? { ...structuredClone(SEED.school), ...saved.school } : structuredClone(SEED.school),
    permissions: normalizePermissions(saved.permissions),
    routine: validRoutine(saved.routine) ? saved.routine : seedRoutine(),
  };
}

function loadSaved() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { /* blocked or corrupt storage */ }
  return null;
}

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [initial] = useState(loadSaved);
  const [db, setDb] = useState(() => initial?.db || seedDb());
  const [attendance, setAttendance] = useState(() => initial?.attendance || {}); // { "class|date": { studentId: "P" | "A" | "L" } }
  const [school, setSchool] = useState(() => initial?.school || structuredClone(SEED.school));
  const [permissions, setPermissions] = useState(() => initial?.permissions || normalizePermissions(null));
  const [routine, setRoutine] = useState(() => initial?.routine || seedRoutine()); // { class: [day][period] → { subject } }

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ db, attendance, school, permissions, routine })); } catch { /* storage full or blocked */ }
  }, [db, attendance, school, permissions, routine]);

  const value = useMemo(() => ({
    ...db,
    attendance, school, permissions, routine,
    add: (col, item) => {
      const id = PREFIX[col] + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
      setDb((d) => ({ ...d, [col]: [{ ...item, id }, ...d[col]] }));
      return id;
    },
    update: (col, id, patch) => setDb((d) => ({ ...d, [col]: d[col].map((x) => (x.id === id ? { ...x, ...(typeof patch === "function" ? patch(x) : patch) } : x)) })),
    remove: (col, ids) => {
      const set = new Set([].concat(ids));
      setDb((d) => ({ ...d, [col]: d[col].filter((x) => !set.has(x.id)) }));
    },
    /** Insert or replace many records by id (used for grades and assignments). */
    upsertMany: (col, items) => setDb((d) => {
      const byId = new Map(d[col].map((x) => [x.id, x]));
      items.forEach((it) => byId.set(it.id, { ...byId.get(it.id), ...it }));
      return { ...d, [col]: [...byId.values()] };
    }),
    saveAttendance: (key, marks) => setAttendance((a) => ({ ...a, [key]: marks })),
    saveSchool: (patch) => setSchool((s) => ({ ...s, ...patch })),
    /** Sets one timetable slot; subject "" = free period. */
    setSlot: (cls, day, period, subject) => setRoutine((r) => ({
      ...r, [cls]: r[cls].map((d, di) => (di !== day ? d : d.map((s, pi) => (pi === period ? { subject } : s)))),
    })),
    setPermission: (module, role, level) => setPermissions((p) => ({ ...p, [module]: { ...p[module], [role]: level } })),
    resetPermissions: () => setPermissions(normalizePermissions(null)),
    /** Everything needed to restore this browser's data elsewhere. */
    exportBackup: () => ({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: { db, attendance, school, permissions, routine } }),
    /** Replaces all data with a (normalized) backup. Returns false when the file isn't a valid backup. */
    restoreBackup: (file) => {
      if (!isObj(file) || file.app !== BACKUP_APP) return false;
      const s = normalizeState(file.data);
      if (!s) return false;
      setDb(s.db); setAttendance(s.attendance); setSchool(s.school); setPermissions(s.permissions); setRoutine(s.routine);
      return true;
    },
    resetData: () => {
      setDb(seedDb());
      setAttendance({});
      setSchool(structuredClone(SEED.school));
      setPermissions(normalizePermissions(null));
      setRoutine(seedRoutine());
    },
  }), [db, attendance, school, permissions, routine]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
