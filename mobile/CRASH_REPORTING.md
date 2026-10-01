# Crash reporting (Sentry) — free tier

Crash reporting is wired with **Sentry**. The free tier gives **5,000 events per month** at no cost (no credit card required for the free plan).

## 1. Create a Sentry account and project

1. Sign up at [sentry.io/signup](https://sentry.io/signup).
2. Create a new project:
   - **Platform**: React Native.
   - Note your **organization slug** (e.g. in **Organization settings**) and **project slug** (e.g. in **Project settings**).
3. Get your **DSN**:
   - **Settings → Projects → [your project] → Client Keys (DSN)**.
   - Copy the DSN (e.g. `https://xxx@xxx.ingest.sentry.io/xxx`).

## 2. Enable crash reporting in the app

Set the DSN so the app can send events:

- **Local / dev**: Use the repo root `.env` or `mobile/.env` with:
  ```bash
  EXPO_PUBLIC_SENTRY_DSN=https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID
  ```
- **GitHub Actions (TestFlight, no EAS)**: Add a **GitHub repository secret** so the iOS build gets the DSN at bundle time:
  1. Repo → **Settings → Secrets and variables → Actions**.
  2. **New repository secret** → name: `EXPO_PUBLIC_SENTRY_DSN`, value: your DSN.
  The workflow `.github/workflows/build-mobile-ios.yml` passes this into the build step.

If `EXPO_PUBLIC_SENTRY_DSN` is not set, the app runs as before; Sentry is simply not initialized.

## 3. Optional: readable stack traces (source maps)

**Without this:** You still get crash reports, but the stack trace may look like `at a.b (index.bundle:1:4523)` — hard to see which file/line caused it.

**With this:** Sentry shows your real source, e.g. `BarcodeScannerScreen.tsx line 42`. Optional but very helpful for debugging.

**Steps (only if you want readable traces):**

1. **Sentry:** [Settings → Auth Tokens](https://sentry.io/settings/account/api/auth-tokens/) → **Create New Token** → name it (e.g. "GitHub iOS builds"), scope: **project:releases** and **org:read** → Create. Copy the token.
2. **GitHub:** Repo → **Settings → Secrets and variables → Actions** → **New repository secret** → name: `SENTRY_AUTH_TOKEN`, value: the token you copied. (The iOS workflow already passes this into the build.)
3. **EAS / Expo cloud builds (`eas build`):** Add the same token so uploads work on EAS builders:

   ```bash
   cd mobile
   eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value YOUR_TOKEN_HERE --type string
   ```

   Or in [expo.dev](https://expo.dev): your project → **Secrets** → add `SENTRY_AUTH_TOKEN` (sensitive).

   If you do **not** set this, `mobile/eas.json` sets `SENTRY_ALLOW_FAILURE=true` for **production** and **preview** so the iOS build still completes (you keep crash reporting via DSN, but source map upload may be skipped until the secret exists).

4. **app.json:** In `mobile/app.json`, in the `@sentry/react-native/expo` plugin, replace:
   - `YOUR_SENTRY_ORG_SLUG` with your Sentry **organization slug** (e.g. in the URL: `sentry.io/organizations/<this-part>/`).
   - `YOUR_SENTRY_PROJECT_SLUG` with your Sentry **project slug** (e.g. in the URL: `.../projects/<this-part>/`).

Then the next iOS build will upload source maps to Sentry and future crashes will show symbolicated stack traces. You can skip this entirely if you’re fine with unsymbolicated crashes for now.

To **disable** source map upload on EAS entirely (no `sentry-cli` auth), set `SENTRY_DISABLE_AUTO_UPLOAD=true` in the same build profile `env` in `eas.json` instead of relying on allow-failure.

## 4. Verify

1. Set `EXPO_PUBLIC_SENTRY_DSN` and build/run the app.
2. In the app, trigger a test error (e.g. a button that calls `throw new Error('Test Sentry');` or use Sentry’s test button in **Project settings → Client Keys**).
3. In Sentry **Issues**, you should see the event within a few seconds.

## Summary

| What                | Where / how |
|---------------------|-------------|
| Free tier           | 5,000 events/month at [sentry.io](https://sentry.io) |
| Enable reporting    | Set `EXPO_PUBLIC_SENTRY_DSN` in `.env` (local) or **GitHub Actions** repo secret (TestFlight) |
| Readable stack traces | Set `SENTRY_AUTH_TOKEN` (GitHub secret **and** EAS project secret for `eas build`) and org/project in `app.json` plugin |
| View crashes        | [sentry.io](https://sentry.io) → your project → **Issues** |
