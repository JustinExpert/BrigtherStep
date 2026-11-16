import { useState } from "react";
import { Link } from "react-router-dom";
import { BADGE, initials } from "../lib/utils.js";
import Icon from "./Icon.jsx";

export const Avatar = ({ name, color = "#7b2cdf", size }) => (
  <span className={`avatar ${size || ""}`} style={{ background: color }}>{initials(name)}</span>
);

export const Badge = ({ value, cls }) => <span className={`badge ${cls || BADGE[value] || "b-purple"}`}>{value}</span>;

export const PageHead = ({ title, crumbs = [], children }) => (
  <div className="page-head">
    <div>
      <h1>{title}</h1>
      {crumbs.length > 0 && (
        <div className="crumbs">
          <Link to="/">Home</Link>
          {crumbs.map((c) => (
            <span key={c.label || c} style={{ display: "contents" }}>
              <span>/</span>
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label || c}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
    {children}
  </div>
);

export const StatTile = ({ label, value, icon, tone }) => (
  <div className={`stat-tile tone-${tone}`}>
    <div><span>{label}</span><b>{value}</b></div>
    <Icon name={icon} />
  </div>
);

export const FEED_TONES = {
  teacher: ["tone-blue", "teacher"], fees: ["tone-orange", "money"], course: ["tone-green", "course"],
  event: ["tone-purple", "event"], exam: ["tone-purple", "exam"],
};

/** Grouped bars: series = [{ key, label, color, values: [] }] */
export function GroupedBarChart({ labels, series, max = 100, unit = "%" }) {
  const [tip, setTip] = useState(null);
  const W = 640, H = 280, L = 40, R = 10, T = 14, B = 30;
  const n = labels.length, gw = (W - L - R) / n;
  const bw = 7, gap = 6;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => Math.round(max * t));

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseLeave={() => setTip(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e7e5ef" strokeDasharray="3 4" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">{t}{unit}</text>
          </g>
        ))}
        {labels.map((lb, i) => {
          const cx = L + i * gw + gw / 2;
          const total = series.length * bw + (series.length - 1) * gap;
          return (
            <g key={lb} onMouseMove={(e) => setTip({ i, x: e.clientX, y: e.clientY })}>
              <rect x={L + i * gw} y={T} width={gw} height={H - T - B} fill={tip?.i === i ? "#f6f1fd" : "transparent"} />
              {series.map((s, k) => {
                const v = s.values[i];
                return <rect key={s.key} x={cx - total / 2 + k * (bw + gap)} y={y(v)} width={bw} height={Math.max(H - B - y(v), 0)} rx={bw / 2} fill={s.color} />;
              })}
              <text x={cx} y={H - 8} textAnchor="middle">{lb}</text>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: tip.x + 14, top: tip.y - 50 }}>
          <b>{labels[tip.i]}</b>
          {series.map((s) => <div key={s.key}>{s.label}: {s.values[tip.i] ? s.values[tip.i] + unit : "No school"}</div>)}
        </div>
      )}
    </>
  );
}

/** Two concentric progress rings. */
export function Gauge({ total, outer, inner }) {
  const ring = (r, frac, color, width, id) => {
    const C = 2 * Math.PI * r;
    return (
      <>
        <circle cx="130" cy="130" r={r} fill="none" stroke={color} strokeOpacity=".12" strokeWidth={width} />
        <circle cx="130" cy="130" r={r} fill="none" stroke={`url(#${id})`} strokeWidth={width} strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 130 130)" />
      </>
    );
  };
  return (
    <div className="gauge">
      <svg viewBox="0 0 260 260" width="100%">
        <defs>
          <linearGradient id="gP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9a5cf0" /><stop offset="1" stopColor="#5327ae" /></linearGradient>
          <linearGradient id="gO" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb057" /><stop offset="1" stopColor="#ff7a3d" /></linearGradient>
        </defs>
        {ring(108, outer, "#7b2cdf", 22, "gP")}
        {ring(78, inner, "#ff7a3d", 16, "gO")}
      </svg>
      <div className="gauge-center"><span>Total</span><b>{total.toLocaleString()}</b></div>
    </div>
  );
}
