# HealthSlot

Web app for clinic appointment booking: patients choose a **clinic** and **date**; the server assigns the first open slot and a clinician. Staff and **clinic coordinators** manage daily schedules and approvals; admins manage users, reports, and audit logs.

## Stack

- **Client:** React 18, Vite, TypeScript, React Router  
- **Server:** Express, TypeScript, SQLite (`better-sqlite3`), JWT + httpOnly cookies  

## Requirements

- **Node.js** 20+ recommended (for current tooling)

## Setup

```bash
npm install
```

## Development

Runs API and Vite together (API proxies from the client in dev):

```bash
npm run dev
```

- **UI:** http://localhost:5173  
- **API:** http://localhost:4000 (Vite proxies `/api` → `4000`)

Open the app in the browser at **5173** so auth cookies and `/api` work correctly.

## Database & seed

SQLite file: `server/data/healthslot.db` (created on first server start).

Demo users (run **after** the server has created the schema at least once):

```bash
npm run seed -w server
```

**Password for all seeded accounts:** `changeme123`

| Role        | Email(s) |
|------------|-----------|
| Admin      | `admin@healthslot.local` |
| Patient    | `patient@healthslot.local` |
| Coordinators | `clinic1@healthslot.local` … `clinic5@healthslot.local` |
| Providers  | `dr.clinic1@healthslot.local` … `dr.clinic5@healthslot.local` |

To reset the DB and seed again:

```bash
rm server/data/healthslot.db
npm run dev -w server   # or start server once to recreate DB
npm run seed -w server
```

(Stop the server first if it is holding the DB file open.)

## Production build

```bash
npm run build
npm start
```

Serves the API from `server/dist`. For a full production setup, serve the Vite `client/dist` as static files (or behind a reverse proxy) and set environment variables below.

## Environment variables (server)

| Variable        | Default                    | Purpose |
|----------------|----------------------------|---------|
| `PORT`         | `4000`                     | API port |
| `CLIENT_ORIGIN`| `http://localhost:5173`    | CORS + cookie context in production |
| `NODE_ENV`     | —                          | `production` tightens CORS to `CLIENT_ORIGIN` |

JWT secret and related settings live in server auth config—use a strong secret in production.

## Features (high level)

- Healthcare staff manage appointment schedules (daily view, confirm / complete / no-show).  
- Notifications for booking and status changes (in-app).  
- Admin reports and audit log endpoints.  
- Role-based access: `patient`, `staff`, `admin`; clinic coordinators scoped by clinic.  

Clinic staff sign in on the same **Log in** page as patients; `/login#clinic-sign-in` scrolls to clinic onboarding notes.

## Repo layout

```
client/     # Vite + React UI
server/     # Express API + SQLite
package.json # workspaces: `npm run dev` runs both
```

## License

Private project unless you add a license file.
