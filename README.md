# BrighterStep – School Management (demo)

A React + Vite school management system with five roles (Super Admin, School Admin,
Teacher, Student, Parent), user accounts, school setup, a role permission matrix,
attendance, timetables, online exams and more.

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

## Deploy

**GitHub Pages (current):** every push to `main` builds and deploys via
`.github/workflows/deploy.yml`. Live at https://justinexpert.github.io/BrigtherStep/

**Azure Static Web Apps (alternative):** App location `/`, Output location `dist`.
