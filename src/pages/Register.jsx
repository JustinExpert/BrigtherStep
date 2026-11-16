import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { passwordProblems } from "../lib/crypto.js";
import { AuthShell, PasswordInput } from "./Login.jsx";

const ROLE_HELP = {
  student: "Your student ID (e.g. STU-43105) from the school office",
  parent: "Your child's student ID (e.g. STU-43105)",
  teacher: "Your staff ID (e.g. TCH-203)",
};

export default function Register() {
  const { user, register } = useAuth();
  const { students, teachers } = useData();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", role: "student", linkId: "", phone: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: typeof e === "string" ? e : e.target.value });

  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const problems = f.password ? passwordProblems(f.password) : [];

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (f.password !== f.confirm) return setError("Passwords don't match.");
    const id = f.linkId.trim().toUpperCase();
    const links = {};
    if (id) {
      if (f.role === "teacher") {
        if (!teachers.some((t) => t.id === id)) return setError(`No staff record with ID ${id}. Check with the school office.`);
        links.teacherId = id;
      } else {
        if (!students.some((s) => s.id === id)) return setError(`No student record with ID ${id}. Check with the school office.`);
        if (f.role === "student") links.studentId = id; else links.childIds = [id];
      }
    }
    setBusy(true);
    try {
      await register({ name: f.name, email: f.email, role: f.role, password: f.password, phone: f.phone, idNumber: id, links });
      navigate("/login", { replace: true, state: { email: f.email, notice: "Account created! The school admin needs to approve it before you can sign in." } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="login-form form" onSubmit={submit}>
        <div>
          <h2>Create an account</h2>
          <p style={{ color: "var(--muted)", margin: "8px 0 14px" }}>The school admin will review and activate it.</p>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <label>I am a
          <div className="tabs" role="radiogroup" style={{ width: "100%" }}>
            {["student", "parent", "teacher"].map((r) => (
              <button key={r} type="button" role="radio" aria-checked={f.role === r} className={f.role === r ? "on" : ""} style={{ flex: 1, textTransform: "capitalize" }}
                onClick={() => setF({ ...f, role: r })}>{r}</button>
            ))}
          </div>
        </label>
        <label>Full name<input className="input" required maxLength={80} autoComplete="name" value={f.name} onChange={set("name")} /></label>
        <label>Email<input className="input" type="email" required autoComplete="email" value={f.email} onChange={set("email")} placeholder="you@brighterstep.test" /></label>
        <label>{f.role === "teacher" ? "Staff ID" : "Student ID"} (optional)
          <input className="input" maxLength={20} value={f.linkId} onChange={set("linkId")} placeholder={ROLE_HELP[f.role]} />
        </label>
        <label>Phone (optional)<input className="input" type="tel" maxLength={30} autoComplete="tel" value={f.phone} onChange={set("phone")} /></label>
        <label>Password<PasswordInput value={f.password} onChange={set("password")} autoComplete="new-password" /></label>
        {f.password && (
          <small style={{ marginTop: -6, color: problems.length ? "var(--red)" : "var(--green)" }}>
            {problems.length ? `Needs ${problems.join(", ")}` : "✓ Strong enough"}
          </small>
        )}
        <label>Confirm password<PasswordInput value={f.confirm} onChange={set("confirm")} autoComplete="new-password" label="Confirm password" /></label>
        <button className="btn block" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        <p style={{ textAlign: "center", margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Already have an account? <Link className="link" to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
