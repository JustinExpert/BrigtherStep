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

## Deploy (Azure Static Web Apps)

Build settings: **App location** `/`, **Output location** `dist`.

> The login is a front-end demo only: credentials live in the browser bundle and data
> resets on refresh. Use a real backend (e.g. Supabase Auth or Azure SWA auth) before
> storing real student data.
