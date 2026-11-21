import { useLocation } from "react-router-dom";
import { usePermission } from "../lib/usePermission.js";
import { downloadCsv } from "../lib/utils.js";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import DataTable from "./DataTable.jsx";
import RecordForm from "./RecordForm.jsx";
import Icon from "./Icon.jsx";
import { PageHead } from "./ui.jsx";

/**
 * Generic list page with add / edit / delete for one collection.
 * module: permission-matrix key; roles with "edit" can change records, "view" gets read-only.
 */
export default function CrudPage({
  collection, title, listTitle, singular, crumbs, fields, cols, filter, onView,
  module, defaults = {}, searchPlaceholder, describe = (r) => r.name || r.title || r.id, rowFilter, subtitle, csv,
  prepare = (vals) => vals, // last change to the form's values before saving: prepare(vals, row | null)
  rows: givenRows, remote, afterSave, // server-paged lists: the current page, { total, onQuery }, and a refresh after saving
}) {
  const data = useData();
  const can = usePermission();
  const { openModal, closeModal, confirm, toast } = useUI();
  const location = useLocation();
  const canEdit = can(module, "edit");
  // rowFilter limits what this user may see (e.g. a teacher sees only their classes).
  const all = givenRows || data[collection];
  const rows = rowFilter ? all.filter(rowFilter) : all;
  const saved = () => afterSave && data.settled().then(afterSave);

  const openForm = (row) =>
    openModal(row ? `Edit ${singular}` : `Add ${singular}`, (
      <RecordForm fields={fields} initial={row || defaults} submitLabel={row ? "Save changes" : `Add ${singular}`}
        onCancel={closeModal}
        onSubmit={(raw) => {
          const vals = prepare(raw, row);
          row ? data.update(collection, row.id, vals) : data.add(collection, { ...defaults, ...vals });
          saved();
          closeModal();
          toast(row ? `${singular} updated` : `${singular} added`);
        }} />
    ));

  const del = (row) => confirm(`Delete ${singular.toLowerCase()}?`, `"${describe(row)}" will be removed permanently.`, () => {
    data.remove(collection, row.id);
    saved();
    toast(`${singular} deleted`);
  });

  return (
    <>
      <PageHead title={title} crumbs={crumbs || [title]}>
        {canEdit && <button className="btn" onClick={() => openForm(null)}><Icon name="plus" />Add {singular}</button>}
      </PageHead>
      <DataTable
        key={location.key}
        title={listTitle || `${singular} Information`}
        rows={rows}
        remote={remote}
        cols={cols}
        filter={filter}
        searchPlaceholder={searchPlaceholder}
        tools={csv && (
          <button className="btn light sm" onClick={async () => { downloadCsv(csv.filename, csv.header, (csv.rows ? await csv.rows() : rows).map(csv.row)); toast("CSV downloaded"); }}>
            <Icon name="download" />Export CSV
          </button>
        )}
        initialQuery={location.state?.q || ""}
        actions={{ onView, ...(canEdit ? { onEdit: openForm, onDelete: del } : {}) }}
        onBulkDelete={canEdit ? (ids, done) => confirm(`Delete ${ids.length} records?`, "This cannot be undone.", () => {
          data.remove(collection, ids);
          saved();
          done();
          toast(`${ids.length} records deleted`);
        }) : undefined}
      />
    </>
  );
}
