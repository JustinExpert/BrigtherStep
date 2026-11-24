# BrighterStep – School Management

A school management system for Philippine schools from **Kinder to College**: students, sections,
subjects, teachers, timetables, attendance, gradebooks, report cards and announcements.

- **Live demo:** https://brighterstep.vercel.app
- **Stack:** React 18 + Vite (browser app) · Vercel serverless API (`api/`, region `hkg1`) · MongoDB Atlas
- **One copy per school:** every school gets its own copy of this project: its own repository,
  Vercel project and database. Schools never share data.

---

## Contents

1. [How the system is organised](#1-how-the-system-is-organised)
2. [Roles and permissions](#2-roles-and-permissions)
3. [Setting up a new school](#3-setting-up-a-new-school)
4. [School levels (vendor only)](#4-school-levels-vendor-only)
5. [The school year, step by step](#5-the-school-year-step-by-step)
6. [Grading by level](#6-grading-by-level)
7. [College](#7-college)
8. [Report cards and reports](#8-report-cards-and-reports)
9. [Accounts and sign-in](#9-accounts-and-sign-in)
10. [Security and data rules](#10-security-and-data-rules)
11. [Performance](#11-performance)
12. [Developer guide](#12-developer-guide)
13. [Scripts](#13-scripts)
14. [Demo accounts](#14-demo-accounts)

---

## 1. How the system is organised

```
Browser (React app)  ──HTTPS──▶  Vercel API (/api/*)  ──▶  MongoDB Atlas (one database per school)
   menus, forms,                 sign-in, permissions,
   tables, report cards          validation, every save
```

- The **server decides everything**: who may see or change what, and whether a record is valid.
  The browser only receives the records a role is allowed to read.
- **School levels:** Kinder · Elementary · Junior High · Senior High · College. A school only sees
  the levels it bought (see [section 4](#4-school-levels-vendor-only)).
- **Level tabs:** pages like Students, Sections, Subjects, Timetable, Attendance, Gradebook and
  Reports have a tab for each level the school uses.
- **School years:** grades, activities, attendance and announcements belong to a school year.
  Only the open year can be changed; closed years stay readable on report cards.

### Main records

| Record | What it is |
|---|---|
| School profile | Name, contact details, school year, passing mark, grading scale, weights, strands, College programs, period times |
| Section | One grade level's class in one school year, e.g. *Grade 2 – Sampaguita* or *BSIT 1st Year – A* |
| Subject | A subject and the grade levels that take it (Senior High: strand and semester; College: units, semester, programs) |
| Student | A learner in one section; College students can also have an add/drop **subject load** |
| Teacher | Staff who teach subjects and can advise a section |
| Teaching assignment | Who teaches which subject in which section |
| Timetable | Each section's weekly schedule (days × periods) |
| Activity | A quiz, project or exam in a gradebook, with each student's score |
| Grade | A student's published grade for one subject and grading period |
| Attendance | Present / Absent / Late per student per day |
| Enrolment | History of which section a student was in, from when to when (transfers) |
| Announcement | A notice to the whole school or to one section |

---

## 2. Roles and permissions

| Role | Does |
|---|---|
| **Super Admin** | Owns the school's copy: School Setup, Roles & Permissions, backups, School Levels page |
| **School Admin** | Runs the school day to day: students, teachers, sections, subjects, timetables, users |
| **Teacher** | Their own sections: class lists, attendance, gradebook, announcements |
| **Student** | Their own profile, timetable, report card and announcements |
| **Parent** | Their children's timetable, report card and announcements |

Default access (the Super Admin can change it under **Administration → Roles & Permissions**):

| Module | Super Admin | Admin | Teacher | Student | Parent |
|---|---|---|---|---|---|
| School Setup | Full | View | — | — | — |
| User Management | Full | Full | — | — | — |
| Roles & Permissions | Full | View | — | — | — |
| Students, Teachers, Sections | Full | Full | View | — | — |
| Subjects, Timetable | Full | Full | View | View | View |
| Teaching Assignments | Full | Full | View | — | — |
| Attendance, Gradebook | Full | Full | Full | — | — |
| Announcements | Full | Full | Full | View | View |
| Reports | Full | Full | View | — | — |

Fixed rules that can't be changed: the Super Admin always keeps full access, and students and
parents can never see other people's records. **Teachers only see the sections they teach or
advise**, and can only change grades for the subjects they teach.

---

## 3. Setting up a new school

Each school gets a **copy of the project**:

1. **Copy the repository** to a new GitHub repository for the school.
2. **Create a database** in MongoDB Atlas (free M0 works for a start).
   Under Network Access, allow `0.0.0.0/0` so Vercel can connect.
3. **Create a Vercel project** from the new repository and add these environment variables
   (Settings → Environment Variables, Production):

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | The school's Atlas connection string |
   | `MONGODB_DB` | The school's database name, e.g. `brighterstep_sjc` |
   | `JWT_SECRET` | A **new** random value of 32+ characters (signs logins) |
   | `VENDOR_KEY` | A **new** vendor code of 16+ characters, kept by you only |
   | `DEMO_RESET_LINKS` | Leave empty for a real school (`true` shows reset links on screen, demo only) |
   | `ENABLED_LEVELS` | Optional, only used until levels are saved on the School Levels page |

   Generate a random value with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"
   ```
4. **Fill the database.** Locally, put the same values in `.env` and run `npm run db:check`, then
   `npm run db:seed`.
   > `db:seed` loads the **demo data** (sample students, teachers and grades). Remove the
   > sample records before the school starts using it.
5. **Deploy.** Every push to `main` redeploys. Open `/api/health` to confirm the database connection.
6. **Sign in as Super Admin.** Then:
   - change the Super Admin's password (My Account);
   - set the levels on **Administration → School Levels** with the vendor code;
   - fill in **School Setup**.
7. Before the school goes live with real data, set up **backups**: Backup & Restore page, and
   paid Atlas backups if the school wants them.

---

## 4. School levels (vendor only)

**Administration → School Levels** (Super Admin only) decides which levels this school uses.

- Saving needs the **vendor code** (`VENDOR_KEY`). The school never gets it, so a school can't turn
  on levels it didn't buy. Five wrong codes lock the page for 5 minutes.
- Changes apply immediately, with no redeploy.
- Levels that are **off** disappear everywhere: tabs, sections, subjects, students, grades and
  reports. Their data isn't deleted; turning the level back on shows it again.
- Until levels are saved once, the `ENABLED_LEVELS` variable decides (empty means every level).

---

## 5. The school year, step by step

### 5.1 School Setup (Super Admin)
**Administration → School Setup**
- School profile: name, motto, address, contacts.
- **School year:** label and start/end dates.
- **Grading system:** passing mark, letter scale (or **Use DepEd grading**: 75 passing,
  O / VS / S / FS / DME), and an optional **DepEd transmutation table**.
- **Grade components & weights:** for each subject, Written Work / Performance Tasks /
  Quarterly Assessment percentages that add up to 100%.
- **Senior High strands** (STEM, ABM, HUMSS, GAS, TVL…).
- **College programs & grade scale** (when College is on): program code, name and years, and the
  % → 1.00–5.00 table.

### 5.2 Subjects
**Subjects** (one tab per level). Each subject lists the **grade levels** that take it.
- A subject can span levels (e.g. Mathematics from Nursery to Grade 10). Editing it on one tab
  only changes that level's grades.
- **Senior High:** a **semester** (1st = Q1–Q2, 2nd = Q3–Q4) and, optionally, only some strands.
  With no strand ticked, every strand takes it.
- **College:** units, semester, and optionally only some programs (none = general education).
- A subject that's in use can't be renamed or deleted.

### 5.3 Sections
**Sections** (one tab per level), for the open school year: grade level, name, adviser, room,
capacity, plus a strand (Senior High) or program (College).
Names are unique within a grade (and within a program in College).

### 5.4 Teachers and teaching assignments
- **Teachers:** add teachers and their main subject.
- **Teaching Assignments:** for each section and subject it takes, choose the teacher.
  A teacher then sees only those sections.

### 5.5 Students
- **Students → Admission Form** adds a student to a section (this also starts their enrolment history).
- **Transfer** (on the student's page) moves a student to another section on a date, with a
  reason. Earlier grades and attendance stay with the old section.
- The Students list is paged, searched and sorted by the server, and **Export CSV** exports every
  matching student.

### 5.6 Timetable
**Timetable → Edit timetable:** choose a subject for each period of the week.
- A teacher can't be booked in two sections at the same time.
- Period start times are edited in the Time column (shared by every section).
- A level with no sections shows a button to create one first.

### 5.7 Daily work
- **Attendance:** teachers mark Present / Absent / Late for a section and date.
- **Announcements:** to the whole school or one section.
- **Gradebook:** see [section 6](#6-grading-by-level).

### 5.8 Closing the year
**School Setup → Start new school year** (download a backup first; it can't be undone) closes the open year and opens the next:
- the closed year's grades become read-only (still on report cards);
- sections, teaching assignments and timetables are copied to the new year;
- with **Move every student up one grade** ticked, every student moves up one grade (same section name
  if it exists). Students in the school's last grade **graduate**. College students move up
  within their program and graduate after its last year.

---

## 6. Grading by level

| Level | Grading periods | How a grade is made | On the report card |
|---|---|---|---|
| **Kinder** | Q1–Q4 | A checklist rating per learning area: **B** Beginning · **D** Developing · **C** Consistent | Ratings per quarter, no average |
| **Elementary / Junior High** | Q1–Q4 | Activities in Written Work / Performance Tasks / Quarterly Assessment, weighted (optional DepEd transmutation) | Quarter grades, final, general average |
| **Senior High** | 1st sem: Q1–Q2 · 2nd sem: Q3–Q4 | Same as above, per subject's semester | One table per semester, each with a general average |
| **College** | 1st sem and 2nd sem: Prelim, Midterm, Finals | Class Standing / Requirements / Major Exam, weighted, converted to **1.00–5.00** | Per semester: units, final %, grade, remark, GWA |

### Gradebook workflow (Elementary to College)
1. Open **Gradebook**, choose the level tab, the section and subject, then the grading period.
2. **Add activity** (title, component, highest possible score), or **copy** last period's activities.
3. Type each student's score. A blank means "not entered yet"; type 0 for missing work.
4. **Save scores** keeps them as a draft. **Publish grades** puts them on report cards.
   **Unpublish** hides them again.
5. If scores change after publishing, the page says "Changes not published": publish again.

### Kinder checklist
Open the Gradebook on a Kinder section, then choose a learning area and quarter. Click B, D or C for
each child, then **Publish ratings**.

---

## 7. College

- **Programs** (School Setup): e.g. BSIT, BSBA, BEED, each 1–5 years.
- **Block sections:** each College section belongs to a program and year, e.g. *BSIT 1st Year – A*.
  Students in a block take its subjects automatically.
- **Irregular students:** on a College student's page, the **Subject load** card can **Drop** block
  subjects and **Add** a subject from another College section. The added subject's teacher sees
  the student in their gradebook (marked "Irregular"), and the report card follows the load.
  A transfer clears the load.
- **Grades:** each period is a percentage; the final is the average of Prelim, Midterm and Finals,
  converted with the school's scale (default: 97+ = 1.00 … 75 = 3.00, below 75 = 5.00).
  3.00 or better passes. **INC** (Incomplete) and **DRP** (Dropped) are set on the Finals tab.
- **GWA** = Σ(grade × units) ÷ Σunits; INC and DRP don't count.

---

## 8. Report cards and reports

- **Report Card** (students and parents): built from **published** grades only, in the right
  format for the student's level, with this year's attendance. Earlier school years can be chosen
  and are read-only. **Print** saves it as PDF.
- Staff see the same report card at the bottom of a student's page.
- **Reports** (staff): attendance summary for a date range, class list, and class grades for a
  grading period (any school year), each with **Export CSV** and **Print / Save PDF**.
- **Dashboards:** totals for admins; the teacher's sections and today's schedule; the student's
  attendance and general average (GWA for College, "Checklist" for Kinder).

---

## 9. Accounts and sign-in

- **Sign in** with email and password. Students can also sign in with their **student ID**
  (e.g. `STU-43105`). Five wrong passwords lock the account for 5 minutes, however the person signs in.
- **New students (recommended):** at enrolment, open the student's page → **Sign-in accounts →
  Create logins**. It makes the student's login (email optional: without one they sign in with
  their student ID) and/or a parent login (or adds the child to a sibling's parent login), picks
  temporary passwords and prints a **sign-in slip** to hand over. Kinder and Elementary usually
  only need the parent login.
- **Temporary passwords:** every account an admin creates or resets starts on a temporary password.
  At first sign-in the person must choose their own; until then they can't open anything else.
  User Management shows "Temporary password" until they do.
- **Register:** people can sign up as a student, parent or teacher. An admin approves them under
  **User Management** and links the account to the student or teacher record (or a parent to their children).
  A student who already has a login can't be claimed again (one student login per student).
- **User Management:** add accounts, approve, activate / deactivate, link students and children,
  give a new temporary password (the lock icon; it also signs them out and clears a lockout).
- **Password reset:** "Forgot password" creates a reset link; on a real school the admin sends it
  from User Management (`DEMO_RESET_LINKS=true` shows it on screen for the demo).
- **My Account:** name, contact details, photo, change password.

---

## 10. Security and data rules

- Passwords are stored only as salted PBKDF2 hashes. Sessions are signed tokens in secure,
  HTTP-only cookies.
- Every save is checked by the server: the role's permission, the teacher's sections, and the
  record's fields. Unknown fields, wrong values (e.g. a grade of 150), database operators and
  requests from other websites are refused.
- Grades and activities can only change in the **open school year**.
- Each school has its own database, `JWT_SECRET` and `VENDOR_KEY`.
- Backups: **Administration → Backup & Restore** (Super Admin) downloads or restores everything.
  The free Atlas tier has no automatic backups.

---

## 11. Performance

- Each page's code loads only when it's opened. Files are minified, compressed (brotli) and cached
  by Vercel's CDN for a year.
- Signed-in data is kept small: staff get a slim student list at sign-in, and teachers only their
  own sections. Gradebooks, class reports and student pages load their own data when opened.
- The Students list is paged by the server (tested with 5,100 students: one page about 3 KB).
- All main database queries use indexes. Lighthouse on the login page: 97 / 100 / 100 / 100.

---

## 12. Developer guide

### Run locally
```bash
npm install
cp .env.example .env        # then fill in MONGODB_URI, MONGODB_DB, JWT_SECRET (and VENDOR_KEY)
npm run dev:api             # API on http://localhost:3001
npm run dev                 # app on http://localhost:5173 (forwards /api to the API)
```

### Where things are
| Path | What |
|---|---|
| `src/pages/` | One file per page (Gradebook, ReportCard, Students, SchoolSetup…) |
| `src/components/` | Shared UI: DataTable, CrudPage, RecordForm, Select, DateInput, Layout |
| `src/lib/` | Data store (DataContext), permissions, level tabs, grade calculation, report building |
| `src/levels.js` | Levels, grade levels, which section takes which subject, promotion rules |
| `src/constants.js` | Grading periods, semesters, College scale, school defaults |
| `src/data.js` | Demo data the database is seeded from |
| `api/data.js` | Every change (add, update, remove, transfer, new year, levels…) |
| `api/_lib/schema.js` | Field rules for every record type |
| `api/_lib/access.js` | Who may read what; data sent at sign-in |
| `api/_lib/views.js` | Data loaded per page (gradebook, class, student, students list, dashboard) |
| `api/_lib/sections.js` | Enrolment, transfers, opening the next school year |
| `scripts/` | Database scripts (see below) |

### Changing the data shape safely
1. Write an idempotent migration in `scripts/migrate-*.mjs` that saves a JSON backup first.
2. Test on a **copy** of the database: `MONGODB_DB=brighterstep_yeartest npm run dev:api`.
3. Run `npm run db:audit` on the copy, then run the migration on the live database and push.
4. Never test saves on the live site; check live deploys with read-only requests only.

---

## 13. Scripts

| Command | Does |
|---|---|
| `npm run dev` / `npm run build` | App development server / production build |
| `npm run dev:api` | Local API server (uses `.env`) |
| `npm run db:check` | Tests the database connection (never prints the password) |
| `npm run db:seed` | Loads the demo data into an empty database (`-- --reset` to start over) |
| `npm run db:audit` | Read-only health check of every record and link |
| `npm run db:add-sample-levels` | Adds sample Kinder, Junior High, Senior High and College sections, students and grades (`-- --remove` to take them out) |
| `npm run db:add-past-year` | Adds a closed sample year 2025–2026 (`-- --remove` to take it out) |
| `npm run db:migrate-years` | Upgrade: school years on grades, activities, attendance, announcements |
| `npm run db:migrate-sections` | Upgrade: classes become per-year sections with levels |
| `npm run db:migrate-subjects` | Upgrade: subjects per grade level, Senior High semesters, sample subjects |
| `npm run db:migrate-user-logins` | Upgrade: student accounts may have no email (student-ID sign-in); run before or right after deploying it |

---

## 14. Demo accounts

All `@brighterstep.test` (demo database only):

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@brighterstep.test | super123 |
| School Admin | admin@brighterstep.test | admin123 |
| Teacher | teacher@brighterstep.test | teacher123 |
| Student | student@brighterstep.test | student123 |
| Parent | parent@brighterstep.test | parent123 |

Also in the demo: a deactivated teacher (`elena.rossi@…`) and two registrations waiting for
approval (`lena.novak@…`, `tomas.reyes@…`, password `welcome123`).
**A real school must not keep these accounts.**
