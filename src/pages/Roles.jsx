import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { isLocked, LEVEL_LABEL, LEVELS, levelOf, MODULES, ROLES } from "../lib/permissions.js";
import { Badge, PageHead } from "../components/ui.jsx";
import Select from "../components/Select.jsx";

const LEVEL_CLS = { none: "b-red", view: "b-blue", edit: "b-green" };

export default function Roles() {
  const { users, permissions, setPermission, resetPermissions } = useData();
  const { confirm, toast } = useUI();
  const can = usePermission();
  const canEdit = can("roles", "edit");
  const groups = [...new Set(MODULES.map((m) => m.group))];

  return (
    <>
      <PageHead title="Roles & Permissions" crumbs={["Administration", "Roles & Permissions"]}>
        {canEdit
          ? <button className="btn light" onClick={() => confirm("Reset permissions?", "All roles go back to the default access levels.", () => { resetPermissions(); toast("Permissions reset"); }, "Reset")}>Reset to defaults</button>
          : <span className="badge b-blue">View only</span>}
      </PageHead>

      <div className="role-grid">
        {ROLES.map((r) => (
          <div className="card role-card" key={r.key} style={{ borderTopColor: r.color }}>
            <h3>{r.label}</h3>
            <p>{r.desc}</p>
            <small>{users.filter((u) => u.role === r.key && u.status === "active").length} active accounts</small>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <div><h3>Access by module</h3><p><b>Full</b> = view, add, edit and delete · <b>View</b> = read only · <b>No access</b> = hidden from the menu. Changes apply immediately.</p></div>
        </div>
        <div className="table-wrap">
          <table className="perm-table">
            <thead>
              <tr><th className="no-sort">Module</th>{ROLES.map((r) => <th key={r.key} className="no-sort">{r.label}</th>)}</tr>
            </thead>
            <tbody>
              {groups.map((g) => [
                <tr key={g} className="group-row"><td colSpan={ROLES.length + 1}>{g}</td></tr>,
                ...MODULES.filter((m) => m.group === g).map((m) => (
                  <tr key={m.key}>
                    <td><b>{m.label}</b></td>
                    {ROLES.map((r) => {
                      const level = levelOf(permissions, m.key, r.key);
                      const locked = isLocked(m.key, r.key);
                      return (
                        <td key={r.key}>
                          {canEdit && !locked ? (
                            <Select className={`level ${level}`} value={level} aria-label={`${m.label} access for ${r.label}`}
                              onChange={(v) => { setPermission(m.key, r.key, v); toast(`${r.label}: ${m.label} → ${LEVEL_LABEL[v]}`); }}
                              options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] }))} />
                          ) : (
                            <span title={locked ? "Fixed so nobody can lock out the Super Admin or self-grant user management" : undefined}>
                              <Badge value={LEVEL_LABEL[level]} cls={LEVEL_CLS[level]} />{locked && " 🔒"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Students and parents only ever see their own (or their children's) records, whatever the level above. These rules control the app's screens; a production backend must enforce them on the server too.
      </p>
    </>
  );
}
