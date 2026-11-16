import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { DATA } from "../data.js";
import { fmtDate, todayIso } from "../lib/utils.js";
import { Badge, StatTile } from "../components/ui.jsx";
import { NoticeFeed } from "./AdminDashboard.jsx";
import { gradeFor } from "./SchoolSetup.jsx";

const STATUS = { P: ["Present", "b-green"], A: ["Absent", "b-red"], L: ["Late", "b-amber"] };
const FEE_CLASS = { Paid: "b-green", Pending: "b-amber", Overdue: "b-red" };

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

export default function StudentDashboard() {
  const me = useMyRecord();
  if (!me) return <MissingRecord />;
  return <StudentOverview me={me} />;
}

/** One student's overview. Used by the student themself and (with parentView) by their parent. */
export function StudentOverview({ me, parentView = false }) {
  const { exams, notices, attendance, teachers, onlineExams, submissions, school } = useData();
  const grade = gradeFor(school, me.percent);
  const pendingOnline = onlineExams.filter((e) => e.class === me.class && e.status === "published"
    && !submissions.some((s) => s.examId === e.id && s.studentId === me.id && s.status === "submitted"));

  const dayIdx = Math.min(Math.max(new Date().getDay() - 1, 0), 4);
  const today = DATA.routine[me.class]?.[dayIdx] || [];
  const myExams = exams.filter((e) => e.class === me.class && e.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date));
  const classTeacher = teachers.find((t) => t.class === me.class);
  // Attendance records saved by teachers for this student's class.
  const log = Object.entries(attendance)
    .filter(([key, marks]) => key.startsWith(me.class + "|") && marks[me.id])
    .map(([key, marks]) => ({ date: key.split("|")[1], status: marks[me.id] }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 24 }}>{parentView ? `${me.name}'s overview` : `Hello, ${me.name.split(" ")[0]} 👋`}</h2>
        <p style={{ color: "var(--muted)", margin: "6px 0 22px" }}>
          Class {me.class} · Roll {me.roll}{classTeacher && <> · Class teacher: <b>{classTeacher.name}</b></>}
        </p>
        <div className="stat-grid">
          <StatTile label="Attendance" value={me.attendance + "%"} icon="list" tone="purple" />
          <StatTile label={`Overall Score · ${grade.remark || "Grade"}`} value={`${me.percent}% · ${grade.grade}`} icon="exam" tone="blue" />
          <StatTile label="Upcoming Exams" value={myExams.length} icon="calendar" tone="orange" />
          <StatTile label="Term Fees" value={me.fees} icon="money" tone="green" />
        </div>
      </div>

      {pendingOnline.length > 0 && (
        <div className="alert info banner">
          <span>📝 {parentView ? <>{me.name.split(" ")[0]} has</> : "You have"} <b>{pendingOnline.length}</b> online exam{pendingOnline.length > 1 ? "s" : ""} to take: {pendingOnline.map((e) => e.title).join(", ")}.</span>
          {!parentView && <Link className="btn sm" to="/online-exams">Go to online exams</Link>}
        </div>
      )}

      <div className="grid-main">
        <div className="card">
          <div className="card-head"><h3>Today's Classes</h3><Link className="link" to="/routine">Full routine</Link></div>
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
          <div className="card-head"><h3>Upcoming Exams</h3><Link className="link" to="/exam">All exams</Link></div>
          <div className="feed">
            {myExams.length ? myExams.slice(0, 5).map((e) => (
              <div className="feed-item" key={e.id}>
                <div><h5>{e.subject}</h5><p>{e.name} · {e.time} · {e.room}</p></div>
                <time>{fmtDate(e.date)}</time>
              </div>
            )) : <p className="empty">No upcoming exams for Class {me.class}.</p>}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Attendance History</h3>{!parentView && <Link className="link" to="/profile">My profile</Link>}</div>
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
          <div className="alert info" style={{ marginTop: 12 }}>
            Term fees: <Badge value={me.fees} cls={FEE_CLASS[me.fees]} /> {me.fees !== "Paid" && "Please contact the accounts office."}
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
