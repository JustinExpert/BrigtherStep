import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEMO_USERS } from "../data.js";

/*
 * DEMO AUTH — runs entirely in the browser.
 * Anyone can read these credentials in the JS bundle, so this only shows the UI flow.
 * For real use, send credentials to a server (or Supabase/Firebase Auth), get back an
 * httpOnly session cookie, and enforce roles on the server for every request.
 */
const KEY = "brighterstep.session";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;

const AuthContext = createContext(null);

function readSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* storage blocked */ }
  }
  return null;
}
function writeSession(user, remember) {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
    if (user) (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(user));
  } catch { /* storage blocked: session lasts until refresh */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  const login = useCallback(async (email, password, remember) => {
    if (Date.now() < lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
      throw new Error(`Too many attempts. Try again in ${secs}s.`);
    }
    await new Promise((r) => setTimeout(r, 500)); // simulate a network call
    const match = DEMO_USERS.find((u) => u.email === email.trim().toLowerCase() && u.password === password);
    if (!match) {
      const n = attempts + 1;
      setAttempts(n);
      if (n >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCK_MS);
        setAttempts(0);
        throw new Error("Too many attempts. Login locked for 30 seconds.");
      }
      throw new Error("Incorrect email or password.");
    }
    const session = { name: match.name, email: match.email, role: match.role };
    setAttempts(0);
    setUser(session);
    writeSession(session, remember);
    return session;
  }, [attempts, lockedUntil]);

  const logout = useCallback(() => {
    setUser(null);
    writeSession(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const homeFor = (role) => (role === "teacher" ? "/teacher" : "/");
