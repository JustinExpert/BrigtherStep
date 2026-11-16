import { useState } from "react";

/**
 * fields: [{ key, label, type?: text|email|tel|number|date|select|textarea, options?, required?, full? }]
 */
export default function RecordForm({ fields, initial = {}, submitLabel = "Save", onSubmit, onCancel }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? (f.type === "select" ? f.options[0] : "")])));
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const out = {};
    for (const f of fields) {
      const raw = v[f.key];
      out[f.key] = f.type === "number" ? Number(raw) : typeof raw === "string" ? raw.trim() : raw;
    }
    onSubmit(out);
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        {fields.map((f) => (
          <label key={f.key} style={f.full || f.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
            {f.label}{f.required && " *"}
            {f.type === "select" ? (
              <select className="select" value={v[f.key]} onChange={set(f.key)}>
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea value={v[f.key]} onChange={set(f.key)} required={f.required} maxLength={1000} />
            ) : (
              <input className="input" type={f.type || "text"} value={v[f.key]} onChange={set(f.key)}
                required={f.required} min={f.min} max={f.max} maxLength={f.type ? undefined : 120} />
            )}
          </label>
        ))}
      </div>
      <div className="form-actions">
        {onCancel && <button type="button" className="btn light" onClick={onCancel}>Cancel</button>}
        <button className="btn">{submitLabel}</button>
      </div>
    </form>
  );
}
