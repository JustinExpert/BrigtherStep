import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";

/*
 * App-styled dropdown (replaces the browser's <select>).
 *   <Select value={v} onChange={(newValue) => …} options={[…]} aria-label="…" />
 * options: plain strings, or { value, label, group?, hint?, disabled? }.
 * Options with a `group` are listed under that heading. A search box appears for long lists.
 * Keyboard: ↑/↓, Home/End, Enter, Esc, Tab; type to search (or jump, for short lists).
 */
export const optValue = (o) => (o && typeof o === "object" ? o.value : o);
const optLabel = (o) => (o && typeof o === "object" ? o.label ?? String(o.value) : String(o));
const PHONE = 560; // at or below this width the list opens as a sheet from the bottom

/** Positions a floating panel under its trigger (or above, if there's more room), kept inside the window. */
export function useFloating(open, triggerRef, panelRef, minWidth = 0) {
  const [place, setPlace] = useState(null);
  useLayoutEffect(() => {
    if (!open) { setPlace(null); return undefined; }
    const update = () => {
      const t = triggerRef.current, p = panelRef.current;
      if (!t || !p) return;
      if (window.innerWidth <= PHONE) { setPlace({ sheet: true }); return; }
      const r = t.getBoundingClientRect();
      const width = Math.min(Math.max(r.width, minWidth), window.innerWidth - 16);
      const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
      const up = p.scrollHeight > below && above > below;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      setPlace({ style: { left, width, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }), maxHeight: Math.max(180, up ? above : below) } });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, minWidth, triggerRef, panelRef]);
  return place;
}

/** Closes when the user clicks outside both the trigger and the panel. */
export function useOutsideClose(open, refs, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!refs.some((r) => r.current?.contains(e.target))) close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The floating panel: under/over the trigger on desktop, a bottom sheet on phones. */
export function FloatingPanel({ place, panelRef, className = "", onClose, children, ...rest }) {
  const style = !place ? { visibility: "hidden", top: 0, left: 0 } : place.sheet ? undefined : place.style;
  return createPortal(
    <>
      {place?.sheet && <div className="ss-backdrop" onMouseDown={onClose} />}
      <div ref={panelRef} className={`ss-panel ${place?.sheet ? "sheet" : ""} ${className}`} style={style} {...rest}>{children}</div>
    </>,
    document.body,
  );
}

/** Keeps the browser's "please fill in this field" check working for a required custom control. */
export function RequiredMarker({ value, focusRef }) {
  return <input className="ss-native" tabIndex={-1} aria-hidden="true" required value={value ?? ""} onChange={() => {}} onFocus={() => focusRef.current?.focus()} />;
}

export default function Select({
  value, onChange, options, placeholder = "Select…", searchable, className = "", disabled = false, required = false,
  id, title, "aria-label": ariaLabel, "aria-invalid": ariaInvalid,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const triggerRef = useRef(null), panelRef = useRef(null), listRef = useRef(null), searchRef = useRef(null);
  const uid = useId().replace(/:/g, "");

  const items = useMemo(() => options.map((o) => ({ value: optValue(o), label: optLabel(o), group: o?.group, hint: o?.hint, disabled: !!o?.disabled })), [options]);
  const canSearch = searchable ?? items.length > 10;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => `${i.label} ${i.hint || ""} ${i.group || ""}`.toLowerCase().includes(q)) : items;
  }, [items, query]);
  const selected = items.find((i) => i.value === value);
  const place = useFloating(open, triggerRef, panelRef, 220);

  const firstEnabled = (list, from = 0) => { for (let i = from; i < list.length; i++) if (!list[i].disabled) return i; return -1; };
  const openList = (initialQuery = "") => {
    if (disabled) return;
    setQuery(initialQuery);
    const at = items.findIndex((x) => x.value === value);
    setActive(initialQuery ? 0 : at >= 0 ? at : Math.max(0, firstEnabled(items)));
    setOpen(true);
  };
  const close = (refocus = true) => { setOpen(false); if (refocus) triggerRef.current?.focus(); };
  const choose = (item) => {
    if (!item || item.disabled) return;
    close();
    if (item.value !== value) onChange(item.value);
  };
  useOutsideClose(open, [triggerRef, panelRef], () => close(false));

  // Focus the search box (or the list) when it opens; keep the highlighted option in view.
  useEffect(() => { if (open && place) (canSearch ? searchRef : listRef).current?.focus({ preventScroll: true }); }, [open, !!place]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, open, place]);

  const move = (step) => {
    if (!shown.length) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) { i = (i + step + shown.length) % shown.length; if (!shown[i].disabled) break; }
    setActive(i);
  };
  const onPanelKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home" && !canSearch) { e.preventDefault(); setActive(Math.max(0, firstEnabled(shown))); }
    else if (e.key === "End" && !canSearch) { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(shown[active]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  };
  const onTriggerKey = (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (canSearch) { e.preventDefault(); openList(e.key); return; }
      // Short lists behave like a native select: typing a letter jumps to the next match.
      const k = e.key.toLowerCase(), at = items.findIndex((x) => x.value === value);
      const order = [...items.slice(at + 1), ...items.slice(0, at + 1)];
      const hit = order.find((x) => !x.disabled && x.label.toLowerCase().startsWith(k));
      if (hit && hit.value !== value) onChange(hit.value);
    }
  };

  const optionId = (i) => `${uid}-o${i}`;
  let lastGroup;
  const trigger = (
    <button type="button" ref={triggerRef} id={id} className={`select ss-trigger ${open ? "open" : ""} ${className}`} disabled={disabled} title={title}
      role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${uid}-list` : undefined} aria-label={ariaLabel} aria-invalid={ariaInvalid}
      onClick={() => (open ? close() : openList())} onKeyDown={onTriggerKey}>
      <span className={`ss-value ${selected ? "" : "ss-placeholder"}`}>{selected ? selected.label : placeholder}</span>
      <Icon name="chevron" className="ss-chevron" />
    </button>
  );

  return (
    <>
      {required ? <span className="ss-wrap">{trigger}<RequiredMarker value={value} focusRef={triggerRef} /></span> : trigger}
      {open && (
        <FloatingPanel place={place} panelRef={panelRef} onClose={() => close()} onKeyDown={onPanelKey}>
          {canSearch && (
            <div className="ss-search">
              <Icon name="search" />
              <input ref={searchRef} value={query} placeholder="Search…" aria-label={`Search ${ariaLabel || "options"}`}
                aria-controls={`${uid}-list`} aria-activedescendant={shown[active] ? optionId(active) : undefined}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }} />
            </div>
          )}
          <ul ref={listRef} id={`${uid}-list`} className="ss-list" role="listbox" tabIndex={-1} aria-label={ariaLabel}
            aria-activedescendant={!canSearch && shown[active] ? optionId(active) : undefined}>
            {shown.length ? shown.map((item, i) => {
              const header = item.group && item.group !== lastGroup ? <li key={`g-${item.group}`} className="ss-group" role="presentation">{item.group}</li> : null;
              lastGroup = item.group;
              const isSel = item.value === value;
              return [header,
                <li key={`o-${i}`} id={optionId(i)} data-i={i} role="option" aria-selected={isSel} aria-disabled={item.disabled || undefined}
                  className={`ss-option ${i === active ? "active" : ""} ${isSel ? "selected" : ""} ${item.disabled ? "disabled" : ""}`}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)}>
                  <span className="ss-label">{item.label}{item.hint && <small>{item.hint}</small>}</span>
                  {isSel && <Icon name="check" className="ss-check" />}
                </li>];
            }) : <li className="ss-empty" role="presentation">No matches for “{query}”</li>}
          </ul>
        </FloatingPanel>
      )}
    </>
  );
}
