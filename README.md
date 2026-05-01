# OrionX Admin Panel

Admin panel for managing users and subscription plans, with Google auth and API gateway enforcement via APISIX.

## Architecture (High Level)

- **Frontend**: React/Vite + Refine UI
  - Google login via One Tap
  - Calls backend only
- **Backend**: FastAPI (source of truth)
  - Users/Orgs/Memberships/Plans/Subscriptions in Postgres
  - APISIX admin integration (health check + future sync)
- **Data**: Postgres (source of truth)
- **Queue/Cache**: Redis + RQ worker (sync to APISIX)
- **Gateway**: APISIX for auth/limits on your APIs

## Repository Layout

- `frontend/` — UI (React/Vite/Refine)
- `backend/` — FastAPI service, migrations, auth
- `db/` — Docker Compose for Postgres + Redis

## Local Quickstart

### 1) Start DB + Redis
```bash
cd db
docker compose up -d
```

### 2) Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

Edit `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://orionx:orionx@localhost:5432/orionx
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=change_me
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CORS_ORIGINS=http://localhost:5173
APISIX_ADMIN_URL=http://localhost:9180
APISIX_ADMIN_KEY=change_me
APISIX_USAGE_SINK_URL=
APISIX_USAGE_SINK_TOKEN=
```

Run migrations and server:
```bash
alembic upgrade head
uvicorn app.main:app --reload
```

Start worker:
```bash
python -m app.workers.rq_worker
```

Health checks:
```
GET http://localhost:8000/health
GET http://localhost:8000/health/redis
GET http://localhost:8000/health/apisix
```

### 3) Frontend
```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:
```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:8000
VITE_GATEWAY_URL=https://api.orionx.one
```

Run UI:
```bash
npm run dev
```
Open `http://localhost:5173`.

## Google OAuth Setup

In Google Cloud Console → Credentials → OAuth Client ID:
- Authorized JavaScript origins:
  - `http://localhost:5173`
  - `https://admin.example.com` (prod)

## Where to Look

- Backend auth endpoints: `backend/app/api/routes/auth.py`
- JWT helpers: `backend/app/modules/auth/security.py`
- DB models: `backend/app/modules/users/models.py`, `backend/app/modules/billing/models.py`
- Migrations: `backend/alembic/versions/`
- Frontend auth: `frontend/src/authProvider.ts`
- Health UI: `frontend/src/pages/health.tsx`

## Notes

- APISIX Admin API is configured via `APISIX_ADMIN_URL` and `APISIX_ADMIN_KEY`.
- Redis + RQ worker are required for async sync to APISIX.

## Production Deploy (Detailed)

Below is a practical, step-by-step production setup. Adjust paths and domains as needed.

### 1) Infrastructure
- **Postgres** and **Redis** (managed or Docker).
- **APISIX** admin endpoint reachable from backend/worker hosts.
- **Backend** and **Worker** on the same network.

### 2) Database + Redis
- Provision Postgres and Redis.
- Restrict access to backend/worker hosts only.
- Example connection strings:
```
DATABASE_URL=postgresql+asyncpg://user:password@db-host:5432/orionx
REDIS_URL=redis://redis-host:6379/0
```

### 3) Backend (FastAPI)
1. Create a virtualenv and install:
```bash
python3 -m venv /opt/orionx-backend/.venv
source /opt/orionx-backend/.venv/bin/activate
pip install -e /opt/orionx-backend
```
2. Create `/opt/orionx-backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://user:password@db-host:5432/orionx
REDIS_URL=redis://redis-host:6379/0
JWT_SECRET=very-strong-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CORS_ORIGINS=https://admin.example.com
APISIX_ADMIN_URL=http://apisix-admin:9180
APISIX_ADMIN_KEY=your-admin-key
APISIX_USAGE_SINK_URL=
APISIX_USAGE_SINK_TOKEN=
```
Notes:
- `APISIX_USAGE_SINK_URL` must be reachable from the APISIX server (public URL or private network URL), for example:
  - `https://backend.example.com/internal/usage/apisix`
- `APISIX_USAGE_SINK_TOKEN` is required for usage ingestion. Generate a strong token, for example:
```bash
openssl rand -hex 32
```
- After changing these values, restart backend + worker and run chain `Resync` so APISIX route plugins are updated.
3. Run migrations:
```bash
alembic upgrade head
```
4. Run backend (example):
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 4) Worker (RQ)
Run the worker as a separate process:
```bash
source /opt/orionx-backend/.venv/bin/activate
python -m app.workers.rq_worker
```
On Linux, use systemd/supervisor for both backend and worker.

### 5) Frontend (Vite)
1. Create `.env` for build:
```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_API_URL=https://api.example.com
VITE_GATEWAY_URL=https://api.orionx.one
```
2. Build:
```bash
npm run build
```
3. Serve `dist/` via Nginx or a static host (S3/CloudFront).

### 6) Google OAuth (Production)
In Google Cloud Console → Credentials → OAuth Client ID:
- Authorized JavaScript origins:
  - `https://admin.example.com`

### 7) APISIX Notes
- APISIX is **not** the source of truth. All changes go through the backend.
- APISIX Admin API must be private and reachable only from backend/worker.

### 8) Health Checks
- `GET /health`
- `GET /health/redis`
- `GET /health/apisix`

### 9) Recommended systemd unit (example)
Create one unit for backend and one for worker (not included here). Ensure:
- `WorkingDirectory=/opt/orionx-backend`
- Environment file `.env`
- Auto-restart on failure
