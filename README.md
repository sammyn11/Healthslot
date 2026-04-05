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

**Password for seeded admin, patient, and providers:** `changeme123`

**Clinic coordinators** (after a **fresh** seed): use **`/clinic-login`** to pick a clinic and enter the coordinator password (the default for seeded accounts is set in `server/src/clinicDefaults.ts`; change it for production). You can also sign in with **email + password** (`clinic1@healthslot.local` … `clinic5@healthslot.local`) in the main login form. If a coordinator was never given a password (`coordinator_password_set = 0`), the UI asks for a one-time setup first.

| Role        | Email(s) |
|------------|-----------|
| Admin      | `admin@healthslot.local` |
| Patient    | `patient@healthslot.local` |
| Coordinators | `clinic1@healthslot.local` … `clinic5@healthslot.local` (optional; kiosk: clinic + password) |
| Providers  | `dr.clinic1@healthslot.local` … `dr.clinic5@healthslot.local` |

On each API start, seeded coordinator password hashes are **synced from** `DEMO_COORDINATOR_PASSWORD` in `clinicDefaults.ts` unless you set `HEALTHSLOT_SKIP_DEMO_COORD_SYNC=true`. Missing coordinators are **created automatically**; `NULL` coordinator flags are fixed. Restart the API after pulling changes.

**Clinic sign-in / “No API response”:** Always use the **Vite URL** (port **5173**), e.g. **`http://127.0.0.1:5173/clinic-login`** — not port 4000 alone (the API does not serve the React app in dev). From the repo root run **`npm run dev`**; the client waits until **`http://127.0.0.1:4000/api/health`** responds so the proxy works. If your API uses a different port, add **`client/.env`** with `VITE_DEV_API_PORT=YOUR_PORT` and restart Vite.

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

Clinic coordinators: open **`/clinic-login`**, choose a clinic, enter the clinic password, then you land on **`/clinic`** (approvals dashboard). The main **`/login`** page links there too.

## Repo layout

```
client/     # Vite + React UI
server/     # Express API + SQLite
package.json # workspaces: `npm run dev` runs both
```

## License

Private project unless you add a license file.
