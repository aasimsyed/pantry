# Production Readiness & Code Organization

Summary of recent tidy-ups and a roadmap for further improvements.

## Done

- **Env config:** Single `.env.example` (merged with `SECURITY_ENV_EXAMPLE`). `SECURITY_ENV_EXAMPLE.txt` now points to it.
- **Scripts:** `create_admin_production.sh`, `setup-secret-manager.sh`, `kill-and-restart-backend.sh` moved to `scripts/`. `scripts/smoke-test-prod.sh` for API smoke tests.
- **README:** Project structure section, script table with `scripts/` paths, config references `.env.example` and `.env.production`.
- **Fix DB scripts:** `fix_database_*` remain gitignored; remove from disk if no longer needed.

## Recommended Next Steps

### 1. Split `api/main.py` into routers (high impact)

`api/main.py` is ~2.9k lines with many routes. Split by domain:

```
api/
├── main.py          # App factory, CORS, middleware, include_routers
├── routers/
│   ├── __init__.py
│   ├── health.py    # /, /health
│   ├── auth.py      # /api/auth/*
│   ├── products.py  # /api/products*
│   ├── inventory.py # /api/inventory*, /api/expiring, /api/expired, process-image, refresh
│   ├── pantries.py  # /api/pantries*
│   ├── recipes.py   # /api/recipes*
│   ├── user.py      # /api/user/settings
│   └── admin.py     # /api/admin/*
├── config.py
├── dependencies.py
└── models.py
```

- Move route handlers into `APIRouter` instances, keep shared deps in `dependencies.py`, then `app.include_router(router, prefix="...")` in `main.py`.
- Improves navigation, testability, and parallel work.

### 2. Consolidate config (medium impact)

- `api/config.py`: CORS, log level, etc.
- `src/database.py`, `src/auth_service.py`, etc.: `os.getenv(...)`.
- **Option:** Centralize in `api/config` (or a `src/config.py`) and inject where needed. Reduces scattered env reads and duplicates.

### 3. CLI / batch tools (low impact)

Root-level scripts: `query_pantry.py`, `assign_items_to_default_pantry.py`, `ai_batch_processor.py`, `ocr_batch_processor.py`, `recipe_generator.py`, `init_database.py`, `create_admin.py`, `reset_admin_password.py`.

- **Option A:** Move to `scripts/` (e.g. `scripts/query_pantry.py`) and run as `python -m scripts.query_pantry` or `./scripts/run-query-pantry.sh`.
- **Option B:** Add a `cli/` package and expose via `pyproject.toml` entry points (e.g. `pantry init-db`, `pantry create-admin`).

Keep `create_admin.py` and `reset_admin_password.py` easily discoverable (README, `scripts/create_admin_production.sh`).

### 4. Tests

- `tests/`: `test_ai_analyzer`, `test_image_processor`, `test_ocr_service`.
- Root `test_ai_setup.py`, `test_ocr_setup.py`, `test_preprocessor.py` are setup/preprocessor checks, not pytest suites.
- **Option:** Move to `scripts/verify-*-setup.py` or `tests/setup/` and document, so `pytest` stays for unit/integration tests only.

### 5. Cloud Run / deploy

- `cloud-run-service.yaml`: Optional template; current deploy uses `deploy-cloud-run.sh` + gcloud.
- **Option:** Either document `cloud-run-service.yaml` in `CLOUD_RUN_DEPLOYMENT.md` as an alternative config-based deploy, or remove if unused.

### 6. Dashboard

- `dashboard/`: Streamlit app. Consider noting in README that it’s optional and how to run it (already added).

---

## Quick reference

| Goal | Action |
|------|--------|
| Env template | Use `.env.example`; copy to `.env` or `.env.production`. |
| Run backend locally | `./start-backend-local.sh` or `./scripts/kill-and-restart-backend.sh`. |
| Deploy API | `./deploy-cloud-run.sh`; then `./sync-cloud-run-env.sh`. |
| Create prod admin | `./scripts/create_admin_production.sh` (Cloud SQL proxy + `DATABASE_URL`). |
| Smoke-test prod API | `./scripts/smoke-test-prod.sh`; optional `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD`. |
