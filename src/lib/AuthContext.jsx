import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "./DataContext.jsx";
import { EMAIL_RE, hashPassword, passwordProblems, randomToken, sha256, verifyPassword } from "./crypto.js";
import { todayIso } from "./utils.js";

/*
 * DEMO AUTH — accounts live in this browser's storage (see DataContext).
 * Passwords are stored as salted PBKDF2 hashes, but everything still runs in the browser,
 * so this demonstrates the flows only. In production, move account checks to a server
 * (or Supabase/Firebase Auth), use httpOnly session cookies, and enforce roles server-side.
 */
const KEY = "brighterstep.session";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;
const RESET_MS = 30 * 60_000;
const SELF_REGISTER_ROLES = ["student", "parent", "teacher"];

const AuthContext = createContext(null);

function readSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const s = JSON.parse(store.getItem(KEY));
      if (s?.userId) return s;
    } catch { /* storage blocked */ }
  }
  return null;
}
function writeSession(session, remember) {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
    if (session) (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
  } catch { /* storage blocked: session lasts until refresh */ }
}

/** The account without any secret fields — safe to hand to the UI. */
const toPublic = ({ passwordHash, salt, resetTokenHash, resetExpires, ...rest }) => rest;
const norm = (email) => String(email || "").trim().toLowerCase();

export function AuthProvider({ children }) {
  const { users, add, update } = useData();
  const usersRef = useRef(users);
  usersRef.current = users;
  const [session, setSession] = useState(readSession);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  const raw = session ? users.find((u) => u.id === session.userId) : null;
  const active = raw && raw.status === "active" ? raw : null;
  const user = useMemo(() => (active ? toPublic(active) : null), [active]);

  // Sign out automatically if the account was deleted or deactivated.
  useEffect(() => {
    if (session && !active) { setSession(null); writeSession(null); }
  }, [session, active]);

  const findByEmail = (email) => usersRef.current.find((u) => norm(u.email) === norm(email));

  const login = useCallback(async (email, password, remember) => {
    if (Date.now() < lockedUntil) throw new Error(`Too many attempts. Try again in ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`);
    const found = findByEmail(email);
    // Always run the hash so a wrong email and a wrong password take the same time.
    const ok = found ? await verifyPassword(password, found) : (await hashPassword(password), false);
    if (!ok) {
      const n = attempts + 1;
      setAttempts(n);
      if (n >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCK_MS);
        setAttempts(0);
        throw new Error("Too many attempts. Login locked for 30 seconds.");
      }
      throw new Error("Incorrect email or password.");
    }
    setAttempts(0);
    if (found.status === "pending") throw new Error("Your account is waiting for approval by the school admin.");
    if (found.status === "inactive") throw new Error("This account has been deactivated. Please contact the school admin.");
    update("users", found.id, { lastLogin: new Date().toISOString() });
    const s = { userId: found.id };
    setSession(s);
    writeSession(s, remember);
    return toPublic(found);
  }, [attempts, lockedUntil, update]);

  const logout = useCallback(() => { setSession(null); writeSession(null); }, []);

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
    if (!active || !(await verifyPassword(current, active))) throw new Error("Your current password is incorrect.");
    const problems = passwordProblems(next);
    if (problems.length) throw new Error(`New password needs ${problems.join(", ")}.`);
    if (current === next) throw new Error("Choose a password different from your current one.");
    update("users", active.id, await hashPassword(next));
  }, [active, update]);

  const updateProfile = useCallback((patch) => {
    if (!active) return;
    const allowed = ["name", "phone", "idNumber", "photo"];
    update("users", active.id, Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k))));
  }, [active, update]);

  const value = useMemo(() => ({ user, login, logout, register, createUser, requestReset, resetPassword, changePassword, updateProfile }),
    [user, login, logout, register, createUser, requestReset, resetPassword, changePassword, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const homeFor = (role) => ({ teacher: "/teacher", student: "/student", parent: "/parent" }[role] || "/");
