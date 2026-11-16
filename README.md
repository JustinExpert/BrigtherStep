# BrighterStep – School Management (demo)

A React + Vite school management dashboard with demo login (admin / teacher roles).

## Run locally

```bash
npm install
npm run dev
```

Demo accounts:

| Role    | Email                     | Password   |
|---------|---------------------------|------------|
| Admin   | admin@brighterstep.test   | admin123   |
| Teacher | teacher@brighterstep.test | teacher123 |
| Student | student@brighterstep.test | student123 |

Changes (added students, attendance, notices…) are saved in your browser's localStorage.
Admins can restore the sample data from the profile menu → **Reset demo data**.

## Deploy

**GitHub Pages (current):** every push to `main` builds and deploys via
`.github/workflows/deploy.yml`. Live at https://justinexpert.github.io/BrigtherStep/

**Azure Static Web Apps (alternative):** App location `/`, Output location `dist`.

> The login is a front-end demo only: credentials live in the browser bundle and data
> resets on refresh. Use a real backend (e.g. Supabase Auth or Azure SWA auth) before
> storing real student data.
