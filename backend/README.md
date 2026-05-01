# OrionX Backend

FastAPI backend for the admin panel.

## Local Setup

### 1) Python env
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 2) Configure environment
```bash
cp .env.example .env
```

Minimal required values in `.env`:
```
DATABASE_URL=postgresql+asyncpg://orionx:orionx@localhost:5432/orionx
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=change_me
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CORS_ORIGINS=http://localhost:5173
APISIX_ADMIN_URL=http://localhost:9180
APISIX_ADMIN_KEY=dummy
APISIX_USAGE_SINK_URL=
APISIX_USAGE_SINK_TOKEN=
```
Usage ingestion notes:
- `APISIX_USAGE_SINK_URL` must be reachable by APISIX (not localhost unless APISIX is on the same host/network namespace).
- Use the backend usage endpoint path exactly: `/internal/usage/apisix`.
- `APISIX_USAGE_SINK_TOKEN` must be non-empty to accept usage events.
- Generate token:
```bash
openssl rand -hex 32
```
- After changing sink URL/token: restart backend + worker, then run chain `Resync`.

### 3) Run migrations
```bash
alembic upgrade head
```

### 4) Run the app
```bash
uvicorn app.main:app --reload
```

### 5) Run the worker
```bash
python -m app.workers.rq_worker
```
Note: on macOS the worker uses `SimpleWorker` automatically to avoid fork/objc issues.

Health check:
```
GET http://localhost:8000/health
```
APISIX health check:
```
GET http://localhost:8000/health/apisix
```

## Production Setup (Server)

1. Install Python 3.11+ and a system service manager (systemd/supervisor).
2. Create a virtualenv, install dependencies:
```bash
python3 -m venv /opt/orionx-backend/.venv
source /opt/orionx-backend/.venv/bin/activate
pip install -e /opt/orionx-backend
```
3. Provide `.env` with production values:
```
DATABASE_URL=postgresql+asyncpg://user:password@db-host:5432/orionx
REDIS_URL=redis://redis-host:6379/0
JWT_SECRET=very-strong-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CORS_ORIGINS=https://admin.example.com
APISIX_ADMIN_URL=http://apisix-admin:9180
APISIX_ADMIN_KEY=strong-key
APISIX_USAGE_SINK_URL=https://backend.example.com/internal/usage/apisix
APISIX_USAGE_SINK_TOKEN=<generated-secret>
```
4. Run migrations:
```bash
alembic upgrade head
```
5. Run the server (example with uvicorn + systemd):
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
6. Run the worker (systemd/supervisor):
```bash
python -m app.workers.rq_worker
```
7. Put a reverse proxy in front (Nginx/Traefik) and terminate TLS there.

## Structure

- `app/api` – HTTP routes
- `app/core` – config & logging
- `app/db` – DB session/base
- `app/modules` – domain modules (auth/users/billing/apisix)
- `app/workers` – background workers (RQ)
