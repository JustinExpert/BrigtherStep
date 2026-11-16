import { useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { Avatar } from "../components/ui.jsx";
import { StudentOverview } from "./StudentDashboard.jsx";

/** Parents see only the children linked to their account. */
export function useMyChildren() {
  const { user } = useAuth();
  const { students } = useData();
  return (user.childIds || []).map((id) => students.find((s) => s.id === id)).filter(Boolean);
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const children = useMyChildren();
  const [active, setActive] = useState(0);

  if (!children.length) {
    return (
      <div className="card empty">
        Hello {user.name.split(" ")[0]}. No children are linked to your account yet. Please ask the school office to link your child's student record.
      </div>
    );
  }
  const child = children[Math.min(active, children.length - 1)];

  return (
    <>
      {children.length > 1 && (
        <div className="tabs child-tabs" role="tablist" aria-label="Choose a child">
          {children.map((c, i) => (
            <button key={c.id} role="tab" aria-selected={c.id === child.id} className={c.id === child.id ? "on" : ""} onClick={() => setActive(i)}>
              <Avatar name={c.name} color={c.color} />{c.name}
            </button>
          ))}
        </div>
      )}
      <StudentOverview key={child.id} me={child} parentView />
    </>
  );
}
