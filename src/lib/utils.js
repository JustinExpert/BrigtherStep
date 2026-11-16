export const initials = (n = "") => n.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const relTime = (iso) => {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso + "T00:00:00")) / 864e5);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso + "T00:00:00").toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
};

export const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 1 : 2).replace(/\.?0+$/, "") + "K" : String(n));

export const BADGE = {
  Paid: "b-green", Active: "b-green", Present: "b-green", Theory: "b-blue", Practical: "b-purple",
  Pending: "b-amber", Overdue: "b-red", Male: "b-blue", Female: "b-purple",
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Downloads rows as a CSV file (opens in Excel / Google Sheets). Cells are quoted; formulas are neutralised. */
export function downloadCsv(filename, header, rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Stop spreadsheet formula injection (=, @, or +/- not followed by a number), but keep phone numbers like "+123 …".
    if (/^[=@\t\r]/.test(s) || /^[+-][^\d\s.]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

/** Saves a Blob as a file. */
export function downloadBlob(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** "Class 02" → "class-02", for file names. */
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
