import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DATA } from "../data.js";

// Store with generic CRUD per collection, saved to this browser's localStorage so changes
// survive a refresh. Each browser/device has its own copy — nothing is shared between users.
// To use a real backend, replace add/update/remove with API calls.
const COLLECTIONS = ["students", "teachers", "notices", "books", "classes", "subjects", "exams", "routes", "rooms", "onlineExams", "submissions"];
const PREFIX = { students: "STU-", teachers: "TCH-", notices: "N", books: "BK-", classes: "CLS-", subjects: "SUB-", exams: "EX-", routes: "TR-", rooms: "HS-", onlineExams: "OE-", submissions: "RES-" };
const STORAGE_KEY = "brighterstep.data.v1";

const seedDb = () => Object.fromEntries(COLLECTIONS.map((c) => [c, DATA[c]]));

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved.db !== "object" || !saved.db) return null;
    // Keep each saved collection that looks valid; fill in any new or broken ones from the sample data.
    // (This also upgrades data saved by older versions that didn't have online exams yet.)
    const seed = seedDb();
    const db = Object.fromEntries(COLLECTIONS.map((c) => [c, Array.isArray(saved.db[c]) ? saved.db[c] : seed[c]]));
    const attendance = saved.attendance && typeof saved.attendance === "object" ? saved.attendance : {};
    return { db, attendance };
  } catch { /* blocked or corrupt storage */ }
  return null;
}

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [initial] = useState(loadSaved);
  const [db, setDb] = useState(() => initial?.db || seedDb());
  const [attendance, setAttendance] = useState(() => initial?.attendance || {}); // { "class|date": { studentId: "P" | "A" | "L" } }

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ db, attendance })); } catch { /* storage full or blocked */ }
  }, [db, attendance]);

  const value = useMemo(() => ({
    ...db,
    attendance,
    add: (col, item) => {
      const id = PREFIX[col] + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
      setDb((d) => ({ ...d, [col]: [{ ...item, id }, ...d[col]] }));
      return id;
    },
    update: (col, id, patch) => setDb((d) => ({ ...d, [col]: d[col].map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    remove: (col, ids) => {
      const set = new Set([].concat(ids));
      setDb((d) => ({ ...d, [col]: d[col].filter((x) => !set.has(x.id)) }));
    },
    saveAttendance: (key, marks) => setAttendance((a) => ({ ...a, [key]: marks })),
    resetData: () => { setDb(seedDb()); setAttendance({}); },
  }), [db, attendance]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
