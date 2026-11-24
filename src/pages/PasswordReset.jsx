import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { passwordProblems } from "../lib/crypto.js";
import { AuthShell, PasswordInput } from "./Login.jsx";

export function ForgotPassword() {
  const { requestReset } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [sent, setSent] = useState(false);
  const [demoLink, setDemoLink] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    let token = null;
    try { token = await requestReset(email); } catch { /* same message either way */ }
    setDemoLink(token ? `/reset-password/${token}` : null);
    setSent(true);
    setBusy(false);
  };

  return (
    <AuthShell>
      <form className="login-form form" onSubmit={submit}>
        <div>
          <h2>Reset your password</h2>
          <p style={{ color: "var(--muted)", margin: "8px 0 14px" }}>Enter your account email and we'll send you a reset link.</p>
        </div>
        {sent ? (
          <>
            {/* Same message whether or not the account exists, so emails can't be discovered. */}
            <div className="alert info">If an active account exists for <b>{email}</b>, a reset link has been prepared. It expires in 30 minutes.</div>
            {demoLink ? (
              <div className="demo-mail">
                <b>📬 Demo mailbox</b>
                <p>This demo has no email server, so the message is shown here instead.</p>
                <Link className="btn block" to={demoLink}>Open reset link</Link>
              </div>
            ) : (
              <p className="hint">Email isn't set up yet. If you don't get a link, ask the school admin to send you one from User Management.</p>
            )}
          </>
        ) : (
          <>
            <label>Email<input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brighterstep.test" /></label>
            <button className="btn block" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
            <p className="hint" style={{ margin: 0 }}>Sign in with a student ID and no email? Ask the school office for a new temporary password.</p>
          </>
        )}
        <p style={{ textAlign: "center", margin: 0, fontSize: 13 }}><Link className="link" to="/login">Back to sign in</Link></p>
      </form>
    </AuthShell>
  );
}

/** First sign-in on a temporary password from the school: the person must choose their own first. */
export function FirstPassword() {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const problems = pw ? passwordProblems(pw) : [];

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (pw !== confirm) return setError("New passwords don't match.");
    setBusy(true);
    try {
      await changePassword(current, pw); // the app opens once this succeeds
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="login-form form" onSubmit={submit}>
        <div>
          <h2>Set your password</h2>
          <p style={{ color: "var(--muted)", margin: "8px 0 14px" }}>
            Welcome, {user.name}. You signed in with a temporary password from the school.
            Choose your own password to continue: at least 8 characters with a letter and a number.
          </p>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <label>Temporary password<PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" label="Temporary password" /></label>
        <label>New password<PasswordInput value={pw} onChange={setPw} autoComplete="new-password" label="New password" /></label>
        {pw && <small style={{ marginTop: -6, color: problems.length ? "var(--red)" : "var(--green)" }}>{problems.length ? `Needs ${problems.join(", ")}` : "✓ Strong enough"}</small>}
        <label>Confirm new password<PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" label="Confirm new password" /></label>
        <button className="btn block" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
        <p style={{ textAlign: "center", margin: 0, fontSize: 13 }}><button type="button" className="link" onClick={logout}>Sign out</button></p>
      </form>
    </AuthShell>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const problems = pw ? passwordProblems(pw) : [];

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (pw !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const email = await resetPassword(token, pw);
      navigate("/login", { replace: true, state: { email, notice: "Password updated. You can sign in with your new password." } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="login-form form" onSubmit={submit}>
        <div>
          <h2>Choose a new password</h2>
          <p style={{ color: "var(--muted)", margin: "8px 0 14px" }}>Use at least 8 characters with a letter and a number.</p>
        </div>
        {error && <div className="alert error" role="alert">{error} {error.includes("expired") && <Link className="link" to="/forgot-password">Request a new link</Link>}</div>}
        <label>New password<PasswordInput value={pw} onChange={setPw} autoComplete="new-password" label="New password" /></label>
        {pw && <small style={{ marginTop: -6, color: problems.length ? "var(--red)" : "var(--green)" }}>{problems.length ? `Needs ${problems.join(", ")}` : "✓ Strong enough"}</small>}
        <label>Confirm new password<PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" label="Confirm new password" /></label>
        <button className="btn block" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
        <p style={{ textAlign: "center", margin: 0, fontSize: 13 }}><Link className="link" to="/login">Back to sign in</Link></p>
      </form>
    </AuthShell>
  );
}
