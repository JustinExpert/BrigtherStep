import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DATA, SEED } from "../data.js";
import { DEFAULT_PERMISSIONS, MODULES, ROLES } from "./permissions.js";

// Store with generic CRUD per collection, saved to this browser's localStorage so changes
// survive a refresh. Each browser/device has its own copy — nothing is shared between users.
// To use a real backend, replace these functions with API calls.
const COLLECTIONS = ["students", "teachers", "notices", "classes", "subjects", "users", "assignments", "grades"];
const PREFIX = { students: "STU-", teachers: "TCH-", notices: "N", classes: "CLS-", subjects: "SUB-", users: "USR-", assignments: "ASG-", grades: "GRD-" };
const STORAGE_KEY = "brighterstep.data.v1";

const SOURCE = { ...DATA, users: SEED.users };
const seedDb = () => Object.fromEntries(COLLECTIONS.map((c) => [c, structuredClone(SOURCE[c])]));
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

/** Fill any missing module/role cells from the defaults. */
function normalizePermissions(saved) {
  return Object.fromEntries(MODULES.map((m) => [m.key, Object.fromEntries(ROLES.map((r) => [r.key, saved?.[m.key]?.[r.key] || DEFAULT_PERMISSIONS[m.key][r.key]]))]));
}

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!isObj(saved) || !isObj(saved.db)) return null;
    // Keep each saved collection that looks valid; fill in new or broken ones from the sample data.
    // (This also upgrades data saved by older versions of the app.)
    const seed = seedDb();
    return {
      db: Object.fromEntries(COLLECTIONS.map((c) => [c, Array.isArray(saved.db[c]) ? saved.db[c] : seed[c]])),
      attendance: isObj(saved.attendance) ? saved.attendance : {},
      school: isObj(saved.school) ? { ...SEED.school, ...saved.school } : structuredClone(SEED.school),
      permissions: normalizePermissions(saved.permissions),
    };
  } catch { /* blocked or corrupt storage */ }
  return null;
}

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [initial] = useState(loadSaved);
  const [db, setDb] = useState(() => initial?.db || seedDb());
  const [attendance, setAttendance] = useState(() => initial?.attendance || {}); // { "class|date": { studentId: "P" | "A" | "L" } }
  const [school, setSchool] = useState(() => initial?.school || structuredClone(SEED.school));
  const [permissions, setPermissions] = useState(() => initial?.permissions || normalizePermissions(null));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ db, attendance, school, permissions })); } catch { /* storage full or blocked */ }
  }, [db, attendance, school, permissions]);

  const value = useMemo(() => ({
    ...db,
    attendance, school, permissions,
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
    setPermission: (module, role, level) => setPermissions((p) => ({ ...p, [module]: { ...p[module], [role]: level } })),
    resetPermissions: () => setPermissions(normalizePermissions(null)),
    resetData: () => {
      setDb(seedDb());
      setAttendance({});
      setSchool(structuredClone(SEED.school));
      setPermissions(normalizePermissions(null));
    },
  }), [db, attendance, school, permissions]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
