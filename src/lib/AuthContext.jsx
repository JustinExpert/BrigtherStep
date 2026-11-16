import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useData } from "./DataContext.jsx";
import { api, notify } from "./api.js";
import { passwordProblems } from "./crypto.js";

/*
 * Every account action goes through the server (/api/auth/* and /api/users). The session is a
 * signed JWT in an HttpOnly cookie that browser JavaScript can't read; the server checks it,
 * and the account's role and status, on every request.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const data = useData();
  const { users, load, clear, putLocal, status } = data;
  // The account the server says is signed in: undefined while checking, null when signed out.
  const [serverUser, setServerUser] = useState(undefined);

  useEffect(() => {
    let live = true;
    api("auth/me").then((d) => { if (live) { setServerUser(d.user); load(); } }, () => live && setServerUser(null));
    // A data request found the session gone (expired, signed out elsewhere, or deactivated).
    const ended = () => { setServerUser(null); clear(); };
    window.addEventListener("bs:signed-out", ended);
    return () => { live = false; window.removeEventListener("bs:signed-out", ended); };
  }, [load, clear]);

  // The loaded copy of this account is kept up to date by in-app edits (e.g. a new photo).
  const local = serverUser ? users.find((u) => u.id === serverUser.id) : null;
  const user = useMemo(() => local || serverUser || null, [local, serverUser]);
  const checking = serverUser === undefined || (!!serverUser && (status === "idle" || status === "loading"));

  const login = useCallback(async (email, password, remember) => {
    const { user: u } = await api("auth/login", { email, password, remember: !!remember });
    setServerUser(u);
    await load();
    return u;
  }, [load]);

  const logout = useCallback(async () => {
    setServerUser(null);
    clear();
    try { await api("auth/logout", {}); } catch { /* the cookie still expires on its own */ }
  }, [clear]);

  /** Self-registration: creates a pending account for the school admin to approve. */
  const register = useCallback(async ({ name, email, role, password, phone = "", idNumber = "" }) => {
    await api("auth/register", { name, email, role, password, phone, idNumber });
  }, []);

  /** Admin creates an active account. Returns the new id. */
  const createUser = useCallback(async ({ links = {}, ...fields }) => {
    const { user: u } = await api("users", { op: "create", ...fields, links });
    putLocal("users", u);
    return u.id;
  }, [putLocal]);

  /** Forgot password. Resolves to the demo reset token (only when the server's demo mailbox is on) or null. */
  const requestReset = useCallback(async (email) => (await api("auth/reset", { op: "request", email })).demoToken, []);

  /** Admin: a one-time reset token for an account they manage (null if the account isn't active). */
  const adminResetLink = useCallback(async (id) => (await api("users", { op: "resetLink", id })).token, []);

  const resetPassword = useCallback(async (token, password) => (await api("auth/reset", { op: "confirm", token, password })).email, []);

  const changePassword = useCallback(async (current, next) => {
    const problems = passwordProblems(next);
    if (problems.length) throw new Error(`New password needs ${problems.join(", ")}.`);
    if (current === next) throw new Error("Choose a password different from your current one.");
    await api("auth/change-password", { current, next });
  }, []);

  const updateProfile = useCallback((patch) => {
    if (!user) return;
    const allowed = ["name", "phone", "idNumber", "photo"];
    const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
    putLocal("users", { ...user, ...clean });
    api("auth/profile", clean).catch((e) => { notify(e.message); load(); });
  }, [user, putLocal, load]);

  const value = useMemo(() => ({ user, checking, login, logout, register, createUser, requestReset, adminResetLink, resetPassword, changePassword, updateProfile }),
    [user, checking, login, logout, register, createUser, requestReset, adminResetLink, resetPassword, changePassword, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const homeFor = (role) => ({ teacher: "/teacher", student: "/student", parent: "/parent" }[role] || "/");
