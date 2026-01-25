# Production Readiness & Code Organization

Summary of tidy-ups and a roadmap for further improvements.

## Done

- **Env config:** Single `.env.example` for all env vars (auth, DB, AI, OCR). Copy to `.env` / `.env.production`.
- **Config centralization:** `src/config.py` holds app-wide settings (DB, auth, API, Sentry, AI, OCR). `api/config` re-exports. Database, auth, AI, OCR use centralized config.
- **Routers:** `api/main.py` split into `api/routers/` (health, auth, products, inventory, pantries, statistics, config, recipes, user, admin). Recipe generation (generate-one, generate, generate-stream) remains in main; Recipe Box (save, saved) in `recipes` router. Shared helpers in `api/utils.py`.
- **CLI in scripts/:** `query_pantry.py`, `init_database.py`, `create_admin.py`, `reset_admin_password.py` moved to `scripts/`. Run as `python scripts/query_pantry.py`, `python scripts/init_database.py`, etc. `scripts/create_admin_production.sh` uses `scripts/create_admin.py`.
- **Scripts:** `create_admin_production.sh`, `setup-secret-manager.sh`, `kill-and-restart-backend.sh`, `smoke-test-prod.sh`, `run-migrations-cloudsql.sh`, `start-db-local.sh`, `view-prod-logs.sh` in `scripts/`. Verify: `scripts/verify-ai-setup.py`, `scripts/verify-ocr-setup.py`, `scripts/verify-preprocessor-setup.py`.
- **Removed:** `SECURITY_ENV_EXAMPLE.txt`, `assign_items_to_default_pantry.py`, root `test_*_setup.py` (→ `scripts/verify-*`), root `query_pantry.py`, `init_database.py`, `create_admin.py`, `reset_admin_password.py` (→ `scripts/`).
- **README:** Project structure, script table, config references. `tests/` reserved for pytest.

## Recommended Next Steps

- **Optional:** Add `cli/` package with `pyproject.toml` entry points (`pantry init-db`, `pantry create-admin`) for CLI tools. Lower priority; `scripts/*.py` suffice.
- **Tests:** `tests/` for pytest; `scripts/verify-*-setup.py` for AI/OCR/preprocessor.
- **Deploy:** `deploy-cloud-run.sh`, `cloud-run-service.yaml` (see CLOUD_RUN_DEPLOYMENT.md).
- **Dashboard:** `streamlit run dashboard/app.py`. Optional.

## Quick reference

| Goal | Action |
|------|--------|
| Env template | `.env.example` → `.env` or `.env.production`. |
| Run backend locally | `./start-backend-local.sh` or `./scripts/kill-and-restart-backend.sh`. |
| Deploy API | `./deploy-cloud-run.sh`; then `./sync-cloud-run-env.sh`. |
| Create prod admin | `./scripts/create_admin_production.sh` (Cloud SQL proxy + `DATABASE_URL`). |
| Smoke-test prod API | `./scripts/smoke-test-prod.sh`. |
| Verify AI / OCR / preprocessor | `python scripts/verify-ai-setup.py`, `scripts/verify-ocr-setup.py`, `scripts/verify-preprocessor-setup.py`. |
