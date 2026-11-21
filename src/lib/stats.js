// Numbers calculated from real records (this school year's attendance and published grades),
// shared by dashboards, profiles and report cards so every page shows the same figures.
// Plain functions (no React), so they can be tested on their own.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Present + late, as a whole percentage of recorded days (null when nothing is recorded). */
const rateOf = (present, late, days) => (days ? Math.round(((present + late) / days) * 100) : null);

/** One pass over attendance → Map studentId → { present, absent, late, days, rate }. */
export function attendanceByStudent(attendance) {
  const out = new Map();
  for (const marks of Object.values(attendance)) {
    for (const [sid, v] of Object.entries(marks || {})) {
      const c = out.get(sid) || { present: 0, absent: 0, late: 0, days: 0 };
      if (v === "P") c.present++; else if (v === "A") c.absent++; else if (v === "L") c.late++; else continue;
      c.days++;
      out.set(sid, c);
    }
  }
  for (const c of out.values()) c.rate = rateOf(c.present, c.late, c.days);
  return out;
}

export const NONE = { present: 0, absent: 0, late: 0, days: 0, rate: null };

/**
 * Students' attendance rate for each month of the school year, e.g.
 * { labels: ["Aug", …, "Jun"], values: [93, 91, null, …] } (null = nothing recorded that month).
 */
export function monthlyAttendance(attendance, academicYear) {
  const totals = {};
  for (const [key, marks] of Object.entries(attendance)) {
    const month = key.split("|")[1]?.slice(0, 7);
    const t = (totals[month] ||= { present: 0, days: 0 });
    for (const v of Object.values(marks || {})) { if (v === "P" || v === "L") t.present++; t.days++; }
  }
  return monthlyFromTotals(totals, academicYear);
}

/**
 * Same chart from monthly totals already counted (e.g. by the server):
 * { "2026-09": { present, days } } → { labels, values } for every month of the school year.
 */
export function monthlyFromTotals(totals, academicYear) {
  // Plain year/month arithmetic ("2026-08" … "2027-06"), no Date objects, so time zones can't shift a month.
  const months = [];
  let [y, m] = academicYear.start.split("-").map(Number);
  const last = academicYear.end.slice(0, 7);
  for (let ym = academicYear.start.slice(0, 7); ym <= last && months.length < 24; ym = `${y}-${String(m).padStart(2, "0")}`) {
    months.push(ym);
    if (++m > 12) { m = 1; y++; }
  }
  return { labels: months.map((ym) => MONTHS[Number(ym.slice(5, 7)) - 1]), values: months.map((ym) => rateOf(totals?.[ym]?.present || 0, 0, totals?.[ym]?.days || 0)) };
}

/** "93%" or "—" when no attendance is recorded. */
export const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);
