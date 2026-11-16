import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { ROLE_LABEL } from "../lib/permissions.js";
import Icon, { Logo } from "../components/Icon.jsx";

export const DEMO_ACCOUNTS = [
  ["superadmin", "superadmin@brighterstep.test", "super123", "shield"],
  ["admin", "admin@brighterstep.test", "admin123", "lock"],
  ["teacher", "teacher@brighterstep.test", "teacher123", "teacher"],
  ["student", "student@brighterstep.test", "student123", "cap"],
  ["parent", "parent@brighterstep.test", "parent123", "parents"],
];

/** Shared two-column frame for login, register and password reset. */
export function AuthShell({ children }) {
  // Before sign-in only the school's name and totals are available (from /api/public).
  const { publicInfo } = useData();
  const school = publicInfo?.school || { name: "BrighterStep", motto: "" };
  const n = (k) => publicInfo?.counts?.[k] ?? "—";
  return (
    <div className="login">
      <section className="login-art">
        <span className="blob" style={{ width: 420, height: 420, right: -140, top: -120 }} />
        <span className="blob" style={{ width: 260, height: 260, left: -80, bottom: 60 }} />
        <div className="logo"><Logo />BrighterStep</div>
        <div style={{ position: "relative" }}>
          <h1>{school.name}</h1>
          <p>{school.motto} Students, teachers, parents, classes, timetables, attendance and announcements, all in one place.</p>
        </div>
        <div className="login-stats">
          <div><b>{n("students")}</b><span>Students</span></div>
          <div><b>{n("teachers")}</b><span>Teachers</span></div>
          <div><b>{n("classes")}</b><span>Classes</span></div>
        </div>
      </section>
      <section className="login-form-wrap">{children}</section>
    </div>
  );
}

export const PasswordInput = ({ value, onChange, autoComplete = "current-password", placeholder = "••••••••", label = "Password" }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-field">
      <input className="input" type={show ? "text" : "password"} autoComplete={autoComplete} required maxLength={128}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ paddingRight: 46 }} aria-label={label} />
      <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
        <Icon name={show ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
};

export default function Login() {
  const { user, checking, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (checking) return null;
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email, password, remember);
      const from = location.state?.from;
      navigate(from && !["/login", "/register", "/forgot-password"].includes(from) ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="login-form form" onSubmit={submit}>
        <div>
          <h2>Welcome back 👋</h2>
          <p style={{ color: "var(--muted)", margin: "8px 0 14px" }}>Sign in to your account to continue.</p>
        </div>
        {location.state?.notice && <div className="alert info">{location.state.notice}</div>}
        {error && <div className="alert error" role="alert">{error}</div>}
        <label>Email
          <input className="input" type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@brighterstep.test" />
        </label>
        <label>Password<PasswordInput value={password} onChange={setPassword} /></label>
        <div className="row-between">
          <label><input type="checkbox" className="check" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember me</label>
          <Link className="link" to="/forgot-password" state={{ email }}>Forgot password?</Link>
        </div>
        <button className="btn block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p style={{ textAlign: "center", margin: 0, fontSize: 13, color: "var(--muted)" }}>
          New to {"BrighterStep"}? <Link className="link" to="/register">Create an account</Link>
        </p>

        <div className="demo-accounts">
          <p>Demo accounts (click to fill):</p>
          <div className="btns">
            {DEMO_ACCOUNTS.map(([role, mail, pw, icon]) => (
              <button key={role} type="button" className="btn light sm" title={`${mail} / ${pw}`}
                onClick={() => { setEmail(mail); setPassword(pw); setError(""); }}>
                <Icon name={icon} />{ROLE_LABEL[role]}
              </button>
            ))}
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
