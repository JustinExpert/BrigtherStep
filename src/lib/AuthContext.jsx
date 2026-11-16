import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "./DataContext.jsx";
import { EMAIL_RE, hashPassword, passwordProblems, randomToken, sha256 } from "./crypto.js";
import { todayIso } from "./utils.js";

/*
 * Sign-in, sign-out, the session and password changes go through the server (/api/auth/*);
 * the session is an HttpOnly cookie that browser JavaScript can't read.
 * Still browser-only until the data moves to the server: registration, admin-created accounts,
 * password reset and profile edits (they change this browser's copy of the users list).
 */
const RESET_MS = 30 * 60_000;
const SELF_REGISTER_ROLES = ["student", "parent", "teacher"];

const AuthContext = createContext(null);

// Remove the browser-stored session left by earlier versions.
try { sessionStorage.removeItem("brighterstep.session"); localStorage.removeItem("brighterstep.session"); } catch { /* storage blocked */ }

/** Calls the auth API. Returns the JSON body; throws the server's error message on failure. */
async function api(path, body) {
  const init = body === undefined
    ? { credentials: "same-origin" }
    : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let res;
  try { res = await fetch(`/api/auth/${path}`, init); } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/** The account without any secret fields — safe to hand to the UI. */
const toPublic = ({ passwordHash, salt, resetTokenHash, resetExpires, ...rest }) => rest;
const norm = (email) => String(email || "").trim().toLowerCase();

export function AuthProvider({ children }) {
  const { users, add, update } = useData();
  const usersRef = useRef(users);
  usersRef.current = users;
  // The account the server says is signed in: undefined while checking, null when signed out.
  const [serverUser, setServerUser] = useState(undefined);

  useEffect(() => {
    let live = true;
    api("me").then((d) => live && setServerUser(d.user), () => live && setServerUser(null));
    return () => { live = false; };
  }, []);

  // Prefer this browser's copy of the account (it holds in-app edits such as the photo).
  const local = serverUser ? users.find((u) => u.id === serverUser.id) : null;
  const user = useMemo(() => (local ? toPublic(local) : serverUser || null), [local, serverUser]);
  const checking = serverUser === undefined;

  const findByEmail = (email) => usersRef.current.find((u) => norm(u.email) === norm(email));

  const login = useCallback(async (email, password, remember) => {
    const { user: u } = await api("login", { email, password, remember: !!remember });
    if (usersRef.current.some((x) => x.id === u.id)) update("users", u.id, { lastLogin: u.lastLogin || new Date().toISOString() });
    setServerUser(u);
    return u;
  }, [update]);

  const logout = useCallback(async () => {
    setServerUser(null);
    try { await api("logout", {}); } catch { /* the cookie still expires on its own */ }
  }, []);

  /** Shared validation + hashing for new accounts (self-registration or admin-created). */
  const createAccount = useCallback(async ({ name, email, role, password, phone = "", idNumber = "", links = {} }, status) => {
    if (!name?.trim()) throw new Error("Enter a full name.");
    if (!EMAIL_RE.test(norm(email))) throw new Error("Enter a valid email address.");
    if (findByEmail(email)) throw new Error("An account with this email already exists.");
    const problems = passwordProblems(password);
    if (problems.length) throw new Error(`Password needs ${problems.join(", ")}.`);
    const secret = await hashPassword(password);
    return add("users", {
      name: name.trim(), email: norm(email), role, status, phone: phone.trim(), idNumber: idNumber.trim(), photo: null,
      createdAt: todayIso(), lastLogin: null, ...links, ...secret,
    });
  }, [add]);

  const register = useCallback((data) => {
    if (!SELF_REGISTER_ROLES.includes(data.role)) throw new Error("Choose Student, Parent or Teacher.");
    return createAccount({ ...data }, "pending").then((id) => {
      update("users", id, { note: "Self-registered" });
      return id;
    });
  }, [createAccount, update]);

  const createUser = useCallback((data) => createAccount(data, "active"), [createAccount]);

  /** Returns a one-time token (in production this is emailed, never shown). Null if no active account. */
  const requestReset = useCallback(async (email) => {
    const found = findByEmail(email);
    const token = randomToken();
    const tokenHash = await sha256(token);
    if (!found || found.status !== "active") return null;
    update("users", found.id, { resetTokenHash: tokenHash, resetExpires: Date.now() + RESET_MS });
    return token;
  }, [update]);

  const resetPassword = useCallback(async (token, password) => {
    const tokenHash = await sha256(token || "");
    const found = usersRef.current.find((u) => u.resetTokenHash && u.resetTokenHash === tokenHash);
    if (!found || !(found.resetExpires > Date.now())) throw new Error("This reset link is invalid or has expired. Please request a new one.");
    const problems = passwordProblems(password);
    if (problems.length) throw new Error(`Password needs ${problems.join(", ")}.`);
    const secret = await hashPassword(password);
    update("users", found.id, { ...secret, resetTokenHash: null, resetExpires: null });
    return found.email;
  }, [update]);

  const changePassword = useCallback(async (current, next) => {
    const problems = passwordProblems(next);
    if (problems.length) throw new Error(`New password needs ${problems.join(", ")}.`);
    if (current === next) throw new Error("Choose a password different from your current one.");
    await api("change-password", { current, next });
  }, []);

  const active = local;
  const updateProfile = useCallback((patch) => {
    if (!active) return;
    const allowed = ["name", "phone", "idNumber", "photo"];
    update("users", active.id, Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k))));
  }, [active, update]);

  const value = useMemo(() => ({ user, checking, login, logout, register, createUser, requestReset, resetPassword, changePassword, updateProfile }),
    [user, checking, login, logout, register, createUser, requestReset, resetPassword, changePassword, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const homeFor = (role) => ({ teacher: "/teacher", student: "/student", parent: "/parent" }[role] || "/");
