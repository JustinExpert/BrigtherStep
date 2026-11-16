import { useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import DataTable from "./DataTable.jsx";
import RecordForm from "./RecordForm.jsx";
import Icon from "./Icon.jsx";
import { PageHead } from "./ui.jsx";

/**
 * Generic list page with add / edit / delete for one collection.
 * editRoles: which roles may change records (others get read-only).
 */
export default function CrudPage({
  collection, title, listTitle, singular, crumbs, fields, cols, filter, onView,
  editRoles = ["admin"], defaults = {}, searchPlaceholder, describe = (r) => r.name || r.title || r.id,
}) {
  const data = useData();
  const { user } = useAuth();
  const { openModal, closeModal, confirm, toast } = useUI();
  const location = useLocation();
  const canEdit = editRoles.includes(user.role);
  const rows = data[collection];

  const openForm = (row) =>
    openModal(row ? `Edit ${singular}` : `Add ${singular}`, (
      <RecordForm fields={fields} initial={row || defaults} submitLabel={row ? "Save changes" : `Add ${singular}`}
        onCancel={closeModal}
        onSubmit={(vals) => {
          row ? data.update(collection, row.id, vals) : data.add(collection, { ...defaults, ...vals });
          closeModal();
          toast(row ? `${singular} updated` : `${singular} added`);
        }} />
    ));

  const del = (row) => confirm(`Delete ${singular.toLowerCase()}?`, `"${describe(row)}" will be removed permanently.`, () => {
    data.remove(collection, row.id);
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
        cols={cols}
        filter={filter}
        searchPlaceholder={searchPlaceholder}
        initialQuery={location.state?.q || ""}
        actions={{ onView, ...(canEdit ? { onEdit: openForm, onDelete: del } : {}) }}
        onBulkDelete={canEdit ? (ids, done) => confirm(`Delete ${ids.length} records?`, "This cannot be undone.", () => {
          data.remove(collection, ids);
          done();
          toast(`${ids.length} records deleted`);
        }) : undefined}
      />
    </>
  );
}
