# Smart Pantry

Pantry inventory app with OCR (Google Vision / Tesseract), AI-powered product extraction, recipes, and mobile (Expo) + web (Vite) clients.

## Production Stack

| Component | Hosting |
|----------|---------|
| **API** | [Google Cloud Run](https://cloud.google.com/run) |
| **Frontend** | [Vercel](https://vercel.com) |
| **Mobile** | EAS / Expo (TestFlight, etc.) |
| **Database** | Cloud SQL (PostgreSQL) or SQLite (local) |

- **API URL:** `https://pantry-api-apqja3ye2q-vp.a.run.app`
- **Frontend:** `https://smartpantryai.vercel.app`

## Local Development

### Backend

```bash
# Create venv, install deps, configure .env (see SECURITY_ENV_EXAMPLE.txt)
source venv/bin/activate
./start-backend-local.sh   # or ./kill-and-restart-backend.sh
```

API: `http://localhost:8000`, docs: `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend && npm install && npm run dev
```

### Mobile (Expo)

```bash
cd mobile
EXPO_PUBLIC_API_URL=http://localhost:8000 ./run-local.sh
# On a physical device, use your machine's IP instead of localhost.
```

See `mobile/LOCAL_DEVELOPMENT.md` for details.

## Deployment

- **API:** See [CLOUD_RUN_DEPLOYMENT.md](CLOUD_RUN_DEPLOYMENT.md). Use `./deploy-cloud-run.sh` or GitHub Actions.
- **Env vars:** `./sync-cloud-run-env.sh` to push `.env` → Cloud Run.
- **Admin user (production):** Cloud SQL Proxy + `./create_admin_production.sh`, or `create_admin.py` / `reset_admin_password.py` with `DATABASE_URL` set.

## Scripts

| Script | Purpose |
|--------|---------|
| `start_server.py` | Production entrypoint (Cloud Run). |
| `start-backend-local.sh` | Local API with DB init, `.env` loaded. |
| `kill-and-restart-backend.sh` | Kill port 8000, then start backend. |
| `deploy-cloud-run.sh` | Build and deploy API to Cloud Run. |
| `sync-cloud-run-env.sh` | Sync `.env` vars to Cloud Run. |
| `create_admin.py` | Create admin user (local or prod DB). |
| `reset_admin_password.py` | Reset user password. |
| `create_admin_production.sh` | Create admin in Cloud SQL (via proxy). |

## Configuration

- Copy `SECURITY_ENV_EXAMPLE.txt` → `.env` and set `SECRET_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, etc.
- OCR: `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_VISION_API_KEY` for Vision; else Tesseract.

## Tests

```bash
source venv/bin/activate
pytest
```

## License

Proprietary.
