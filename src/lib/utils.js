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
