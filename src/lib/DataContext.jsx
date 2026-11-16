import { createContext, useContext, useMemo, useState } from "react";
import { DATA } from "../data.js";

// In-memory store with generic CRUD per collection.
// To use a real backend, replace add/update/remove with API calls.
const COLLECTIONS = ["students", "teachers", "notices", "books", "classes", "subjects", "exams", "routes", "rooms"];
const PREFIX = { students: "STU-", teachers: "TCH-", notices: "N", books: "BK-", classes: "CLS-", subjects: "SUB-", exams: "EX-", routes: "TR-", rooms: "HS-" };

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [db, setDb] = useState(() => Object.fromEntries(COLLECTIONS.map((c) => [c, DATA[c]])));
  const [attendance, setAttendance] = useState({}); // { "class|date": { studentId: "P" | "A" | "L" } }

  const value = useMemo(() => ({
    ...db,
    attendance,
    add: (col, item) => setDb((d) => ({ ...d, [col]: [{ ...item, id: PREFIX[col] + Date.now().toString(36).toUpperCase() }, ...d[col]] })),
    update: (col, id, patch) => setDb((d) => ({ ...d, [col]: d[col].map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    remove: (col, ids) => {
      const set = new Set([].concat(ids));
      setDb((d) => ({ ...d, [col]: d[col].filter((x) => !set.has(x.id)) }));
    },
    saveAttendance: (key, marks) => setAttendance((a) => ({ ...a, [key]: marks })),
  }), [db, attendance]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
