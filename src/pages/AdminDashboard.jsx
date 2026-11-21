import { useNavigate } from "react-router-dom";
import { useData } from "../lib/DataContext.jsx";
import { monthlyAttendance, pct } from "../lib/stats.js";
import { useStudentStats } from "../lib/useStudentStats.js";
import { compact, relTime } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import DataTable from "../components/DataTable.jsx";
import { Avatar, FEED_TONES, Gauge, GroupedBarChart, StatTile } from "../components/ui.jsx";


export function NoticeFeed({ notices, limit = 4 }) {
  return (
    <div className="feed">
      {notices.slice(0, limit).map((n) => {
        const [tone, icon] = FEED_TONES[n.type] || FEED_TONES.event;
        return (
          <div className="feed-item" key={n.id}>
            <span className={`feed-icon ${tone}`}><Icon name={icon} /></span>
            <div style={{ minWidth: 0 }}><h5>{n.title}</h5><p>{n.body}</p></div>
            <time dateTime={n.date}>{relTime(n.date)}</time>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const { students, teachers, notices, classes, attendance, school } = useData();
  const navigate = useNavigate();
  const stats = useStudentStats();
  const male = students.filter((s) => s.gender === "Male").length;
  const parents = new Set(students.map((s) => s.parent)).size;
  // Top 5 by general average of this year's published grades.
  const stars = students
    .map((s) => ({ ...s, average: stats.get(s.id)?.average ?? null, attendanceRate: stats.get(s.id)?.attendance.rate ?? null }))
    .filter((s) => s.average !== null)
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name))
    .slice(0, 5);
  const chart = monthlyAttendance(attendance, school.academicYear);
  const hasAttendance = chart.values.some((v) => v !== null);

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 24, marginBottom: 22 }}>Admin Dashboard</h2>
        <div className="stat-grid">
          <StatTile label="Students" value={compact(students.length)} icon="cap" tone="purple" />
          <StatTile label="Teachers" value={compact(teachers.length)} icon="teacher" tone="blue" />
          <StatTile label="Parents" value={compact(parents)} icon="parents" tone="orange" />
          <StatTile label="Classes" value={classes.length} icon="class" tone="green" />
        </div>
      </div>

      <div className="grid-main">
        <div className="card">
          <div className="card-head">
            <div><h3>Attendance Overview</h3><p>Students present (incl. late), monthly · S.Y. {school.academicYear.label}</p></div>
            <div className="legend"><span><i style={{ background: "#7b2cdf" }} />Students</span></div>
          </div>
          {hasAttendance
            ? <GroupedBarChart labels={chart.labels} series={[{ key: "s", label: "Students", color: "#7b2cdf", values: chart.values }]} />
            : <p className="empty">No attendance has been recorded this school year yet. It appears here as teachers take attendance.</p>}
        </div>
        <div className="card">
          <div className="card-head"><h3>Students</h3><button className="icon-btn" onClick={() => navigate("/students")} aria-label="Open students"><Icon name="more" /></button></div>
          <Gauge total={students.length} outer={students.length ? male / students.length : 0} inner={students.length ? 1 - male / students.length : 0} />
          <div className="legend big">
            <span><i style={{ background: "#7b2cdf" }} />Male · {male}</span>
            <span><i style={{ background: "#ff7a3d" }} />Female · {students.length - male}</span>
          </div>
        </div>
      </div>

      <div className="grid-main">
        <DataTable
          title="Star Students"
          rows={stars}
          cols={[
            { key: "name", label: "Name", render: (r) => <div className="who"><Avatar name={r.name} color={r.color} />{r.name}</div> },
            { key: "id", label: "ID" },
            { key: "class", label: "Class" },
            { key: "average", label: "Average", render: (r) => <b>{r.average}</b> },
            { key: "attendanceRate", label: "Attendance", render: (r) => pct(r.attendanceRate) },
          ]}
          actions={{ onView: (r) => navigate(`/students/${r.id}`) }}
        />
        <div className="card">
          <div className="card-head"><h3>Latest Announcements</h3><button className="icon-btn" onClick={() => navigate("/notice")} aria-label="Open announcements"><Icon name="more" /></button></div>
          <NoticeFeed notices={notices} />
        </div>
      </div>
    </>
  );
}
