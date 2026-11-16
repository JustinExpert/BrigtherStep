import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { DATA } from "../data.js";
import { fmtDate } from "../lib/utils.js";
import { Badge, StatTile } from "../components/ui.jsx";
import { NoticeFeed } from "./AdminDashboard.jsx";
import { gradeFor } from "./SchoolSetup.jsx";

const STATUS = { P: ["Present", "b-green"], A: ["Absent", "b-red"], L: ["Late", "b-amber"] };

export function useMyRecord() {
  const { user } = useAuth();
  const { students } = useData();
  return students.find((s) => s.id === user.studentId);
}

export const MissingRecord = () => (
  <div className="card empty">
    Your student record couldn't be found. It may have been removed. Please contact the school office.
  </div>
);

/** Subjects a class takes (from its timetable) with the teacher for each. */
export function classSubjects(cls) {
  const seen = new Map();
  (DATA.routine[cls] || []).flat().forEach((s) => !seen.has(s.subject) && seen.set(s.subject, s.teacher));
  return [...seen].map(([subject, teacher]) => ({ subject, teacher }));
}

/** Attendance marks saved by teachers for one student, newest first. */
export function attendanceLog(attendance, student) {
  return Object.entries(attendance)
    .filter(([key, marks]) => key.startsWith(student.class + "|") && marks[student.id])
    .map(([key, marks]) => ({ date: key.split("|")[1], status: marks[student.id] }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export default function StudentDashboard() {
  const me = useMyRecord();
  if (!me) return <MissingRecord />;
  return <StudentOverview me={me} />;
}

/** One student's overview. Used by the student themself and (with parentView) by their parent. */
export function StudentOverview({ me, parentView = false }) {
  const { notices, attendance, teachers, classes, school } = useData();
  const grade = gradeFor(school, me.percent);
  const dayIdx = Math.min(Math.max(new Date().getDay() - 1, 0), 4);
  const today = DATA.routine[me.class]?.[dayIdx] || [];
  const subjects = classSubjects(me.class);
  const classTeacher = teachers.find((t) => t.class === me.class);
  const section = classes.find((c) => c.name === "Class " + me.class)?.section;
  const log = attendanceLog(attendance, me);
  const count = (v) => log.filter((r) => r.status === v).length;

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 24 }}>{parentView ? `${me.name}'s overview` : `Hello, ${me.name.split(" ")[0]} 👋`}</h2>
        <p style={{ color: "var(--muted)", margin: "6px 0 22px" }}>
          Class {me.class}{section && `-${section}`} · Roll {me.roll}{classTeacher && <> · Class teacher: <b>{classTeacher.name}</b></>} · {school.academicYear.label}
        </p>
        <div className="stat-grid">
          <StatTile label="Attendance (term)" value={me.attendance + "%"} icon="list" tone="purple" />
          <StatTile label={`Overall Score · ${grade.remark || "Grade"}`} value={`${me.percent}% · ${grade.grade}`} icon="exam" tone="blue" />
          <StatTile label="Subjects" value={subjects.length} icon="subject" tone="orange" />
          <StatTile label="Classes today" value={today.length} icon="calendar" tone="green" />
        </div>
      </div>

      <div className="grid-main">
        <div className="card">
          <div className="card-head"><h3>Today's Classes</h3><Link className="link" to="/routine">Full timetable</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th className="no-sort">Time</th><th className="no-sort">Subject</th><th className="no-sort">Teacher</th></tr></thead>
              <tbody>
                {today.map((s, i) => <tr key={i}><td>{DATA.PERIODS[i]}</td><td><b>{s.subject}</b></td><td>{s.teacher}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Subjects &amp; Enrolled Class</h3><Link className="link" to="/subject">All subjects</Link></div>
          <div className="feed">
            {subjects.map((s) => (
              <div className="feed-item" key={s.subject}>
                <div><h5>{s.subject}</h5><p>{s.teacher}</p></div>
                <time>Class {me.class}</time>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Attendance History</h3>{!parentView && <Link className="link" to="/profile">My profile</Link>}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <Badge value={`${count("P")} present`} cls="b-green" />
            <Badge value={`${count("A")} absent`} cls="b-red" />
            <Badge value={`${count("L")} late`} cls="b-amber" />
          </div>
          {log.length ? (
            <div className="feed">
              {log.slice(0, 6).map((r) => (
                <div className="feed-item" key={r.date}>
                  <div><h5>{fmtDate(r.date)}</h5></div>
                  <time><Badge value={STATUS[r.status][0]} cls={STATUS[r.status][1]} /></time>
                </div>
              ))}
            </div>
          ) : <p className="empty">No attendance has been recorded yet. The term average is {me.attendance}%.</p>}
        </div>
        <div className="card">
          <div className="card-head"><h3>Announcements</h3><Link className="link" to="/notice">View all</Link></div>
          <NoticeFeed notices={notices} limit={4} />
        </div>
      </div>
    </>
  );
}
