import { useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { ADMINS } from "../lib/permissions.js";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { useScope, useVisibleNotices, WHOLE_SCHOOL } from "../lib/scope.js";
import { relTime, todayIso } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import RecordForm from "../components/RecordForm.jsx";
import { Badge, FEED_TONES, PageHead } from "../components/ui.jsx";

const TYPES = ["general", "event", "exam", "course", "teacher"];
const ALL = "All";

export default function Notice() {
  const { user } = useAuth();
  const { add, remove } = useData();
  const notices = useVisibleNotices();
  const scope = useScope();
  const can = usePermission();
  const { openModal, closeModal, confirm, toast } = useUI();
  const [filter, setFilter] = useState(ALL);
  // Teachers can post to the whole school or to the classes they teach; admins to any class.
  const audiences = [WHOLE_SCHOOL, ...scope.classes.map((c) => `Class ${c}`)];
  const filters = [ALL, ...new Set([WHOLE_SCHOOL, ...notices.map((n) => n.audience || WHOLE_SCHOOL)])];
  const shown = filter === ALL ? notices : notices.filter((n) => (n.audience || WHOLE_SCHOOL) === filter);

  const create = () => openModal("Post Announcement", (
    <RecordForm
      fields={[
        { key: "title", label: "Title", required: true, full: true },
        { key: "audience", label: "Send to", type: "select", options: audiences },
        { key: "type", label: "Category", type: "select", options: TYPES },
        { key: "body", label: "Message", type: "textarea", required: true },
      ]}
      submitLabel="Post announcement" onCancel={closeModal}
      onSubmit={(v) => {
        add("notices", { ...v, date: todayIso(), author: user.name });
        closeModal();
        toast(v.audience === WHOLE_SCHOOL ? "Announcement posted to the whole school" : `Announcement posted to ${v.audience}`);
      }}
    />
  ));

  return (
    <>
      <PageHead title="Announcements" crumbs={["Announcements"]}>
        {can("notices", "edit") && <button className="btn" onClick={create}><Icon name="plus" />Post Announcement</button>}
      </PageHead>
      {filters.length > 2 && (
        <div className="tabs" role="tablist" aria-label="Filter announcements" style={{ alignSelf: "flex-start" }}>
          {filters.map((f) => <button key={f} role="tab" aria-selected={f === filter} className={f === filter ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
      )}
      <div className="notice-grid">
        {shown.map((n) => {
          const [tone, icon] = FEED_TONES[n.type] || FEED_TONES.event;
          const canDelete = can("notices", "edit") && (ADMINS.includes(user.role) || n.author === user.name);
          const aud = n.audience || WHOLE_SCHOOL;
          return (
            <article className="card notice-card" key={n.id}>
              <div className="who">
                <span className={`feed-icon ${tone}`}><Icon name={icon} /></span>
                <div><h3 style={{ fontSize: 16 }}>{n.title}</h3><small style={{ textTransform: "capitalize" }}>{n.type}</small></div>
                {canDelete && (
                  <button className="icon-btn danger" style={{ marginLeft: "auto" }} aria-label="Delete announcement"
                    onClick={() => confirm("Delete announcement?", `"${n.title}" will be removed.`, () => { remove("notices", n.id); toast("Announcement deleted"); })}>
                    <Icon name="trash" />
                  </button>
                )}
              </div>
              <div><Badge value={aud} cls={aud === WHOLE_SCHOOL ? "b-blue" : "b-purple"} /></div>
              <p>{n.body}</p>
              <footer><span>By {n.author}</span><time dateTime={n.date}>{relTime(n.date)}</time></footer>
            </article>
          );
        })}
        {!shown.length && <div className="card empty">No announcements yet.</div>}
      </div>
    </>
  );
}
