# OrionX Admin Panel

Admin panel for managing users and subscription plans, with Google auth and API gateway enforcement via APISIX.

## Architecture (High Level)

- **Frontend**: React/Vite + Refine UI
  - Google login via One Tap
  - Calls backend only
- **Backend**: FastAPI (source of truth)
  - Users/Orgs/Memberships/Plans/Subscriptions in Postgres
  - JWT access/refresh tokens
  - APISIX admin integration (health check + future sync)
- **Data**: Postgres (source of truth)
- **Queue/Cache**: Redis (RQ worker later)
- **Gateway**: APISIX for auth/limits on your APIs

## Repository Layout

- `frontend/` — UI (React/Vite/Refine)
- `backend/` — FastAPI service, migrations, auth
- `db/` — Docker Compose for Postgres + Redis
- `AGENTS.md` / `CLAUDE.md` — workflow guidance (dev only)

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
```

Run migrations and server:
```bash
alembic upgrade head
uvicorn app.main:app --reload
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
- Redis is present; RQ worker can be added later for async sync.

## Production Deploy (Outline)

### 1) Database + Redis
- Provision Postgres and Redis (managed services or Docker).
- Ensure network access only from backend hosts.
- Run migrations from backend:
```bash
alembic upgrade head
```

### 2) Backend
- Install Python 3.11+ and create a virtualenv.
- Configure `.env` with production values (DB, Redis, JWT secret, CORS origins, APISIX admin).
- Run with a process manager (systemd/supervisor) and put Nginx/Traefik in front.

### 3) Frontend
- Build static assets:
```bash
npm run build
```
- Serve `dist/` via Nginx or a static host (S3/CloudFront).
- Set `VITE_API_URL` to the public backend URL.

### 4) Google OAuth
- Add production domain to Authorized JavaScript origins.
