import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Icon, { Logo } from "./Icon.jsx";
import { Avatar, FEED_TONES } from "./ui.jsx";
import { homeFor, useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { useUI } from "../lib/UIContext.jsx";
import { usePermission } from "../lib/usePermission.js";
import { useVisibleNotices } from "../lib/scope.js";
import { ADMINS, ROLE_COLOR, ROLE_LABEL, STAFF } from "../lib/permissions.js";
import { relTime } from "../lib/utils.js";
import { LevelProvider, LevelTabs } from "../lib/level.jsx";

// Pages that show one school level at a time (the level tabs appear on these).
const LEVEL_PAGES = ["/students", "/class", "/subject", "/assignments", "/routine", "/attendance", "/grades", "/reports"];

/*
 * Each link is shown when the user's role is in `roles`, or when the permission matrix
 * allows `module` at level `need` (default "view").
 */
export const NAV = [
  { label: "Home", icon: "home", children: [
    { to: "/", label: "Admin", roles: ADMINS },
    { to: "/teacher", label: "Teacher", roles: STAFF },
    { to: "/student", label: "My Dashboard", roles: ["student"] },
    { to: "/profile", label: "My Profile", roles: ["student"] },
    { to: "/parent", label: "My Children", roles: ["parent"] },
  ]},
  { label: "Administration", icon: "shield", children: [
    { to: "/school-setup", label: "School Setup", module: "school" },
    { to: "/users", label: "User Management", module: "users" },
    { to: "/roles", label: "Roles & Permissions", module: "roles" },
    { to: "/backup", label: "Backup & Restore", module: "school", need: "edit" },
    { to: "/levels", label: "School Levels", roles: ["superadmin"] },
  ]},
  { label: "Students", icon: "cap", children: [
    { to: "/students", label: "All Students", module: "students" },
    { to: "/students/new", label: "Admission Form", module: "students", need: "edit" },
  ]},
  { label: "Teachers", icon: "teachers", children: [
    { to: "/teachers", label: "All Teachers", module: "teachers" },
    { to: "/assignments", label: "Teaching Assignments", module: "assignments" },
  ]},
  { label: "Grades", icon: "exam", children: [
    { to: "/grades", label: "Gradebook", module: "grades" },
    { to: "/report-card", label: "Report Card", roles: ["student", "parent"] },
  ]},
  { to: "/class", label: "Sections", icon: "class", module: "classes" },
  { to: "/subject", label: "Subjects", icon: "subject", module: "subjects" },
  { to: "/routine", label: "Routine", icon: "calendar", module: "routine" },
  { to: "/attendance", label: "Attendance", icon: "list", module: "attendance" },
  { to: "/notice", label: "Announcements", icon: "notice", module: "notices" },
  { to: "/reports", label: "Reports", icon: "chart", module: "reports" },
];
export const ALL_ROUTES = NAV.flatMap((n) => (n.children ? n.children : [n]));

export const linkAllowed = (link, role, can) => (link.roles ? link.roles.includes(role) : can(link.module, link.need || "view"));

/** Nav filtered to what the role may see (groups disappear when empty). */
function navFor(role, can) {
  return NAV.map((item) => {
    if (!item.children) return linkAllowed(item, role, can) ? item : null;
    const children = item.children.filter((c) => linkAllowed(c, role, can));
    return children.length ? { ...item, children } : null;
  }).filter(Boolean);
}

function NavGroup({ item, pathname }) {
  const containsActive = item.children.some((c) => c.to === pathname || (c.to !== "/" && pathname.startsWith(c.to + "/")));
  const [open, setOpen] = useState(containsActive);
  useEffect(() => { if (containsActive) setOpen(true); }, [containsActive]);
  return (
    <div>
      <button type="button" className={`nav-parent ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name={item.icon} /><span>{item.label}</span><Icon name="chevron" className="chev" />
      </button>
      {open && (
        <div className="nav-children">
          {item.children.map((c) => <NavLink key={c.to} to={c.to} end className="nav-link child">{c.label}</NavLink>)}
        </div>
      )}
    </div>
  );
}

function useClickAway(onAway) {
  const ref = useRef();
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onAway();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onAway]);
  return ref;
}

function TopBar({ onMenu }) {
  const { user, logout } = useAuth();
  const { students, teachers, school, resetData } = useData();
  const notices = useVisibleNotices(); // only announcements meant for this person
  const { toast, confirm } = useUI();
  const can = usePermission();
  const navigate = useNavigate();
  const [open, setOpen] = useState(null); // "bell" | "chat" | "user"
  const [seen, setSeen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useClickAway(() => setOpen(null));
  const toggle = (k) => { setOpen((o) => (o === k ? null : k)); if (k === "bell") setSeen(true); };

  const onSearch = (e) => {
    e.preventDefault();
    const s = q.trim().toLowerCase();
    if (!s) return;
    const page = ALL_ROUTES.find((r) => r.label.toLowerCase().includes(s) && linkAllowed(r, user.role, can));
    if (page) navigate(page.to);
    else if (can("teachers") && teachers.some((t) => t.name.toLowerCase().includes(s))) navigate("/teachers", { state: { q } });
    else if (can("students")) navigate("/students", { state: { q } });
    else toast(`No page matches "${q.trim()}"`); // students/parents can't browse other people's records
    setQ("");
  };

  return (
    <header className="topbar">
      <button className="round-btn menu-toggle" onClick={onMenu} aria-label="Open menu"><Icon name="menu" /></button>
      <form className="search-box" onSubmit={onSearch} role="search">
        <input placeholder="What do you want to find?" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <Icon name="search" />
      </form>
      <div className="top-actions" ref={ref}>
        {/* The open school year, on every page. Admins who manage school setup can click through to it. */}
        {can("school") ? (
          <Link to="/school-setup" className="year-chip" title="School year (open School Setup)"><Icon name="calendar" /><span>S.Y. {school.academicYear.label}</span></Link>
        ) : (
          <span className="year-chip" title="School year"><Icon name="calendar" /><span>S.Y. {school.academicYear.label}</span></span>
        )}
        {can("notices") && (
          <div className="dropdown-wrap">
            <button className="round-btn" onClick={() => toggle("bell")} aria-label="Notifications"><Icon name="bell" />{!seen && <span className="dot" />}</button>
            {open === "bell" && (
              <div className="dropdown">
                <h4>Announcements</h4>
                {notices.slice(0, 4).map((n) => {
                  const [tone, icon] = FEED_TONES[n.type] || FEED_TONES.event;
                  return (
                    <button key={n.id} className="dd-item" onClick={() => { setOpen(null); navigate("/notice"); }}>
                      <span className={`feed-icon ${tone}`} style={{ width: 36, height: 36 }}><Icon name={icon} /></span>
                      <span><b>{n.title}</b><small>{relTime(n.date)}</small></span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="dropdown-wrap">
          <button className="profile" onClick={() => toggle("user")} aria-label="Account menu">
            <Avatar name={user.name} photo={user.photo} color={ROLE_COLOR[user.role]} />
            <span className="who-text"><strong>{user.name}</strong><small>{ROLE_LABEL[user.role]}</small></span>
            <Icon name="chevron" />
          </button>
          {open === "user" && (
            <div className="dropdown" style={{ minWidth: 240 }}>
              <div className="dd-item" style={{ cursor: "default" }}><span><b>{user.name}</b><small>{user.email || user.studentId}</small></span></div>
              <button className="dd-item" onClick={() => { setOpen(null); navigate("/my-account"); }}>
                <Icon name="account" /><span>Account settings</span>
              </button>
              {user.role === "superadmin" && (
                <button className="dd-item" onClick={() => {
                  setOpen(null);
                  confirm("Reset demo data?", "All school data on the server (accounts, passwords, school setup, students, attendance, announcements…) will be replaced with the original sample data for everyone.",
                    () => resetData().then(() => toast("Demo data reset"), () => {}), "Reset");
                }}>
                  <Icon name="refresh" /><span>Reset demo data</span>
                </button>
              )}
              <button className="dd-item" onClick={() => { logout(); navigate("/login", { replace: true }); }}>
                <Icon name="logout" /><span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const { school } = useData();
  const can = usePermission();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navFor(user.role, can);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
    const r = ALL_ROUTES.find((x) => x.to === pathname);
    document.title = `${r ? r.label : "Dashboard"} · BrighterStep`;
  }, [pathname]);

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link to={homeFor(user.role)} className="logo"><Logo /><span>BrighterStep<small>{school.name}</small></span></Link>
        <nav aria-label="Main">
          {items.map((item) =>
            item.children
              ? <NavGroup key={item.label} item={item} pathname={pathname} />
              : <NavLink key={item.to} to={item.to} className="nav-link"><Icon name={item.icon} /><span>{item.label}</span></NavLink>
          )}
        </nav>
      </aside>
      {menuOpen && <div style={{ position: "fixed", inset: 0, zIndex: 45 }} onClick={() => setMenuOpen(false)} />}
      <div className="shell-main">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <LevelProvider>
          <main className="content">
            {LEVEL_PAGES.includes(pathname) && <LevelTabs />}
            <Suspense fallback={<PageSkeleton />}><Outlet /></Suspense>
          </main>
        </LevelProvider>
      </div>
    </div>
  );
}

/** Placeholder shapes while a page's code or the school data loads. `full` also covers the sidebar area. */
export function PageSkeleton({ full = false }) {
  const body = (
    <div className="skeleton" role="status" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="stat-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card sk sk-tile" />)}</div>
      <div className="card sk sk-block" />
    </div>
  );
  return full ? <div className="sk-full">{body}</div> : body;
}
