import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { DATA } from "../data.js";
import { fmtDate } from "../lib/utils.js";
import { Badge, StatTile } from "../components/ui.jsx";
import { NoticeFeed } from "./AdminDashboard.jsx";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { students, exams, notices, teachers } = useData();
  // Linked staff record; admins previewing this page see the first teacher.
  const me = teachers.find((t) => t.id === user.teacherId) || teachers.find((t) => t.name === user.name) || teachers[0];
  if (!me) return <div className="card empty">No teacher records found.</div>;
  const myStudents = students.filter((s) => s.class === me.class);
  const dayIdx = Math.min(Math.max(new Date().getDay() - 1, 0), 4);
  const today = DATA.routine[me.class][dayIdx];
  const upcoming = [...exams].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

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
          <StatTile label="Upcoming Exams" value={upcoming.length} icon="exam" tone="orange" />
          <StatTile label="Avg. Attendance" value={Math.round(myStudents.reduce((a, s) => a + s.attendance, 0) / (myStudents.length || 1)) + "%"} icon="list" tone="green" />
        </div>
      </div>

      <div className="grid-main">
        <div className="card">
          <div className="card-head"><h3>Today's Routine · Class {me.class}</h3><Link className="link" to="/routine">Full routine</Link></div>
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
          <div className="card-head"><h3>Upcoming Exams</h3><Link className="link" to="/exam">View all</Link></div>
          <div className="feed">
            {upcoming.map((e) => (
              <div className="feed-item" key={e.id}>
                <div><h5>{e.subject}</h5><p>{e.name} · Class {e.class} · {e.room}</p></div>
                <time>{fmtDate(e.date)}</time>
              </div>
            ))}
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
          <div className="card-head"><h3>Notices</h3><Link className="link" to="/notice">View all</Link></div>
          <NoticeFeed notices={notices} limit={4} />
        </div>
      </div>
    </>
  );
}
