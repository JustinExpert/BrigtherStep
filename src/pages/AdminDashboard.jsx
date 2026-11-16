import { useNavigate } from "react-router-dom";
import { useData } from "../lib/DataContext.jsx";
import { DATA } from "../data.js";
import { compact, relTime } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import DataTable from "../components/DataTable.jsx";
import { Avatar, FEED_TONES, Gauge, GroupedBarChart, StatTile } from "../components/ui.jsx";

const TERM_FEE = 2800;

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
  const { students, teachers, notices } = useData();
  const navigate = useNavigate();
  const male = students.filter((s) => s.gender === "Male").length;
  const parents = new Set(students.map((s) => s.parent)).size;
  const earnings = students.filter((s) => s.fees === "Paid").length * TERM_FEE;
  const stars = [...students].sort((a, b) => b.marks - a.marks).slice(0, 5);
  const { labels, students: sAtt, teachers: tAtt } = DATA.attendanceChart;

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 24, marginBottom: 22 }}>Admin Dashboard</h2>
        <div className="stat-grid">
          <StatTile label="Students" value={compact(students.length)} icon="cap" tone="purple" />
          <StatTile label="Teachers" value={compact(teachers.length)} icon="teacher" tone="blue" />
          <StatTile label="Parents" value={compact(parents)} icon="parents" tone="orange" />
          <StatTile label="Earnings" value={"$" + compact(earnings)} icon="money" tone="green" />
        </div>
      </div>

      <div className="grid-main">
        <div className="card">
          <div className="card-head">
            <div><h3>Attendance Overview</h3><p>Students &amp; Teachers, monthly average</p></div>
            <div className="legend"><span><i style={{ background: "#7b2cdf" }} />Teacher</span><span><i style={{ background: "#ff7a3d" }} />Student</span></div>
          </div>
          <GroupedBarChart labels={labels} series={[
            { key: "t", label: "Teachers", color: "#7b2cdf", values: tAtt },
            { key: "s", label: "Students", color: "#ff7a3d", values: sAtt },
          ]} />
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
          selectable
          cols={[
            { key: "name", label: "Name", render: (r) => <div className="who"><Avatar name={r.name} color={r.color} />{r.name}</div> },
            { key: "id", label: "ID", render: (r) => r.id.replace("STU-", "PRE") },
            { key: "marks", label: "Marks" },
            { key: "percent", label: "Percent", render: (r) => r.percent + "%" },
            { key: "year", label: "Year" },
          ]}
          actions={{ onView: (r) => navigate(`/students/${r.id}`) }}
        />
        <div className="card">
          <div className="card-head"><h3>Latest Notices</h3><button className="icon-btn" onClick={() => navigate("/notice")} aria-label="Open notices"><Icon name="more" /></button></div>
          <NoticeFeed notices={notices} />
        </div>
      </div>
    </>
  );
}
