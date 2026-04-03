# OrionX Database

PostgreSQL via Docker Compose.

## Local Setup

Start the database:
```bash
cd db
docker compose up -d
```

Default credentials (from `docker-compose.yml`):
- Host: `localhost`
- Port: `5432`
- Database: `orionx`
- User: `orionx`
- Password: `orionx`

## Redis

Redis is started by the same compose file.

Connection:
- Host: `localhost`
- Port: `6379`

## Connect with psql

```bash
docker compose exec postgres psql -U orionx -d orionx
```

## Connect with GUI (Beekeeper / DBeaver / TablePlus)

Use the same parameters:
- Host: `localhost`
- Port: `5432`
- Database: `orionx`
- User: `orionx`
- Password: `orionx`
- SSL: `disable`

## Server Setup

1. Install Docker Engine (Docker Desktop, Colima, or Linux Docker).
2. Run:
```bash
cd db
docker compose up -d
```
3. Make sure firewall allows TCP `5432` only from your backend host or internal network.

## Applying schema

Run migrations from backend:
```bash
cd backend
alembic upgrade head
```
