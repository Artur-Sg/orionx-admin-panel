# OrionX Frontend

Admin panel UI (React + Vite + Refine).

## Local Setup

```bash
cd frontend
npm install
```

Configure `.env`:
```bash
cp .env.example .env
```

Required values:
```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:8000
VITE_GATEWAY_URL=https://api.orionx.one
```

Run dev server:
```bash
npm run dev
```

Open:
```
http://localhost:5173
```

## Production Setup (Server)

1. Set `.env` with production values:
```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_API_URL=https://api.example.com
VITE_GATEWAY_URL=https://api.orionx.one
```
2. Build static assets:
```bash
npm run build
```
3. Serve `dist/` via Nginx/S3/CloudFront or any static host.

## Google OAuth Setup

In Google Cloud Console → Credentials → OAuth Client ID:
- Authorized JavaScript origins:
  - `http://localhost:5173` (dev)
  - `https://admin.example.com` (prod)
