import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../lib/AuthContext.jsx";
import { DEMO_USERS } from "../data.js";
import Icon, { Logo } from "../components/Icon.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email, password, remember);
      const from = location.state?.from;
      navigate(from && from !== "/login" ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="login-art">
        <span className="blob" style={{ width: 420, height: 420, right: -140, top: -120 }} />
        <span className="blob" style={{ width: 260, height: 260, left: -80, bottom: 60 }} />
        <div className="logo"><Logo />EduNest</div>
        <div style={{ position: "relative" }}>
          <h1>Manage your whole school from one place.</h1>
          <p>Students, teachers, classes, attendance, exams and fees, all in one dashboard.</p>
        </div>
        <div className="login-stats">
          <div><b>64</b><span>Students</span></div>
          <div><b>12</b><span>Teachers</span></div>
          <div><b>6</b><span>Classes</span></div>
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form form" onSubmit={submit} noValidate={false}>
          <div>
            <h2>Welcome back 👋</h2>
            <p style={{ color: "var(--muted)", margin: "8px 0 14px" }}>Sign in to your account to continue.</p>
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          {info && <div className="alert info">{info}</div>}
          <label>Email
            <input className="input" type="email" autoComplete="username" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" />
          </label>
          <label>Password
            <div className="pw-field">
              <input className="input" type={show ? "text" : "password"} autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: 46 }} />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                <Icon name={show ? "eyeOff" : "eye"} />
              </button>
            </div>
          </label>
          <div className="row-between">
            <label><input type="checkbox" className="check" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember me</label>
            <button type="button" className="link" onClick={() => setInfo("Password reset needs a backend email service. In this demo, use a demo account below.")}>Forgot password?</button>
          </div>
          <button className="btn block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>

          <div className="demo-accounts">
            <p>Demo accounts (click to fill):</p>
            <div className="btns">
              {DEMO_USERS.map((u) => (
                <button key={u.email} type="button" className="btn light sm" style={{ flex: 1 }}
                  onClick={() => { setEmail(u.email); setPassword(u.password); setError(""); }}>
                  <Icon name={u.role === "admin" ? "lock" : "teacher"} />{u.role === "admin" ? "Admin" : "Teacher"}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
