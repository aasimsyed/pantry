# Smart Pantry

Pantry inventory app with OCR (Google Vision / Tesseract), AI-powered product extraction, recipes, and mobile (Expo) + web (Vite) clients.

## Production Stack

| Component | Hosting |
|----------|---------|
| **API** | [Google Cloud Run](https://cloud.google.com/run) |
| **Frontend** | [Vercel](https://vercel.com) |
| **Mobile** | EAS / Expo (TestFlight, etc.) |
| **Database** | Cloud SQL (PostgreSQL); local: Postgres via Docker or SQLite |

- **API URL:** `https://pantry-api-apqja3ye2q-vp.a.run.app`
- **Frontend:** `https://smartpantryai.vercel.app`

## Project Structure

```
├── api/                 # FastAPI app (routes, config, deps, models)
├── src/                 # Core logic: DB, auth, OCR, AI, image processing
├── dashboard/           # Streamlit dashboard (optional)
├── frontend/            # Vite + React web app
├── mobile/              # Expo React Native app
├── tests/               # Pytest tests
├── scripts/             # Automation: deploy, secrets, admin, smoke tests
├── start_server.py      # Production entrypoint (Cloud Run)
├── start-backend-local.sh
├── deploy-cloud-run.sh
├── sync-cloud-run-env.sh
└── .env.example         # Env template → copy to .env
```

## Local Development

### Backend

**Option A – Postgres (recommended, matches production)**

Same engine as Cloud SQL. Catches migration/schema issues locally before deploy.

```bash
./scripts/start-db-local.sh   # start Postgres via Docker (port 5433)
# Add to .env: DATABASE_URL=postgresql://pantry_user:pantry_pass@localhost:5433/pantry_db
source venv/bin/activate
./start-backend-local.sh
```

**Option B – SQLite**

```bash
# In .env: DATABASE_URL=sqlite:///pantry.db
source venv/bin/activate
./start-backend-local.sh
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

### Dashboard (Streamlit)

```bash
streamlit run dashboard/app.py
```

## Deployment

- **API:** See [CLOUD_RUN_DEPLOYMENT.md](CLOUD_RUN_DEPLOYMENT.md). Use `./deploy-cloud-run.sh` or GitHub Actions.
- **Env vars:** `./sync-cloud-run-env.sh` syncs `.env.production` (or `.env`) → Cloud Run.
- **Admin user (production):** Cloud SQL Proxy + `./scripts/create_admin_production.sh`, or `python scripts/create_admin.py` / `python scripts/reset_admin_password.py` with `DATABASE_URL` set.

## Scripts

| Script | Purpose |
|--------|---------|
| `start_server.py` | Production entrypoint (Cloud Run). |
| `start-backend-local.sh` | Local API with DB init, `.env` loaded. |
| `deploy-cloud-run.sh` | Build and deploy API to Cloud Run. |
| `sync-cloud-run-env.sh` | Sync env vars to Cloud Run (`.env.production` / `.env`). |
| `scripts/create_admin.py` | Create admin user (local or prod DB). |
| `scripts/reset_admin_password.py` | Reset user password. |
| `scripts/init_database.py` | Init DB schema; optional `--import`, `--stats`. |
| `scripts/query_pantry.py` | Interactive CLI to query DB (products, inventory, etc.). |
| `scripts/kill-and-restart-backend.sh` | Kill port 8000, then start backend. |
| `scripts/create_admin_production.sh` | Create admin in Cloud SQL (via proxy). |
| `scripts/setup-secret-manager.sh` | Create/update Secret Manager secrets for Cloud Run. |
| `scripts/smoke-test-prod.sh` | Smoke-test production API (health, auth, etc.). |
| `scripts/run-migrations-cloudsql.sh` | Run migrations against Cloud SQL (via proxy). Fixes "column X does not exist" errors. |
| `scripts/start-db-local.sh` | Start local Postgres via Docker (parity with production). |
| `scripts/view-prod-logs.sh` | View production Cloud Run logs: `tail`, `read`, `open`, `open-errors`. |
| `scripts/verify-ai-setup.py` | Verify AI setup (Anthropic, OpenAI). Run from project root. |
| `scripts/verify-ocr-setup.py` | Verify OCR setup (Tesseract, Google Vision). |
| `scripts/verify-preprocessor-setup.py` | Verify ImagePreprocessor (~/Pictures/Pantry → test_results). |

## Configuration

- Copy `.env.example` → `.env` and set `SECRET_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, etc.
- OCR: `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_VISION_API_KEY` for Vision; else Tesseract.
- Production: use `.env.production` for Cloud Run; `sync-cloud-run-env.sh` syncs it.

## Tests

```bash
source venv/bin/activate
pytest
```

## License

Proprietary.
