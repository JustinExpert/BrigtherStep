import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { relTime, todayIso } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import RecordForm from "../components/RecordForm.jsx";
import { FEED_TONES, PageHead } from "../components/ui.jsx";

const TYPES = ["event", "exam", "fees", "course", "teacher"];

export default function Notice() {
  const { user } = useAuth();
  const { notices, add, remove } = useData();
  const { openModal, closeModal, confirm, toast } = useUI();

  const create = () => openModal("Post Notice", (
    <RecordForm
      fields={[
        { key: "title", label: "Title", required: true, full: true },
        { key: "type", label: "Category", type: "select", options: TYPES },
        { key: "body", label: "Message", type: "textarea", required: true },
      ]}
      submitLabel="Post notice" onCancel={closeModal}
      onSubmit={(v) => { add("notices", { ...v, date: todayIso(), author: user.name }); closeModal(); toast("Notice posted"); }}
    />
  ));

  return (
    <>
      <PageHead title="Notice Board" crumbs={["Notice"]}>
        <button className="btn" onClick={create}><Icon name="plus" />Post Notice</button>
      </PageHead>
      <div className="notice-grid">
        {notices.map((n) => {
          const [tone, icon] = FEED_TONES[n.type] || FEED_TONES.event;
          const canDelete = user.role === "admin" || n.author === user.name;
          return (
            <article className="card notice-card" key={n.id}>
              <div className="who">
                <span className={`feed-icon ${tone}`}><Icon name={icon} /></span>
                <div><h3 style={{ fontSize: 16 }}>{n.title}</h3><small style={{ textTransform: "capitalize" }}>{n.type}</small></div>
                {canDelete && (
                  <button className="icon-btn danger" style={{ marginLeft: "auto" }} aria-label="Delete notice"
                    onClick={() => confirm("Delete notice?", `"${n.title}" will be removed.`, () => { remove("notices", n.id); toast("Notice deleted"); })}>
                    <Icon name="trash" />
                  </button>
                )}
              </div>
              <p>{n.body}</p>
              <footer><span>By {n.author}</span><time dateTime={n.date}>{relTime(n.date)}</time></footer>
            </article>
          );
        })}
        {!notices.length && <div className="card empty">No notices yet.</div>}
      </div>
    </>
  );
}
