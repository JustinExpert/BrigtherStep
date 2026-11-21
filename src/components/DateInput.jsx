import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { FloatingPanel, RequiredMarker, useFloating, useOutsideClose } from "./Select.jsx";
import { todayIso } from "../lib/utils.js";

/*
 * App-styled date field with a calendar (replaces <input type="date">).
 *   <DateInput value="2026-11-21" onChange={(iso) => …} min="…" max="…" aria-label="…" />
 * Values are "YYYY-MM-DD" strings ("" when cleared). Days outside min/max can't be picked.
 * Keyboard: ←/→ day, ↑/↓ week, PageUp/PageDown month (with Shift: year), Home/End week, Enter picks, Esc closes.
 */
export const WEEK_STARTS_ON = 0; // 0 = Sunday (common on Philippine calendars), 1 = Monday
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dates are handled as plain numbers (UTC), so the viewer's time zone can never shift a day.
const toParts = (iso) => iso.split("-").map(Number);
const toIso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const valid = (iso) => typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) && (() => { const [y, m, d] = toParts(iso); const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1 && t.getUTCDate() === d; })();
const shift = (iso, days) => new Date(Date.UTC(...((p) => [p[0], p[1] - 1, p[2] + days])(toParts(iso)))).toISOString().slice(0, 10);
const addMonths = (iso, n) => {
  const [y, m, d] = toParts(iso);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return toIso(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last));
};
const weekday = (iso) => new Date(Date.UTC(...((p) => [p[0], p[1] - 1, p[2]])(toParts(iso)))).getUTCDay();
export const longDate = (iso) => (valid(iso) ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");

/** Reads a typed date: 2026-11-21, Nov 21 2026, 21 November 2026, 11/21/2026. */
function parseTyped(text) {
  const t = text.trim();
  if (valid(t)) return t;
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) { const iso = toIso(+us[3], +us[1], +us[2]); return valid(iso) ? iso : null; }
  if (!/[a-z]/i.test(t)) return null; // only month-name formats below
  const ms = Date.parse(`${t} 00:00 UTC`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export default function DateInput({ value, onChange, min, max, required = false, disabled = false, placeholder = "Select date", className = "", id, "aria-label": ariaLabel, title }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(null); // the day the keyboard is on
  const [mode, setMode] = useState("days"); // days | years
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState("");
  const triggerRef = useRef(null), panelRef = useRef(null), gridRef = useRef(null);
  const place = useFloating(open, triggerRef, panelRef, 300);

  const inRange = (iso) => (!min || iso >= min) && (!max || iso <= max);
  const clampDay = (iso) => (min && iso < min ? min : max && iso > max ? max : iso);
  const today = todayIso();

  const openCal = () => {
    if (disabled) return;
    setFocus(clampDay(valid(value) ? value : today));
    setMode("days"); setTyped(""); setTypedError("");
    setOpen(true);
  };
  const close = (refocus = true) => { setOpen(false); if (refocus) triggerRef.current?.focus(); };
  const pick = (iso) => { if (!inRange(iso)) return; close(); if (iso !== value) onChange(iso); };
  useOutsideClose(open, [triggerRef, panelRef], () => close(false));

  // Move keyboard focus onto the highlighted day.
  useEffect(() => {
    if (open && place && mode === "days") gridRef.current?.querySelector(`[data-day="${focus}"]`)?.focus({ preventScroll: true });
  }, [open, !!place, focus, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const onGridKey = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next = null;
    if (moves[e.key] !== undefined) next = shift(focus, moves[e.key]);
    else if (e.key === "PageUp") next = addMonths(focus, e.shiftKey ? -12 : -1);
    else if (e.key === "PageDown") next = addMonths(focus, e.shiftKey ? 12 : 1);
    else if (e.key === "Home") next = shift(focus, -((weekday(focus) - WEEK_STARTS_ON + 7) % 7));
    else if (e.key === "End") next = shift(focus, 6 - ((weekday(focus) - WEEK_STARTS_ON + 7) % 7));
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(focus); return; }
    if (next) { e.preventDefault(); setFocus(clampDay(next)); }
  };
  const onPanelKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (mode === "years") setMode("days"); else close(); }
  };

  // Month grid: 6 weeks starting on WEEK_STARTS_ON, including the neighbouring months' days.
  const [fy, fm] = focus ? toParts(focus) : toParts(today);
  const first = toIso(fy, fm, 1);
  const start = shift(first, -((weekday(first) - WEEK_STARTS_ON + 7) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => shift(start, i));
  const weekNames = Array.from({ length: 7 }, (_, i) => DAYS[(i + WEEK_STARTS_ON) % 7]);
  const canPrev = !min || addMonths(first, -1).slice(0, 7) >= min.slice(0, 7);
  const canNext = !max || addMonths(first, 1).slice(0, 7) <= max.slice(0, 7);
  const decade = Math.floor(fy / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => decade + i);
  const yearAllowed = (y) => (!min || y >= +min.slice(0, 4)) && (!max || y <= +max.slice(0, 4));

  const submitTyped = () => {
    const iso = parseTyped(typed);
    if (!iso) return setTypedError("Try 2026-11-21 or Nov 21, 2026");
    if (!inRange(iso)) return setTypedError(`Pick a date${min ? ` from ${longDate(min)}` : ""}${max ? ` to ${longDate(max)}` : ""}`);
    pick(iso);
  };

  const trigger = (
    <button type="button" ref={triggerRef} id={id} className={`input ds-trigger ${open ? "open" : ""} ${className}`} disabled={disabled} title={title}
      aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel ? `${ariaLabel}${valid(value) ? `: ${longDate(value)}` : ""}` : undefined}
      onClick={() => (open ? close() : openCal())} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); openCal(); } }}>
      <span className={valid(value) ? "" : "ss-placeholder"}>{valid(value) ? longDate(value) : placeholder}</span>
      <Icon name="calendar" className="ds-icon" />
    </button>
  );

  return (
    <>
      {required ? <span className="ss-wrap">{trigger}<RequiredMarker value={value} focusRef={triggerRef} /></span> : trigger}
      {open && (
        <FloatingPanel place={place} panelRef={panelRef} className="ds-panel" onClose={() => close()} onKeyDown={onPanelKey} role="dialog" aria-label={ariaLabel ? `Choose ${ariaLabel.toLowerCase()}` : "Choose a date"}>
          <div className="ds-head">
            <button type="button" className="icon-btn" aria-label={mode === "days" ? "Previous month" : "Previous years"} disabled={mode === "days" ? !canPrev : !yearAllowed(decade - 1)}
              onClick={() => setFocus(clampDay(addMonths(focus, mode === "days" ? -1 : -144)))}><Icon name="chevronLeft" /></button>
            <button type="button" className="ds-title" aria-label={mode === "days" ? `${MONTHS[fm - 1]} ${fy}, choose a year` : "Back to days"} onClick={() => setMode(mode === "days" ? "years" : "days")}>
              {mode === "days" ? `${MONTHS[fm - 1]} ${fy}` : `${decade} – ${decade + 11}`}<Icon name="chevron" />
            </button>
            <button type="button" className="icon-btn" aria-label={mode === "days" ? "Next month" : "Next years"} disabled={mode === "days" ? !canNext : !yearAllowed(decade + 12)}
              onClick={() => setFocus(clampDay(addMonths(focus, mode === "days" ? 1 : 144)))}><Icon name="chevronRight" /></button>
          </div>

          {mode === "days" ? (
            <div ref={gridRef} className="ds-grid" role="grid" aria-label={`${MONTHS[fm - 1]} ${fy}`} onKeyDown={onGridKey}>
              {weekNames.map((d) => <span key={d} className="ds-dow" role="columnheader" aria-label={d}>{d.slice(0, 2)}</span>)}
              {cells.map((iso) => {
                const [, m, d] = toParts(iso);
                const ok = inRange(iso);
                return (
                  <button type="button" key={iso} data-day={iso} role="gridcell" tabIndex={iso === focus ? 0 : -1} disabled={!ok}
                    aria-selected={iso === value} aria-current={iso === today ? "date" : undefined} aria-label={longDate(iso)}
                    className={`ds-day ${m !== fm ? "other" : ""} ${iso === value ? "selected" : ""} ${iso === today ? "today" : ""} ${iso === focus ? "focus" : ""}`}
                    onClick={() => pick(iso)}>{d}</button>
                );
              })}
            </div>
          ) : (
            <div className="ds-years" role="listbox" aria-label="Year">
              {years.map((y) => (
                <button type="button" key={y} role="option" aria-selected={y === fy} disabled={!yearAllowed(y)} className={`ds-year ${y === fy ? "selected" : ""}`}
                  onClick={() => { setFocus(clampDay(toIso(y, fm, Math.min(toParts(focus)[2], 28)))); setMode("days"); }}>{y}</button>
              ))}
            </div>
          )}

          <div className="ds-type">
            <input value={typed} placeholder="Or type a date, e.g. Nov 21, 2026" aria-label="Type a date" aria-invalid={!!typedError}
              onChange={(e) => { setTyped(e.target.value); setTypedError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitTyped(); } }} />
            {typedError && <small className="ds-error" role="alert">{typedError}</small>}
          </div>
          <div className="ds-foot">
            {!required && value ? <button type="button" className="btn light sm" onClick={() => { close(); onChange(""); }}>Clear</button> : <span />}
            <button type="button" className="btn light sm" disabled={!inRange(today)} onClick={() => pick(today)}>Today</button>
          </div>
        </FloatingPanel>
      )}
    </>
  );
}
