import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { CLASSES } from "../data.js";
import DataTable from "../components/DataTable.jsx";
import { Avatar, Badge, PageHead, StatTile } from "../components/ui.jsx";

const TERM_FEE = 2800;
const money = (n) => "$" + n.toLocaleString();

export default function Fees() {
  const { students, update } = useData();
  const { toast, confirm } = useUI();
  const canEdit = usePermission()("fees", "edit");
  const count = (s) => students.filter((x) => x.fees === s).length;
  const due = students.filter((s) => s.fees !== "Paid").length;

  return (
    <>
      <PageHead title="Fees Collection" crumbs={["Account", "Fees Collection"]}>
        {canEdit && <button className="btn" disabled={!due} onClick={() => toast(`Reminders sent to ${due} guardians`)}>Send reminders ({due})</button>}
      </PageHead>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <StatTile label="Collected" value={money(count("Paid") * TERM_FEE)} icon="money" tone="green" />
        <StatTile label="Pending" value={money(count("Pending") * TERM_FEE)} icon="calendar" tone="orange" />
        <StatTile label="Overdue" value={money(count("Overdue") * TERM_FEE)} icon="bell" tone="purple" />
      </div>
      <DataTable
        title="Student Fees · Term 2"
        rows={students}
        searchPlaceholder="Search by name or ID"
        filter={{ key: "fees", label: "All statuses", options: ["Paid", "Pending", "Overdue"] }}
        cols={[
          { key: "name", label: "Student", render: (r) => <div className="who"><Avatar name={r.name} color={r.color} /><div>{r.name}<small>{r.id}</small></div></div> },
          { key: "class", label: "Class", render: (r) => `Class ${r.class}` },
          { key: "parent", label: "Guardian" },
          { key: "amount", label: "Amount", sortable: false, render: () => money(TERM_FEE) },
          { key: "fees", label: "Status", render: (r) => <Badge value={r.fees} /> },
          { key: "pay", label: "", sortable: false, render: (r) => r.fees === "Paid"
            ? <span style={{ color: "var(--muted)", fontSize: 13 }}>Received</span>
            : !canEdit ? <span style={{ color: "var(--muted)", fontSize: 13 }}>Outstanding</span>
            : <button className="btn sm light" onClick={() => confirm("Record payment?", `Mark ${money(TERM_FEE)} from ${r.name} as paid.`, () => { update("students", r.id, { fees: "Paid" }); toast("Payment recorded"); }, "Mark paid")}>Mark paid</button> },
        ]}
      />
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Classes: {CLASSES.join(", ")} · Flat term fee of {money(TERM_FEE)} in this demo.</p>
    </>
  );
}
