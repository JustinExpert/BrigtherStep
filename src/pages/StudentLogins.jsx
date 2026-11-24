import { useState } from "react";
import { api } from "../lib/api.js";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { EMAIL_RE } from "../lib/crypto.js";
import { useSections } from "../lib/sections.js";
import Select from "../components/Select.jsx";
import Icon from "../components/Icon.jsx";
import { Badge } from "../components/ui.jsx";

// Young learners usually don't need their own login: the parent account sees everything.
const OWN_LOGIN_LEVELS = ["junior_high", "senior_high", "college"];

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Opens a printable sign-in slip in a new window: one block per account, to cut and hand over. */
export function printSlip({ school, student, section, accounts }) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return false;
  const site = window.location.origin;
  const blocks = accounts.map((a) => `
    <section class="slip">
      <header><b>${esc(school.name)}</b><span>Sign-in details · ${esc(a.label)}</span></header>
      <dl>
        <dt>Name</dt><dd>${esc(a.name)}</dd>
        <dt>Student</dt><dd>${esc(student.name)} (${esc(student.id)}) · ${esc(section)}</dd>
        <dt>Website</dt><dd>${esc(site)}</dd>
        <dt>Sign in with</dt><dd class="big">${esc(a.signIn)}</dd>
        <dt>Password</dt><dd class="big">${a.password ? esc(a.password) : "Your existing password (this child was added to your account)"}</dd>
      </dl>
      ${a.password ? "<p>This is a temporary password. The first time you sign in you will be asked to choose your own. Keep this slip private, then destroy it.</p>" : ""}
      <p class="small">Forgot your password later? Ask the school office for a new temporary password.</p>
    </section>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Sign-in slip – ${esc(student.name)}</title>
    <style>
      body { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d1b26; margin: 24px; }
      .slip { border: 1.5px dashed #8a83a3; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; break-inside: avoid; }
      header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 10px; }
      header span { color: #5b5670; }
      dl { display: grid; grid-template-columns: 120px 1fr; gap: 6px 12px; margin: 0 0 10px; }
      dt { color: #5b5670; } dd { margin: 0; font-weight: 600; }
      .big { font: 600 18px/1.3 ui-monospace, Consolas, monospace; letter-spacing: .04em; }
      p { margin: 6px 0 0; } .small { color: #5b5670; font-size: 12px; }
      .print { margin-bottom: 16px; } @media print { .print { display: none; } body { margin: 0; } }
    </style></head><body>
    <button class="print" onclick="window.print()">Print</button>${blocks}
    <script>window.onload = () => window.print();</script></body></html>`);
  w.document.close();
  return true;
}

function LoginsForm({ student, hasOwn, onCancel, onDone }) {
  const { users } = useData();
  const sections = useSections();
  const level = sections.byId.get(student.class)?.level;
  const [f, setF] = useState({
    own: !hasOwn && OWN_LOGIN_LEVELS.includes(level), ownEmail: "",
    parent: "new", parentId: "", parentName: student.parent || "", parentEmail: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const parents = users.filter((u) => u.role === "parent" && !(u.childIds || []).includes(student.id));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const ownEmail = f.ownEmail.trim().toLowerCase(), parentEmail = f.parentEmail.trim().toLowerCase();
    if (f.own && ownEmail && !EMAIL_RE.test(ownEmail)) return setError("Enter a valid email for the student, or leave it empty.");
    if (f.parent === "new") {
      if (!f.parentName.trim()) return setError("Enter the parent's full name.");
      if (!EMAIL_RE.test(parentEmail)) return setError("Enter the parent's email. Parents sign in with it.");
    }
    if (f.parent === "existing" && !f.parentId) return setError("Choose the parent account.");
    if (!f.own && f.parent === "none") return setError("Choose a student account, a parent account, or both.");
    setBusy(true);
    try {
      const out = await api("users", {
        op: "studentLogins", studentId: student.id,
        student: f.own ? { email: ownEmail } : null,
        parent: f.parent === "new" ? { name: f.parentName.trim(), email: parentEmail } : f.parent === "existing" ? { id: f.parentId } : null,
      });
      onDone(out);
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="alert error" role="alert">{error}</div>}
      <p className="hint" style={{ marginTop: 0 }}>
        The school picks a temporary password for each account and prints a slip to hand over. Each person
        chooses their own password the first time they sign in.
      </p>

      <fieldset className="form-grid" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 8 }}>Student's own login</legend>
        {hasOwn ? <p className="hint" style={{ gridColumn: "1 / -1", margin: 0 }}>{student.name} already has a login.</p> : (
          <>
            <label style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={f.own} onChange={(e) => setF({ ...f, own: e.target.checked })} />
              Make a login for {student.name}
            </label>
            {f.own && (
              <label style={{ gridColumn: "1 / -1" }}>Student's email (optional)
                <input className="input" type="email" value={f.ownEmail} onChange={(e) => setF({ ...f, ownEmail: e.target.value })} placeholder={`None: signs in with ${student.id}`} />
              </label>
            )}
            {!OWN_LOGIN_LEVELS.includes(level) && <small className="hint" style={{ gridColumn: "1 / -1" }}>Kinder and Elementary learners usually only need the parent account.</small>}
          </>
        )}
      </fieldset>

      <fieldset className="form-grid" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 8 }}>Parent / guardian login</legend>
        <label style={{ gridColumn: "1 / -1" }}>Parent account
          <Select value={f.parent} onChange={(v) => setF({ ...f, parent: v })} aria-label="Parent account" options={[
            { value: "new", label: "Make a new parent login" },
            ...(parents.length ? [{ value: "existing", label: "Add to an existing parent login (e.g. a sibling's)" }] : []),
            { value: "none", label: "No parent login now" },
          ]} />
        </label>
        {f.parent === "new" && (
          <>
            <label>Parent's full name *<input className="input" maxLength={100} value={f.parentName} onChange={(e) => setF({ ...f, parentName: e.target.value })} /></label>
            <label>Parent's email *<input className="input" type="email" value={f.parentEmail} onChange={(e) => setF({ ...f, parentEmail: e.target.value })} placeholder="name@example.com" /></label>
          </>
        )}
        {f.parent === "existing" && (
          <label style={{ gridColumn: "1 / -1" }}>Existing parent login
            <Select value={f.parentId} onChange={(v) => setF({ ...f, parentId: v })} aria-label="Existing parent login" searchable placeholder="Choose a parent…"
              options={parents.map((u) => ({ value: u.id, label: u.name, hint: u.email }))} />
          </label>
        )}
      </fieldset>

      <div className="form-actions">
        <button type="button" className="btn light" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create logins"}</button>
      </div>
    </form>
  );
}

/** Staff with User Management access: this student's logins, and a button to make them at enrolment. */
export function StudentLoginsCard({ student }) {
  const { users, school, putLocal } = useData();
  const { openModal, closeModal, toast } = useUI();
  const can = usePermission();
  const sections = useSections();
  if (!can("users", "edit")) return null;

  const own = users.find((u) => u.role === "student" && u.studentId === student.id);
  const parents = users.filter((u) => u.role === "parent" && (u.childIds || []).includes(student.id));
  const accounts = [...(own ? [own] : []), ...parents];

  const done = (out) => {
    if (out.student) putLocal("users", out.student.user);
    if (out.parent) putLocal("users", out.parent.user);
    const slip = {
      school, student, section: sections.label(student.class),
      accounts: [
        ...(out.student ? [{ label: "Student", name: student.name, signIn: out.student.signIn, password: out.student.password }] : []),
        ...(out.parent ? [{ label: "Parent / guardian", name: out.parent.user.name, signIn: out.parent.signIn, password: out.parent.password }] : []),
      ],
    };
    openModal("Logins created", (
      <>
        <p style={{ marginTop: 0 }}>Print the slip and hand it over privately. The passwords are shown <b>only now</b>.</p>
        {slip.accounts.map((a) => (
          <dl className="kv" key={a.label} style={{ marginBottom: 14 }}>
            <dt>{a.label}</dt><dd>{a.name}</dd>
            <dt>Sign in with</dt><dd><code>{a.signIn}</code></dd>
            <dt>Password</dt><dd>{a.password ? <code>{a.password}</code> : "Their existing password"}</dd>
          </dl>
        ))}
        <div className="form-actions">
          <button className="btn light" onClick={closeModal}>Done</button>
          <button className="btn" onClick={() => printSlip(slip) || toast("Allow pop-ups for this site to print the slip")}><Icon name="printer" />Print slip</button>
        </div>
      </>
    ));
  };

  const create = () => openModal("Create sign-in accounts", (
    <LoginsForm student={student} hasOwn={!!own} onCancel={closeModal} onDone={done} />
  ));

  return (
    <div className="card">
      <div className="card-head">
        <div><h3>Sign-in accounts</h3><p>Logins for this student and their parent or guardian.</p></div>
        <button className="btn sm" onClick={create}><Icon name="userPlus" />Create logins</button>
      </div>
      {accounts.length ? (
        <dl className="kv">
          {accounts.map((u) => (
            <div key={u.id} style={{ display: "contents" }}>
              <dt>{u.role === "student" ? "Student" : "Parent"}</dt>
              <dd>
                {u.name} · <code>{u.email || u.studentId}</code>{" "}
                <Badge value={u.status} cls={{ active: "b-green", pending: "b-amber", inactive: "b-red" }[u.status]} />
                {u.mustChangePassword && <small className="hint"> · hasn't set their own password yet</small>}
              </dd>
            </div>
          ))}
        </dl>
      ) : <p className="hint" style={{ margin: 0 }}>No logins yet. Create them at enrolment and hand over the printed slip.</p>}
    </div>
  );
}
