import { useRef, useState } from "react";
import { useData, useView } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { downloadBlob, todayIso } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import { PageHead, StatTile } from "../components/ui.jsx";

const MAX_FILE = 20 * 1024 * 1024;

/** Super Admin: download all data as a file, or restore it (e.g. to move data to another browser). */
export default function Backup() {
  const data = useData();
  const { exportBackup, restoreBackup, students, users, notices } = data;
  const counts = useView({ view: "summary" }).data?.counts; // all school years, counted by the server
  const { toast, confirm } = useUI();
  const fileRef = useRef();
  const [error, setError] = useState("");

  const download = async () => {
    let file;
    try { file = await exportBackup(); } catch (e) { return toast(e.message); }
    downloadBlob(`brighterstep-backup-${todayIso()}.json`, new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }));
    toast("Backup downloaded");
  };

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    setError("");
    if (!f) return;
    if (f.size > MAX_FILE) return setError("That file is larger than 20 MB, so it can't be a BrighterStep backup.");
    let parsed;
    try { parsed = JSON.parse(await f.text()); } catch { return setError("That file isn't a valid backup (it couldn't be read as JSON)."); }
    if (parsed?.app !== "brighterstep") return setError("That file isn't a BrighterStep backup.");
    const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : "an unknown date";
    confirm("Restore this backup?", `All school data on the server will be replaced with the backup from ${when}, for everyone. Download a backup of the current data first if you might need it.`, async () => {
      const problem = await restoreBackup(parsed);
      if (problem) setError(`Nothing was changed: ${problem}`);
      else toast("Backup restored");
    }, "Restore");
  };

  return (
    <>
      <PageHead title="Backup & Restore" crumbs={["Administration", "Backup & Restore"]} />
      <div className="stat-grid">
        <StatTile label="Students" value={students.length} icon="cap" tone="purple" />
        <StatTile label="Accounts" value={users.length} icon="teachers" tone="blue" />
        <StatTile label="Grade records" value={counts ? counts.grades + counts.activities : "…"} icon="exam" tone="orange" />
        <StatTile label="Announcements" value={notices.length} icon="notice" tone="green" />
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div><h3>Download a backup</h3><p>Saves everything on the server to one file: school setup, accounts, students, timetable, attendance, grades and announcements.</p></div></div>
          <div className="alert info" style={{ marginBottom: 16 }}>
            The file includes password hashes and student details. Keep it private and don't email it around.
          </div>
          <button className="btn" onClick={download}><Icon name="download" />Download backup (.json)</button>
        </div>
        <div className="card">
          <div className="card-head"><div><h3>Restore from a backup</h3><p>Replaces all school data on the server, for every user. Use it to undo a mistake or load a test setup.</p></div></div>
          {error && <div className="alert error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
          <button className="btn light" onClick={() => fileRef.current.click()}><Icon name="upload" />Choose backup file…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pick} aria-label="Backup file" />
        </div>
      </div>
    </>
  );
}
