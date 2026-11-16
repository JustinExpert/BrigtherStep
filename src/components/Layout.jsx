import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Icon, { Logo } from "./Icon.jsx";
import { Avatar, FEED_TONES } from "./ui.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { useData } from "../lib/DataContext.jsx";
import { DATA } from "../data.js";
import { relTime } from "../lib/utils.js";

const ALL = ["admin", "teacher"];
const ADMIN = ["admin"];

export const NAV = [
  { label: "Home", icon: "home", children: [
    { to: "/", label: "Admin", roles: ADMIN },
    { to: "/teacher", label: "Teacher", roles: ALL },
  ]},
  { label: "Students", icon: "cap", children: [
    { to: "/students", label: "All Students", roles: ALL },
    { to: "/students/new", label: "Admission Form", roles: ADMIN },
  ]},
  { label: "Teachers", icon: "teachers", children: [
    { to: "/teachers", label: "All Teachers", roles: ALL },
  ]},
  { to: "/library", label: "Library", icon: "book", roles: ALL },
  { label: "Account", icon: "account", roles: ADMIN, children: [
    { to: "/account/fees", label: "Fees Collection", roles: ADMIN },
  ]},
  { to: "/class", label: "Class", icon: "class", roles: ALL },
  { to: "/subject", label: "Subject", icon: "subject", roles: ALL },
  { to: "/routine", label: "Routine", icon: "calendar", roles: ALL },
  { to: "/attendance", label: "Attendance", icon: "list", roles: ALL },
  { to: "/exam", label: "Exam", icon: "exam", roles: ALL },
  { to: "/notice", label: "Notice", icon: "notice", roles: ALL },
  { to: "/transport", label: "Transport", icon: "bus", roles: ADMIN },
  { to: "/hostel", label: "Hostel", icon: "building", roles: ADMIN },
];

/** Nav filtered to what the role may see (groups disappear when empty). */
export function navFor(role) {
  return NAV.map((item) => {
    if (!item.children) return item.roles.includes(role) ? item : null;
    const children = item.children.filter((c) => c.roles.includes(role));
    return children.length ? { ...item, children } : null;
  }).filter(Boolean);
}
export const ALL_ROUTES = NAV.flatMap((n) => n.children ? n.children.map((c) => ({ ...c, section: n.label })) : [n]);

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
  const { notices, students, teachers } = useData();
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
    const page = ALL_ROUTES.find((r) => r.label.toLowerCase().includes(s) && r.roles.includes(user.role));
    if (page) navigate(page.to);
    else if (teachers.some((t) => t.name.toLowerCase().includes(s))) navigate("/teachers", { state: { q } });
    else if (students.some((t) => t.name.toLowerCase().includes(s) || t.roll.includes(s))) navigate("/students", { state: { q } });
    else navigate("/students", { state: { q } });
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
        <div className="dropdown-wrap">
          <button className="round-btn" onClick={() => toggle("bell")} aria-label="Notifications"><Icon name="bell" />{!seen && <span className="dot" />}</button>
          {open === "bell" && (
            <div className="dropdown">
              <h4>Notifications</h4>
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
        <div className="dropdown-wrap">
          <button className="round-btn" onClick={() => toggle("chat")} aria-label="Messages"><Icon name="chat" /></button>
          {open === "chat" && (
            <div className="dropdown">
              <h4>Messages</h4>
              {DATA.messages.map((m) => (
                <div key={m.from} className="dd-item">
                  <Avatar name={m.from} />
                  <span><b>{m.from}</b><small>{m.text}</small></span>
                  <small style={{ marginLeft: "auto", color: "var(--muted)" }}>{m.time}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="dropdown-wrap">
          <button className="profile" onClick={() => toggle("user")} aria-label="Account menu">
            <Avatar name={user.name} color={user.role === "admin" ? "#7b2cdf" : "#ff7a3d"} />
            <span className="who-text"><strong>{user.name}</strong><small>{user.role}</small></span>
            <Icon name="chevron" />
          </button>
          {open === "user" && (
            <div className="dropdown" style={{ minWidth: 220 }}>
              <div className="dd-item" style={{ cursor: "default" }}><span><b>{user.name}</b><small>{user.email}</small></span></div>
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
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navFor(user.role);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
    const r = ALL_ROUTES.find((x) => x.to === pathname);
    document.title = `${r ? r.label : "Dashboard"} · BrighterStep`;
  }, [pathname]);

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link to="/" className="logo"><Logo />BrighterStep</Link>
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
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
