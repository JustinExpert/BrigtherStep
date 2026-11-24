import { useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { EMAIL_RE, passwordProblems, randomToken } from "../lib/crypto.js";
import { ROLES, ROLE_COLOR, ROLE_LABEL } from "../lib/permissions.js";
import { relTime } from "../lib/utils.js";
import DataTable from "../components/DataTable.jsx";
import Icon from "../components/Icon.jsx";
import { Avatar, Badge, PageHead, StatTile } from "../components/ui.jsx";
import { PhotoPicker } from "./MyAccount.jsx";
import Select from "../components/Select.jsx";
import { useSections } from "../lib/sections.js";

const STATUS_CLS = { active: "b-green", pending: "b-amber", inactive: "b-red" };
/** What the person types to sign in: their email, or a student's ID when the account has no email. */
export const signInName = (u) => u.email || u.studentId || "—";
const tempPassword = () => "Bs-" + randomToken().replace(/[-_]/g, "").slice(0, 6) + Math.floor(Math.random() * 90 + 10);

/** Which roles the current user may assign/manage. */
const manageableRoles = (actorRole) => (actorRole === "superadmin" ? ROLES.map((r) => r.key) : ["teacher", "student", "parent"]);

function UserForm({ initial, actorRole, onSave, onCancel }) {
  const { students, teachers, users } = useData();
  const sections = useSections();
  const roles = manageableRoles(actorRole);
  const isNew = !initial;
  const [f, setF] = useState(() => ({
    name: "", email: "", role: roles.includes("teacher") ? "teacher" : roles[0], phone: "", idNumber: "", photo: null,
    studentId: "", teacherId: "", childIds: [], password: tempPassword(),
    ...initial, ...(initial && { email: initial.email || "", childIds: initial.childIds || [], studentId: initial.studentId || "", teacherId: initial.teacherId || "" }),
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const studentName = (id) => students.find((s) => s.id === id)?.name || id;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const email = f.email.trim().toLowerCase();
    if (!f.name.trim()) return setError("Enter a full name.");
    const noEmailOk = f.role === "student" && f.studentId; // signs in with the student ID
    if (!email && !noEmailOk) return setError(f.role === "student" ? "Enter an email, or link the student record so they can sign in with its ID." : "Enter a valid email address.");
    if (email && !EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    if (email && users.some((u) => u.email?.toLowerCase() === email && u.id !== initial?.id)) return setError("Another account already uses this email.");
    if (isNew) {
      const problems = passwordProblems(f.password);
      if (problems.length) return setError(`Temporary password needs ${problems.join(", ")}.`);
    }
    const links = {
      studentId: f.role === "student" ? f.studentId || null : null,
      teacherId: f.role === "teacher" ? f.teacherId || null : null,
      childIds: f.role === "parent" ? f.childIds : [],
    };
    setBusy(true);
    try {
      await onSave({ name: f.name.trim(), email, role: f.role, phone: f.phone.trim(), idNumber: f.idNumber.trim(), photo: f.photo, password: f.password, links });
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="alert error" role="alert">{error}</div>}
      <PhotoPicker name={f.name} photo={f.photo} color={ROLE_COLOR[f.role]} onChange={(photo) => setF({ ...f, photo })} />
      <div className="form-grid">
        <label>Full name *<input className="input" required maxLength={80} value={f.name} onChange={set("name")} /></label>
        <label>{f.role === "student" ? "Email (optional)" : "Email *"}
          <input className="input" type="email" required={f.role !== "student"} value={f.email} onChange={set("email")} placeholder={f.role === "student" ? "None: signs in with student ID" : "name@school.edu"} />
        </label>
        <label>Role<Select value={f.role} onChange={(v) => setF({ ...f, role: v })} aria-label="Role" options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /></label>
        <label>ID number<input className="input" maxLength={20} value={f.idNumber} onChange={set("idNumber")} placeholder="e.g. TCH-203, STU-43105" /></label>
        <label>Phone<input className="input" type="tel" maxLength={30} value={f.phone} onChange={set("phone")} /></label>

        {f.role === "student" && (
          <label>Linked student record
            <Select value={f.studentId} onChange={(v) => setF({ ...f, studentId: v, idNumber: f.idNumber || v })} aria-label="Linked student record" searchable
              options={[{ value: "", label: "— Not linked —" }, ...students.map((s) => ({ value: s.id, label: s.name, hint: `${s.id} · ${sections.label(s.class)}` }))]} />
          </label>
        )}
        {f.role === "teacher" && (
          <label>Linked staff record
            <Select value={f.teacherId} onChange={(v) => setF({ ...f, teacherId: v, idNumber: f.idNumber || v })} aria-label="Linked staff record" searchable
              options={[{ value: "", label: "— Not linked —" }, ...teachers.map((t) => ({ value: t.id, label: t.name, hint: `${t.id} · ${t.subject}` }))]} />
          </label>
        )}
        {f.role === "parent" && (
          <label style={{ gridColumn: "1 / -1" }}>Children
            <Select value="" placeholder="+ Add a child…" aria-label="Add a child" searchable
              onChange={(v) => v && !f.childIds.includes(v) && setF({ ...f, childIds: [...f.childIds, v] })}
              options={students.filter((s) => !f.childIds.includes(s.id)).map((s) => ({ value: s.id, label: s.name, hint: `${s.id} · ${sections.label(s.class)}` }))} />
            <div className="chips">
              {f.childIds.length ? f.childIds.map((id) => (
                <span className="chip" key={id}>{studentName(id)}
                  <button type="button" aria-label={`Remove ${studentName(id)}`} onClick={() => setF({ ...f, childIds: f.childIds.filter((x) => x !== id) })}>×</button>
                </span>
              )) : <small className="hint">No children linked yet.</small>}
            </div>
          </label>
        )}
        {isNew && (
          <label style={{ gridColumn: "1 / -1" }}>Temporary password *
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" required value={f.password} onChange={set("password")} style={{ flex: 1 }} />
              <button type="button" className="btn light sm" onClick={() => setF({ ...f, password: tempPassword() })}>Generate</button>
            </div>
            <small className="hint">Give it to the person privately. They must choose their own password the first time they sign in.</small>
          </label>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="btn light" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={busy}>{busy ? "Saving…" : isNew ? "Create account" : "Save changes"}</button>
      </div>
    </form>
  );
}

export default function Users() {
  const { user: me, createUser, adminResetLink, adminTempPassword } = useAuth();
  const { users, students, teachers, update, remove } = useData();
  const { openModal, closeModal, confirm, toast } = useUI();
  const can = usePermission();
  const canEdit = can("users", "edit");
  const roles = manageableRoles(me.role);
  const mayManage = (u) => canEdit && u.id !== me.id && roles.includes(u.role);

  const pending = users.filter((u) => u.status === "pending");
  const count = (s) => users.filter((u) => u.status === s).length;
  const linkText = (u) => {
    if (u.role === "student" && u.studentId) return `Student ${u.studentId}`;
    if (u.role === "teacher" && u.teacherId) return teachers.find((t) => t.id === u.teacherId)?.subject || u.teacherId;
    if (u.role === "parent" && u.childIds?.length) return u.childIds.map((id) => students.find((s) => s.id === id)?.name || id).join(", ");
    return "—";
  };

  const add = () => openModal("Add User", (
    <UserForm actorRole={me.role} onCancel={closeModal} onSave={async ({ password, links, ...data }) => {
      await createUser({ ...data, password, links });
      openModal("Account created", (
        <>
          <p style={{ marginTop: 0 }}>Share these sign-in details with <b>{data.name}</b> privately:</p>
          <dl className="kv"><dt>Sign in with</dt><dd>{data.email || links.studentId}</dd><dt>Temporary password</dt><dd><code>{password}</code></dd></dl>
          <div className="form-actions"><button className="btn" onClick={closeModal}>Done</button></div>
        </>
      ));
    }} />
  ));

  const edit = (u) => openModal("Edit User", (
    <UserForm initial={u} actorRole={me.role} onCancel={closeModal} onSave={async ({ password, links, ...data }) => {
      update("users", u.id, { ...data, ...links });
      closeModal();
      toast("User updated");
    }} />
  ));

  const setStatus = (u, status) => {
    const verb = { active: u.status === "pending" ? "approved" : "activated", inactive: "deactivated" }[status];
    const apply = () => { update("users", u.id, { status }); toast(`${u.name} ${verb}`); };
    if (status === "inactive") confirm("Deactivate account?", `${u.name} won't be able to sign in until the account is activated again. Their records are kept.`, apply, "Deactivate");
    else apply();
  };

  const sendReset = async (u) => {
    let token;
    try { token = await adminResetLink(u.id); } catch (e) { return toast(e.message); }
    if (!token) return toast("Only active accounts can reset their password");
    openModal("Password reset link sent", (
      <>
        <p style={{ marginTop: 0 }}>Reset link for <b>{signInName(u)}</b>. It expires in 30 minutes.</p>
        <div className="demo-mail"><b>📬 Demo mailbox</b><p>There's no email server in this demo. The link the user would receive:</p>
          <code style={{ wordBreak: "break-all", fontSize: 12 }}>{location.origin}/reset-password/{token}</code></div>
        <div className="form-actions"><button className="btn" onClick={closeModal}>Done</button></div>
      </>
    ));
  };

  const setTemp = (u) => {
    const password = tempPassword();
    confirm("Give a new temporary password?",
      `${u.name}'s current password stops working and they are signed out. They must choose a new password when they next sign in.`,
      async () => {
        try { await adminTempPassword(u.id, password); } catch (e) { return toast(e.message); }
        openModal("New temporary password", (
          <>
            <p style={{ marginTop: 0 }}>Give these sign-in details to <b>{u.name}</b> privately:</p>
            <dl className="kv"><dt>Sign in with</dt><dd>{signInName(u)}</dd><dt>Temporary password</dt><dd><code>{password}</code></dd></dl>
            <div className="form-actions"><button className="btn" onClick={closeModal}>Done</button></div>
          </>
        ));
      }, "Set password");
  };

  const del = (u) => confirm("Delete account?", `${u.name}'s login will be removed permanently. School records (e.g. the student file) are not deleted.`, () => {
    remove("users", u.id);
    toast("Account deleted");
  });

  return (
    <>
      <PageHead title="User Management" crumbs={["Administration", "User Management"]}>
        {canEdit && <button className="btn" onClick={add}><Icon name="userPlus" />Add User</button>}
      </PageHead>

      <div className="stat-grid">
        <StatTile label="All accounts" value={users.length} icon="teachers" tone="purple" />
        <StatTile label="Active" value={count("active")} icon="check" tone="green" />
        <StatTile label="Waiting approval" value={count("pending")} icon="bell" tone="orange" />
        <StatTile label="Deactivated" value={count("inactive")} icon="lock" tone="blue" />
      </div>

      {canEdit && pending.length > 0 && (
        <div className="card">
          <div className="card-head"><div><h3>Waiting for approval</h3><p>New self-registrations. Check the details before approving.</p></div></div>
          <div className="feed">
            {pending.map((u) => (
              <div className="feed-item" key={u.id}>
                <Avatar name={u.name} photo={u.photo} color={ROLE_COLOR[u.role]} />
                <div style={{ minWidth: 0 }}>
                  <h5>{u.name} <Badge value={ROLE_LABEL[u.role]} cls="b-purple" /></h5>
                  <p>{signInName(u)}{u.idNumber && ` · claims ID ${u.idNumber}`}{linkText(u) !== "—" && ` · ${linkText(u)}`}</p>
                </div>
                <div className="row-actions" style={{ marginLeft: "auto" }}>
                  {mayManage(u) ? (
                    <>
                      <button className="btn sm" onClick={() => setStatus(u, "active")}>Approve</button>
                      <button className="btn sm light" onClick={() => edit(u)}>Review</button>
                      <button className="btn sm light" onClick={() => confirm("Reject registration?", `${u.name}'s registration will be deleted.`, () => { remove("users", u.id); toast("Registration rejected"); }, "Reject")}>Reject</button>
                    </>
                  ) : <small className="hint">Super Admin only</small>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable
        title="All Accounts"
        rows={users.map((u) => ({ ...u, roleLabel: ROLE_LABEL[u.role], link: linkText(u) }))}
        searchKeys={["email"]}
        searchPlaceholder="Search name, email or ID"
        filter={{ key: "roleLabel", label: "All roles", options: ROLES.map((r) => r.label) }}
        cols={[
          { key: "name", label: "User", render: (r) => <div className="who"><Avatar name={r.name} photo={r.photo} color={ROLE_COLOR[r.role]} /><div>{r.name}{r.id === me.id && " (you)"}<small>{signInName(r)}</small></div></div> },
          { key: "roleLabel", label: "Role", render: (r) => <Badge value={r.roleLabel} cls="b-purple" /> },
          { key: "idNumber", label: "ID No.", render: (r) => r.idNumber || "—" },
          { key: "link", label: "Linked to" },
          { key: "status", label: "Status", render: (r) => (
            <>
              <Badge value={r.status} cls={STATUS_CLS[r.status]} />
              {r.mustChangePassword && r.status === "active" && <small className="hint" style={{ display: "block" }}>Temporary password</small>}
            </>
          ) },
          { key: "lastLogin", label: "Last login", render: (r) => (r.lastLogin ? relTime(r.lastLogin.slice(0, 10)) : "Never") },
          { key: "act", label: "Action", sortable: false, render: (r) => mayManage(r) ? (
            <div className="row-actions">
              <button className="icon-btn" title="Edit" onClick={() => edit(r)}><Icon name="edit" /></button>
              <button className="icon-btn" title="Send password reset link" onClick={() => sendReset(r)}><Icon name="mail" /></button>
              {r.status === "active" && <button className="icon-btn" title="Give a new temporary password" onClick={() => setTemp(r)}><Icon name="lock" /></button>}
              <button className="icon-btn danger" title="Delete account" onClick={() => del(r)}><Icon name="trash" /></button>
              {r.status === "active"
                ? <button className="btn sm light" onClick={() => setStatus(r, "inactive")}>Deactivate</button>
                : <button className="btn sm" onClick={() => setStatus(r, "active")}>{r.status === "pending" ? "Approve" : "Activate"}</button>}
            </div>
          ) : <small className="hint">{r.id === me.id ? "Use Account settings" : canEdit ? "Super Admin only" : "View only"}</small> },
        ]}
      />
    </>
  );
}
