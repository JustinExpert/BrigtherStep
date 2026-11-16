# BrighterStep – School Management (demo)

A React + Vite school management system scoped to **MVP1**: five roles (Super Admin,
School Admin, Teacher, Student, Parent), user accounts, school setup, a role permission
matrix, classes, subjects, class lists, timetables, attendance and announcements.

Features outside MVP1 (online exams, exam schedule, library, fees, transport, hostel,
messages) were removed for testing; they are preserved in git history at commit `34e1775`.

## Run locally

```bash
npm install
npm run dev
```

Demo accounts (all `@brighterstep.test`):

| Role         | Email                        | Password   |
|--------------|------------------------------|------------|
| Super Admin  | superadmin@brighterstep.test | super123   |
| School Admin | admin@brighterstep.test      | admin123   |
| Teacher      | teacher@brighterstep.test    | teacher123 |
| Student      | student@brighterstep.test    | student123 |
| Parent       | parent@brighterstep.test     | parent123  |

Also seeded: a deactivated teacher (`elena.rossi@…`) and two registrations waiting for
approval (`lena.novak@…`, `tomas.reyes@…`, password `welcome123`).

## MVP1 status

- [x] **1. Super Admin / School Setup** — school profile, academic year, grading scale;
      five roles; per-role access matrix (Administration → Roles & Permissions)
- [x] **2. User Management** — registration with admin approval, email/password login,
      profile (name, contact, photo, ID number), add / activate / deactivate accounts,
      password reset (link shown in a demo mailbox) and change password
- Sections 3–10 are partly in place from earlier work (classes, subjects, teachers,
  attendance, timetable, notices, online exams) and are next on the list.

## How data is stored

Everything is saved in the browser's localStorage, so each browser has its own copy.
Admins can restore the sample data from the profile menu → **Reset demo data**.
Passwords are stored only as salted PBKDF2 hashes.

> This is a front-end demo: account checks and permissions run in the browser, so they
> show the flows but are not real security. Before storing real student data, move
> accounts, permissions and data to a backend (e.g. Supabase with Row Level Security)
> that enforces the same rules on the server.

## Database (MongoDB Atlas) — in progress

The app is moving from browser storage to MongoDB Atlas (free M0 cluster, Hong Kong) through a
serverless API on Vercel (`api/`, region `hkg1`).

1. Copy `.env.example` to `.env` and set `MONGODB_URI` (never commit `.env`).
2. `npm run db:check` — tests the connection (never prints the password).
3. `npm run db:seed` — loads the sample data into an empty database (`-- --reset` to start over).
4. On Vercel, set the same `MONGODB_URI` and `MONGODB_DB` under Settings → Environment Variables.
   `/api/health` shows whether the server can reach the database.

## Deploy

**Vercel (current):** https://brighterstep.vercel.app — every push to `main` redeploys.

**GitHub Pages (old):** every push to `main` builds and deploys via
`.github/workflows/deploy.yml`. Live at https://justinexpert.github.io/BrigtherStep/

**Azure Static Web Apps (alternative):** App location `/`, Output location `dist`.
