import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import Select from "./Select.jsx";

function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const set = new Set([0, total - 1, cur - 1, cur, cur + 1].filter((p) => p >= 0 && p < total));
  const out = [];
  [...set].sort((a, b) => a - b).forEach((p, i, arr) => {
    if (i && p - arr[i - 1] > 1) out.push("gap" + p);
    out.push(p);
  });
  return out;
}

/**
 * cols:    [{ key, label, render?(row), sortable? = true }]
 * filter:  { key, label, options } — one dropdown filter
 * actions: { onView?, onEdit?, onDelete? } — per-row icons
 * remote:  { total, onQuery({ q, filter, sort, dir, page, per }) } — the server pages, searches and sorts;
 *          `rows` is then just the current page. Typing in the search box waits 300 ms before asking.
 */
export default function DataTable({
  title, rows, cols, filter, actions = {}, onBulkDelete, selectable = !!onBulkDelete,
  searchPlaceholder = "Search…", initialQuery = "", tools, searchKeys, remote,
}) {
  const [q, setQ] = useState(initialQuery);
  const [fv, setFv] = useState("");
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(10);
  const [sel, setSel] = useState(new Set());

  // Remote: tell the server what to show (search debounced so it isn't asked on every keystroke).
  const [sentQ, setSentQ] = useState(initialQuery);
  useEffect(() => { if (!remote) return undefined; const t = setTimeout(() => setSentQ(q.trim()), 300); return () => clearTimeout(t); }, [q, remote]);
  const onQuery = remote?.onQuery;
  useEffect(() => { onQuery?.({ q: sentQ, filter: fv, sort: sort.key, dir: sort.dir, page, per }); }, [onQuery, sentQ, fv, sort, page, per]);

  const visible = useMemo(() => {
    if (remote) return rows;
    const s = q.trim().toLowerCase();
    // Search only visible columns (plus explicit searchKeys), never hidden fields.
    const keys = [...cols.map((c) => c.key), ...(searchKeys || [])];
    let out = s ? rows.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase().includes(s))) : rows;
    if (filter && fv) out = out.filter((r) => String(r[filter.key]) === fv);
    if (sort.key) out = [...out].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
    return out;
  }, [rows, cols, q, filter, fv, sort, searchKeys, remote]);

  const pages = Math.max(1, Math.ceil((remote ? remote.total : visible.length) / per));
  const p = Math.min(page, pages - 1);
  const slice = remote ? rows : visible.slice(p * per, p * per + per);
  const hasActions = actions.onView || actions.onEdit || actions.onDelete;
  const allOnPage = slice.length > 0 && slice.every((r) => sel.has(r.id));
  const selCount = [...sel].filter((id) => rows.some((r) => r.id === id)).length;

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => { const n = new Set(s); slice.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; });

  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
        <div className="table-tools">
          <div className="field">
            <input className="input" placeholder={searchPlaceholder} value={q} aria-label="Search table"
              onChange={(e) => { setQ(e.target.value); setPage(0); }} />
            <Icon name="search" />
          </div>
          {filter && (
            <Select value={fv} aria-label={filter.label} onChange={(v) => { setFv(v); setPage(0); }}
              options={[{ value: "", label: filter.label }, ...filter.options]} />
          )}
          {tools}
        </div>
      </div>

      {selCount > 0 && onBulkDelete && (
        <div className="bulk-bar">
          {selCount} selected
          <button className="btn sm danger" style={{ marginLeft: "auto" }} onClick={() => onBulkDelete([...sel], () => setSel(new Set()))}>
            <Icon name="trash" />Delete selected
          </button>
          <button className="btn sm light" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {selectable && <th className="no-sort" style={{ width: 40 }}><input type="checkbox" className="check" checked={allOnPage} onChange={toggleAll} aria-label="Select all on page" /></th>}
              {cols.map((c) => (
                <th key={c.key} className={c.sortable === false ? "no-sort" : ""}
                  onClick={() => c.sortable !== false && setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))}>
                  {c.label}{sort.key === c.key ? (sort.dir > 0 ? " ↑" : " ↓") : ""}
                </th>
              ))}
              {hasActions && <th className="no-sort">Action</th>}
            </tr>
          </thead>
          <tbody>
            {slice.length ? slice.map((r) => (
              <tr key={r.id} className={sel.has(r.id) ? "selected" : ""}>
                {selectable && <td><input type="checkbox" className="check" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name || r.id}`} /></td>}
                {cols.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}
                {hasActions && (
                  <td>
                    <div className="row-actions">
                      {actions.onView && <button className="icon-btn" title="View" onClick={() => actions.onView(r)}><Icon name="eye" /></button>}
                      {actions.onDelete && <button className="icon-btn danger" title="Delete" onClick={() => actions.onDelete(r)}><Icon name="trash" /></button>}
                      {actions.onEdit && <button className="icon-btn" title="Edit" onClick={() => actions.onEdit(r)}><Icon name="edit" /></button>}
                    </div>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td colSpan={cols.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0)} className="empty">No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Previous page"><Icon name="chevL" width="18" /></button>
        {pageList(p, pages).map((x) => typeof x === "string"
          ? <span key={x} className="gap">•••</span>
          : <button key={x} className={x === p ? "on" : ""} onClick={() => setPage(x)}>{x + 1}</button>)}
        <button disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Next page"><Icon name="chevR" width="18" /></button>
        <Select value={per} aria-label="Rows per page" onChange={(v) => { setPer(v); setPage(0); }}
          options={[5, 10, 20, 50].map((n) => ({ value: n, label: n + " / page" }))} />
        {remote && <small className="muted" style={{ marginLeft: 8 }}>{remote.total} total</small>}
      </div>
    </div>
  );
}
