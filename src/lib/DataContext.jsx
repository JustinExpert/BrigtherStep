import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SEED } from "../data.js";
import { DEFAULT_PERMISSIONS } from "./permissions.js";
import { api, notify } from "./api.js";

// School data lives on the server (MongoDB, via /api/data). After sign-in the app loads what the
// user may see; each change updates the screen at once and is then saved by the server, which
// checks permissions again. If the server refuses a change, the data is reloaded and the reason shown.
const COLLECTIONS = ["students", "teachers", "notices", "classes", "subjects", "users", "assignments", "grades", "activities"];
const PREFIX = { students: "STU-", teachers: "TCH-", notices: "N", classes: "CLS-", subjects: "SUB-", users: "USR-", assignments: "ASG-", grades: "GRD-", activities: "ACT-" };
export const BACKUP_APP = "brighterstep";

const emptyDb = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
const EMPTY = { db: emptyDb(), attendance: {}, school: structuredClone(SEED.school), permissions: structuredClone(DEFAULT_PERMISSIONS), routine: {} };

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [publicInfo, setPublicInfo] = useState(null); // school name + totals for the sign-in page
  const queue = useRef(Promise.resolve());
  const loadId = useRef(0);

  useEffect(() => {
    api("public").then((d) => setPublicInfo({ school: d.school, counts: d.counts }), () => {});
  }, []);

  /** Loads everything the signed-in user may see. */
  const load = useCallback(async () => {
    const id = ++loadId.current;
    setStatus((s) => (s === "ready" ? s : "loading"));
    try {
      const { data } = await api("data");
      if (id !== loadId.current) return;
      setState({ db: { ...emptyDb(), ...data.db }, attendance: data.attendance, school: data.school, permissions: data.permissions, routine: data.routine });
      setStatus("ready");
    } catch {
      if (id === loadId.current) setStatus("error");
    }
  }, []);

  const clear = useCallback(() => { loadId.current++; setState(EMPTY); setStatus("idle"); }, []);

  /** Sends one change to the server, in order. On refusal: show why and reload the true state. */
  const send = useCallback((path, body) => {
    const p = queue.current.then(() => api(path, body));
    queue.current = p.catch(() => {});
    p.catch((e) => { if (e.status !== 401) { notify(e.message); load(); } });
    return p;
  }, [load]);

  const setDb = (fn) => setState((s) => ({ ...s, db: fn(s.db) }));
  const merge = (patch) => setState((s) => ({ ...s, ...patch }));

  const actions = useMemo(() => ({
    load, clear, send,
    add: (col, item) => {
      const id = PREFIX[col] + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
      setDb((d) => ({ ...d, [col]: [{ ...item, id }, ...d[col]] }));
      send("data", { op: "add", col, item: { ...item, id } });
      return id;
    },
    update: (col, id, patch) => {
      setDb((d) => ({ ...d, [col]: d[col].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      if (col === "users") send("users", { op: "update", id, patch });
      else send("data", { op: "update", col, id, patch });
    },
    remove: (col, ids) => {
      const list = [].concat(ids);
      const set = new Set(list);
      setDb((d) => ({ ...d, [col]: d[col].filter((x) => !set.has(x.id)) }));
      if (col === "users") send("users", { op: "delete", ids: list });
      else send("data", { op: "remove", col, ids: list });
    },
    /** Insert or replace many records by id (used for grades and assignments). */
    upsertMany: (col, items) => {
      setDb((d) => {
        const byId = new Map(d[col].map((x) => [x.id, x]));
        items.forEach((it) => byId.set(it.id, { ...byId.get(it.id), ...it }));
        return { ...d, [col]: [...byId.values()] };
      });
      if (items.length) send("data", { op: "upsertMany", col, items });
    },
    /** Adds or replaces one record locally only (the server already has it). */
    putLocal: (col, record) => setDb((d) => ({ ...d, [col]: [record, ...d[col].filter((x) => x.id !== record.id)] })),
    saveAttendance: (key, marks) => {
      setState((s) => ({ ...s, attendance: { ...s.attendance, [key]: marks } }));
      send("data", { op: "attendance", key, marks });
    },
    saveSchool: (patch) => {
      setState((s) => ({ ...s, school: { ...s.school, ...patch } }));
      send("data", { op: "school", patch });
    },
    /** Sets one timetable slot; subject "" = free period. */
    setSlot: (cls, day, period, subject) => {
      setState((s) => ({ ...s, routine: { ...s.routine, [cls]: s.routine[cls].map((d, di) => (di !== day ? d : d.map((x, pi) => (pi === period ? { subject } : x)))) } }));
      send("data", { op: "slot", cls, day, period, subject });
    },
    setPermission: (module, role, level) => {
      setState((s) => ({ ...s, permissions: { ...s.permissions, [module]: { ...s.permissions[module], [role]: level } } }));
      send("data", { op: "permission", module, role, level });
    },
    resetPermissions: () => {
      merge({ permissions: structuredClone(DEFAULT_PERMISSIONS) });
      send("data", { op: "resetPermissions" });
    },
    /** Full backup from the server (Super Admin). */
    exportBackup: async () => (await api("data?backup=1")).backup,
    /** Replaces all server data with a backup. Resolves to an error message, or null on success. */
    restoreBackup: async (file) => {
      try { await api("data", { op: "restore", backup: file }); } catch (e) { return e.message; }
      await load();
      return null;
    },
    resetData: async () => {
      await send("data", { op: "reset" });
      await load();
    },
  }), [load, clear, send]);

  const value = useMemo(() => ({ ...state.db, attendance: state.attendance, school: state.school, permissions: state.permissions, routine: state.routine, status, publicInfo, ...actions }),
    [state, status, publicInfo, actions]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
