import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData, useView } from "../lib/DataContext.jsx";
import { DATA } from "../constants.js";
import { teacherWeek, useScope, useVisibleNotices } from "../lib/scope.js";
import { Badge, StatTile } from "../components/ui.jsx";
import { NoticeFeed } from "./AdminDashboard.jsx";
import { useSections } from "../lib/sections.js";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { students, teachers, assignments, routine, school } = useData();
  const notices = useVisibleNotices();
  const scope = useScope();
  // Draft grades and low-attendance students are counted by the database for this teacher's classes.
  const summary = useView({ view: "summary" });
  // Admins previewing this page see the first teacher's view.
  const me = teachers.find((t) => t.id === user.teacherId) || (user.role !== "teacher" ? teachers[0] : null);
  if (!me) return <div className="card empty">Your account isn't linked to a staff record yet. Please ask the school admin.</div>;

  const sections = useSections();
  const label = sections.label;
  const order = (id) => sections.current.findIndex((c) => c.id === id);
  const mine = assignments.filter((a) => a.teacherId === me.id && order(a.class) >= 0).sort((a, b) => order(a.class) - order(b.class));
  const advised = sections.current.filter((c) => c.adviser === me.id).map((c) => c.id); // sections this teacher advises
  const classes = [...new Set([...mine.map((a) => a.class), ...advised])];
  const myStudents = students.filter((s) => classes.includes(s.class));
  const dayIdx = Math.min(Math.max(new Date().getDay() - 1, 0), 4);
  const today = teacherWeek(routine, assignments, me.id)[dayIdx];
  const periodsOf = (a) => (routine[a.class] || []).flat().filter((s) => s.subject === a.subject).length;
  const drafts = summary.data?.drafts ?? "—"; // only counted for teachers' own accounts (admins previewing see "—")
  // Students whose recorded attendance this school year is under 88%, lowest first.
  const byId = new Map(myStudents.map((s) => [s.id, s]));
  const low = new Map((summary.data?.lowAttendance || []).map((x) => [x.studentId, x]));
  const rateOf = (s) => low.get(s.id)?.rate ?? null;
  const attention = [...low.keys()].filter((id) => byId.has(id)).map((id) => byId.get(id));

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 24 }}>Teacher Dashboard</h2>
        <p style={{ color: "var(--muted)", margin: "6px 0 22px" }}>
          Hello {me.name.split(" ")[0]}. You teach <b>{[...new Set(mine.map((a) => a.subject))].join(", ") || "no subjects yet"}</b>
          {" "}{advised.length ? <> and advise <b>{advised.map(label).join(", ")}</b></> : null}.{!scope.all && " You only see the students in your classes."}
        </p>
        <div className="stat-grid">
          <StatTile label="My Students" value={myStudents.length} icon="cap" tone="purple" />
          <StatTile label="Classes Assigned" value={classes.length} icon="class" tone="orange" />
          <StatTile label="Periods Today" value={today.filter(Boolean).length} icon="calendar" tone="blue" />
          <StatTile label="Grades to publish" value={drafts} icon="exam" tone="green" />
        </div>
      </div>

      {drafts > 0 && (
        <div className="alert info banner">
          <span>📝 You have <b>{drafts}</b> draft grade{drafts > 1 ? "s" : ""} that students can't see yet.</span>
          <Link className="btn sm" to="/grades">Open gradebook</Link>
        </div>
      )}

      <div className="grid-main">
        <div className="card">
          <div className="card-head"><h3>My Timetable Today</h3><Link className="link" to="/routine">Full timetable</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th className="no-sort">Time</th><th className="no-sort">Class</th><th className="no-sort">Subject</th></tr></thead>
              <tbody>
                {today.map((s, i) => (
                  <tr key={i}><td>{(school.periods || DATA.PERIODS)[i]}</td><td>{s ? <b>Class {s.class}</b> : <span className="muted">Free</span>}</td><td>{s?.subject || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Assigned Classes &amp; Subjects</h3><Link className="link" to="/students">Class lists</Link></div>
          <div className="feed">
            {mine.length ? mine.map((a) => (
              <div className="feed-item" key={a.id}>
                <div><h5>{label(a.class)} · {a.subject}</h5><p>{periodsOf(a)} period{periodsOf(a) > 1 ? "s" : ""} a week{advised.includes(a.class) && " · class teacher"}</p></div>
                <time>{students.filter((s) => s.class === a.class).length} students</time>
              </div>
            )) : <p className="empty">No teaching assignments yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Students with low attendance</h3><Link className="link" to="/attendance">Take attendance</Link></div>
          <div className="feed">
            {attention.slice(0, 6).map((s) => (
              <div className="feed-item" key={s.id}>
                <div><h5><Link to={`/students/${s.id}`}>{s.name}</Link></h5><p>{label(s.class)} · attendance {rateOf(s)}% ({low.get(s.id).absent} absent)</p></div>
                <time><Badge value="Below 88%" cls="b-red" /></time>
              </div>
            ))}
            {summary.loading ? <p className="hint" role="status">Loading…</p>
              : summary.error ? <div className="alert error" role="alert">{summary.error}</div>
              : !attention.length && <p className="empty">Everyone is on track 🎉</p>}
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
