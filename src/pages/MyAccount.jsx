import { useRef, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { passwordProblems } from "../lib/crypto.js";
import { ROLE_COLOR, ROLE_LABEL } from "../lib/permissions.js";
import Icon from "../components/Icon.jsx";
import { Avatar, Badge, PageHead } from "../components/ui.jsx";
import { PasswordInput } from "./Login.jsx";

const MAX_UPLOAD = 5 * 1024 * 1024;

/** Center-crops and shrinks an image file to a small square JPEG data URL. */
export function resizePhoto(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return reject(new Error("Please choose a PNG, JPG, WEBP or GIF image."));
    if (file.size > MAX_UPLOAD) return reject(new Error("Image is larger than 5 MB."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file couldn't be read as an image.")); };
    img.src = url;
  });
}

export function PhotoPicker({ name, photo, color, onChange }) {
  const fileRef = useRef();
  const { toast } = useUI();
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { onChange(await resizePhoto(file)); } catch (err) { toast(err.message); }
  };
  return (
    <div className="photo-picker">
      <Avatar name={name || "?"} photo={photo} color={color} size="lg" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn sm light" onClick={() => fileRef.current.click()}><Icon name="camera" />{photo ? "Change photo" : "Upload photo"}</button>
        {photo && <button type="button" className="btn sm light" onClick={() => onChange(null)}>Remove</button>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} />
      </div>
    </div>
  );
}

export default function MyAccount() {
  const { user, updateProfile, changePassword } = useAuth();
  const { toast } = useUI();
  const [p, setP] = useState({ name: user.name, phone: user.phone || "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [busy, setBusy] = useState(false);
  const problems = pw.next ? passwordProblems(pw.next) : [];

  const saveProfile = (e) => {
    e.preventDefault();
    if (!p.name.trim()) return toast("Name can't be empty");
    updateProfile({ name: p.name.trim(), phone: p.phone.trim() });
    toast("Profile saved");
  };
  const savePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (pw.next !== pw.confirm) return setPwError("New passwords don't match.");
    setBusy(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      toast("Password changed");
    } catch (err) { setPwError(err.message); }
    setBusy(false);
  };

  return (
    <>
      <PageHead title="Account Settings" crumbs={["Account Settings"]} />
      <div className="grid-profile">
        <div className="card profile-card">
          <PhotoPicker name={user.name} photo={user.photo} color={ROLE_COLOR[user.role]}
            onChange={(photo) => { updateProfile({ photo }); toast(photo ? "Photo updated" : "Photo removed"); }} />
          <h2>{user.name}</h2>
          <span style={{ color: "var(--muted)" }}>{user.email || `Signs in with ${user.studentId}`}</span>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Badge value={ROLE_LABEL[user.role]} />
            {user.idNumber && <Badge value={`ID ${user.idNumber}`} cls="b-blue" />}
          </div>
        </div>

        <div style={{ display: "grid", gap: 24 }}>
          <div className="card">
            <div className="card-head"><h3>Profile</h3></div>
            <form className="form" onSubmit={saveProfile}>
              <div className="form-grid">
                <label>Full name *<input className="input" required maxLength={80} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
                <label>Phone<input className="input" type="tel" maxLength={30} value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></label>
                <label>Email<input className="input" value={user.email || "None (sign in with your student ID)"} disabled /></label>
                <label>ID number<input className="input" value={user.idNumber || "—"} disabled /></label>
              </div>
              <p className="hint">Email, role and ID number are managed by the school admin.</p>
              <div className="form-actions"><button className="btn">Save profile</button></div>
            </form>
          </div>

          <div className="card">
            <div className="card-head"><h3>Change password</h3></div>
            <form className="form" onSubmit={savePassword}>
              {pwError && <div className="alert error" role="alert">{pwError}</div>}
              <label>Current password<PasswordInput value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} label="Current password" /></label>
              <div className="form-grid">
                <label>New password<PasswordInput value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} autoComplete="new-password" label="New password" /></label>
                <label>Confirm new password<PasswordInput value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} autoComplete="new-password" label="Confirm new password" /></label>
              </div>
              {pw.next && <small style={{ color: problems.length ? "var(--red)" : "var(--green)" }}>{problems.length ? `Needs ${problems.join(", ")}` : "✓ Strong enough"}</small>}
              <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Saving…" : "Change password"}</button></div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
