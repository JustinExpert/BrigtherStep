import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { DATA } from "../constants.js";
import { fmtDate } from "../lib/utils.js";
import { Badge, StatTile } from "../components/ui.jsx";
import { NoticeFeed } from "./AdminDashboard.jsx";
import { gradeFor } from "./SchoolSetup.jsx";
import { buildReport, subjectsOf, teacherFor, useVisibleNotices } from "../lib/scope.js";

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

/** Subjects a class takes (from its timetable) with the assigned teacher for each. */
export function classSubjects(routine, cls, assignments, teachers) {
  return subjectsOf(routine, cls).map((subject) => ({ subject, teacher: teacherFor(assignments, teachers, cls, subject) }));
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
  const data = useData();
  const { attendance, teachers, classes, school, assignments, routine } = data;
  const notices = useVisibleNotices(me); // whole-school + this student's class
  const { average } = buildReport(me, data); // general average of published grades
  const grade = average === null ? null : gradeFor(school, average);
  const dayIdx = Math.min(Math.max(new Date().getDay() - 1, 0), 4);
  const today = routine[me.class]?.[dayIdx] || [];
  const subjects = classSubjects(routine, me.class, assignments, teachers);
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
          <StatTile label={grade ? `General Average · ${grade.remark}` : "General Average"} value={grade ? `${average} · ${grade.grade}` : "—"} icon="exam" tone="blue" />
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
                {today.map((s, i) => <tr key={i}><td>{DATA.PERIODS[i]}</td><td><b>{s.subject}</b></td><td>{teacherFor(assignments, teachers, me.class, s.subject)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Subjects &amp; Enrolled Class</h3><Link className="link" to="/report-card">Report card</Link></div>
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
