import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { DATA } from "../data.js";
import { Badge, StatTile } from "../components/ui.jsx";
import { NoticeFeed } from "./AdminDashboard.jsx";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { students, notices, teachers } = useData();
  // Linked staff record; admins previewing this page see the first teacher.
  const me = teachers.find((t) => t.id === user.teacherId) || teachers.find((t) => t.name === user.name) || teachers[0];
  if (!me) return <div className="card empty">No teacher records found.</div>;
  const myStudents = students.filter((s) => s.class === me.class);
  const dayIdx = Math.min(Math.max(new Date().getDay() - 1, 0), 4);
  const today = DATA.routine[me.class][dayIdx];
  // Assigned classes & subjects, from the timetable: { class, subject, periods per week }.
  const assigned = [];
  Object.entries(DATA.routine).forEach(([cls, week]) => week.flat().forEach((slot) => {
    if (slot.teacher !== me.name) return;
    const row = assigned.find((a) => a.class === cls && a.subject === slot.subject);
    row ? row.periods++ : assigned.push({ class: cls, subject: slot.subject, periods: 1 });
  }));
  assigned.sort((a, b) => a.class.localeCompare(b.class));

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 24 }}>Teacher Dashboard</h2>
        <p style={{ color: "var(--muted)", margin: "6px 0 22px" }}>
          Hello {user.name.split(" ")[0]}. You teach <b>{me.subject}</b> and are class teacher of <b>Class {me.class}</b>.
        </p>
        <div className="stat-grid">
          <StatTile label="My Students" value={myStudents.length} icon="cap" tone="purple" />
          <StatTile label="Classes Today" value={today.length} icon="calendar" tone="blue" />
          <StatTile label="Classes Assigned" value={new Set(assigned.map((a) => a.class)).size} icon="class" tone="orange" />
          <StatTile label="Avg. Attendance" value={Math.round(myStudents.reduce((a, s) => a + s.attendance, 0) / (myStudents.length || 1)) + "%"} icon="list" tone="green" />
        </div>
      </div>

      <div className="grid-main">
        <div className="card">
          <div className="card-head"><h3>Today's Timetable · Class {me.class}</h3><Link className="link" to="/routine">Full timetable</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th className="no-sort">Time</th><th className="no-sort">Subject</th><th className="no-sort">Teacher</th></tr></thead>
              <tbody>
                {today.map((s, i) => (
                  <tr key={i}><td>{DATA.PERIODS[i]}</td><td><b>{s.subject}</b></td><td>{s.teacher}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Assigned Classes &amp; Subjects</h3><Link className="link" to="/students" state={{ q: "" }}>Class lists</Link></div>
          <div className="feed">
            {assigned.length ? assigned.map((a) => (
              <div className="feed-item" key={a.class + a.subject}>
                <div><h5>Class {a.class} · {a.subject}</h5><p>{a.periods} period{a.periods > 1 ? "s" : ""} a week{a.class === me.class && " · class teacher"}</p></div>
                <time>{students.filter((s) => s.class === a.class).length} students</time>
              </div>
            )) : <p className="empty">No classes on the timetable yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Class {me.class} students needing attention</h3><Link className="link" to="/attendance">Take attendance</Link></div>
          <div className="feed">
            {myStudents.filter((s) => s.attendance < 88 || s.percent < 70).slice(0, 5).map((s) => (
              <div className="feed-item" key={s.id}>
                <div><h5><Link to={`/students/${s.id}`}>{s.name}</Link></h5><p>Attendance {s.attendance}% · Score {s.percent}%</p></div>
                <time><Badge value={s.attendance < 88 ? "Low attendance" : "Low score"} cls={s.attendance < 88 ? "b-red" : "b-amber"} /></time>
              </div>
            ))}
            {!myStudents.some((s) => s.attendance < 88 || s.percent < 70) && <p className="empty">Everyone is on track 🎉</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Announcements</h3><Link className="link" to="/notice">View all</Link></div>
          <NoticeFeed notices={notices} limit={4} />
        </div>
      </div>
    </>
  );
}
