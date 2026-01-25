# Production Readiness & Code Organization

Summary of tidy-ups and a roadmap for further improvements.

## Done

- **Env config:** Single `.env.example` for all env vars (auth, DB, AI, OCR). Copy to `.env` / `.env.production`.
- **Scripts:** `create_admin_production.sh`, `setup-secret-manager.sh`, `kill-and-restart-backend.sh`, `smoke-test-prod.sh`, `run-migrations-cloudsql.sh`, `start-db-local.sh` in `scripts/`. Verify scripts: `scripts/verify-ai-setup.py`, `scripts/verify-ocr-setup.py`, `scripts/verify-preprocessor-setup.py`.
- **Removed:** `SECURITY_ENV_EXAMPLE.txt` (redundant), `assign_items_to_default_pantry.py` (redundant with migration `assign_null_items_to_default_pantry`), root `test_ai_setup.py` / `test_ocr_setup.py` / `test_preprocessor.py` (moved to `scripts/verify-*`).
- **README:** Project structure, script table, config references. `tests/` reserved for pytest.
- **Fix DB scripts:** `fix_database_*` remain gitignored; remove from disk if no longer needed.

## Recommended Next Steps

### 1. Split `api/main.py` into routers (high impact)

`api/main.py` is ~2.9k lines. Split by domain:

```
api/
├── main.py          # App factory, CORS, middleware, include_routers
├── routers/
│   ├── __init__.py
│   ├── health.py    # /, /health
│   ├── auth.py      # /api/auth/*
│   ├── products.py  # /api/products*
│   ├── inventory.py # /api/inventory*, process-image, refresh, expiring, expired
│   ├── pantries.py  # /api/pantries*
│   ├── recipes.py   # /api/recipes*
│   ├── user.py      # /api/user/settings
│   └── admin.py     # /api/admin/*
├── config.py
├── dependencies.py
└── models.py
```

### 2. Consolidate config (medium impact)

- Centralize `os.getenv` usage in `api/config` (or `src/config.py`). Reduces scattered env reads.

### 3. CLI / batch tools (low impact)

Root-level: `query_pantry.py`, `init_database.py`, `create_admin.py`, `reset_admin_password.py`, `ai_batch_processor.py`, `ocr_batch_processor.py`, `recipe_generator.py`.

- **Option A:** Move to `scripts/` and run as `python -m scripts.query_pantry` or `./scripts/run-query-pantry.sh`.
- **Option B:** Add `cli/` package with `pyproject.toml` entry points (`pantry init-db`, `pantry create-admin`).

Keep `create_admin.py` and `reset_admin_password.py` discoverable (README, `scripts/create_admin_production.sh`).

### 4. Tests

- `tests/`: pytest for `test_ai_analyzer`, `test_image_processor`, `test_ocr_service`.
- Setup verification: `scripts/verify-ai-setup.py`, `scripts/verify-ocr-setup.py`, `scripts/verify-preprocessor-setup.py`.

### 5. Cloud Run / deploy

- `deploy-cloud-run.sh` + gcloud for deploy. `cloud-run-service.yaml` is an optional template for `gcloud run services update ... --config cloud-run-service.yaml` (see CLOUD_RUN_DEPLOYMENT.md).
- Document or remove `cloud-run-service.yaml` if unused.

### 6. Dashboard

- `dashboard/`: Streamlit app. Optional; run with `streamlit run dashboard/app.py`. Noted in README.

## Quick reference

| Goal | Action |
|------|--------|
| Env template | `.env.example` → `.env` or `.env.production`. |
| Run backend locally | `./start-backend-local.sh` or `./scripts/kill-and-restart-backend.sh`. |
| Deploy API | `./deploy-cloud-run.sh`; then `./sync-cloud-run-env.sh`. |
| Create prod admin | `./scripts/create_admin_production.sh` (Cloud SQL proxy + `DATABASE_URL`). |
| Smoke-test prod API | `./scripts/smoke-test-prod.sh`. |
| Verify AI / OCR / preprocessor | `python scripts/verify-ai-setup.py`, `scripts/verify-ocr-setup.py`, `scripts/verify-preprocessor-setup.py`. |
