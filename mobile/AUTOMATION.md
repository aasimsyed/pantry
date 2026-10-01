# Mobile App Build and Deployment Automation

This guide explains the automated build and deployment options for the Smart Pantry iOS app.

## Automation Options

### Option 1: Local Automated Script (Recommended for Quick Deployments)

**Fully automated local script** that builds and submits to TestFlight without any prompts:

```bash
cd mobile
./build-and-deploy-ios.sh --auto
```

**Features:**
- ✅ Non-interactive (fully automated)
- ✅ Auto-increments build number (configured in `eas.json`)
- ✅ Builds iOS app with production profile
- ✅ Automatically submits to TestFlight
- ✅ Uses Cloud Run API URL (`https://pantry-api-154407938924.us-south1.run.app`)

**What it does:**
1. Checks for EAS CLI (uses global or npx)
2. Builds the iOS app with production profile
3. Automatically submits the latest build to TestFlight
4. No prompts or manual intervention needed

---

### Option 2: GitHub Actions CI/CD (Recommended for Automated Deployments)

**Workflow:** `.github/workflows/build-mobile-ios.yml`

A push to `main` or `master` that changes `mobile/**` (or the workflow file) builds the app with Xcode on a GitHub macOS runner and uploads the IPA to TestFlight with `altool`. No EAS and no `EXPO_TOKEN`.

**Trigger:**
- Push to `main` or `master` when files under `mobile/` change
- Manual run: GitHub → Actions → **Build and Deploy iOS App** → **Run workflow** (optional custom build number)

**Secrets** (repo → Settings → Secrets and variables → Actions). Setup steps: `.github/ios-code-signing-secrets.md`.

| Secret | Purpose |
|--------|---------|
| `APPLE_ID` | Apple ID email for the `altool` upload |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) |
| `BUILD_CERTIFICATE_BASE64` | Apple Distribution `.p12`, base64-encoded |
| `P12_PASSWORD` | Password for that `.p12` |
| `BUILD_PROVISION_PROFILE_BASE64` | App Store provisioning profile, base64-encoded |
| `KEYCHAIN_PASSWORD` | Password for the temporary keychain on the runner |

Optional: `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.

**Push to trigger:**

```bash
git add mobile/
git commit -m "Update mobile app"
git push origin main
```

Do not put `[skip ci]` in the commit message. That phrase skips the iOS workflow.

**What happens:**
1. The local pre-push hook bumps `mobile/app.json` (`buildNumber` and `versionCode`) and amends the commit.
2. The runner imports the certificate and profile, then runs `mobile/build-ios.sh` (prebuild, archive, export, upload).
3. **Auto-Increment Build Numbers** bumps `app.json` again and commits with `[skip ci]`, so it does not start a second build. Run `git pull` afterwards so local matches remote.

Watch the run under Actions. A green run means Apple accepted the upload. The build shows in TestFlight in about 10-30 minutes: https://appstoreconnect.apple.com/apps/6755445323/testflight/ios

**Features:**
- Fully automated on push
- Builds on GitHub macOS runners with your signing secrets
- Uploads to TestFlight with `altool`
- Manual trigger with a custom build number

---

### Option 3: Interactive Script (For Manual Control)

**Semi-interactive script** that asks for confirmation before submitting:

```bash
cd mobile
./build-and-deploy-ios.sh
```

**Features:**
- ✅ Interactive prompts for confirmation
- ✅ Gives you control over submission
- ✅ Good for testing before deployment

---

## Configuration Details

### Auto-Increment Build Number

Configured in `eas.json`:
```json
"production": {
  "autoIncrement": "buildNumber",
  "ios": {
    "autoIncrement": true
  }
}
```

This automatically increments the build number each time you build, so you never have to manually update `app.json`.

### TestFlight Submission

Automatic submission is handled by:
- **Local script** (`build-and-deploy-ios.sh`): Runs `eas submit --platform ios --non-interactive --latest` after the EAS build
- **GitHub Actions** (`.github/workflows/build-mobile-ios.yml`): `mobile/build-ios.sh` uploads the IPA with `altool` using `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD`
- **App Store Connect app**: ASC App ID 6755445323

---

## Quick Reference

### Manual Build and Submit

```bash
cd mobile

# Build only
eas build --platform ios --profile production --non-interactive

# Submit separately (after build completes)
eas submit --platform ios --non-interactive --latest
```

### View Build Status

```bash
# List recent builds
eas build:list --platform ios --limit 5

# View specific build
eas build:view BUILD_ID
```

### View Submissions

```bash
# List recent submissions
eas submit:list --platform ios --limit 5
```

---

## Submit to Google Play Store

### Prerequisites

1. **Google Play Console** – [Create a developer account](https://play.google.com/console/signup) (one-time fee).
2. **Create the app** in Play Console (if not already): create app → fill store listing, content rating, etc.
3. **First upload** – Google requires the **first** version of a new app to be uploaded manually (Play Console → Your app → Production or Testing → Create new release → Upload AAB). After that you can use EAS Submit.
4. **Service account (optional, for non-interactive submit)** – Play Console → **Setup** → **API access** → Link to Google Cloud → Create service account → Create key (JSON). Grant the service account access in Play Console (e.g. “Release to production” or “Release apps to testing”). Save the JSON key somewhere safe (e.g. `mobile/play-store-service-account.json` and add to `.gitignore`).

### Build for Play Store

Production builds use **Android App Bundle (AAB)** (already set in `eas.json`):

```bash
cd mobile
eas build --platform android --profile production --non-interactive
```

Wait for the build to finish on [expo.dev](https://expo.dev).

### Submit to Play Store

**Interactive (first time or one-off):**

```bash
cd mobile
eas submit --platform android --latest
```

EAS will prompt you to log in to Google (or use a service account). Choose the build, then pick the **track** (internal testing, closed testing, open testing, or production).

**Non-interactive (e.g. CI or script):**  
Add to `eas.json` under `submit` → `production` (or a new profile):

```json
"submit": {
  "production": {
    "ios": { "ascAppId": "...", "appleTeamId": "..." },
    "android": {
      "track": "internal",
      "serviceAccountKeyPath": "./play-store-service-account.json"
    }
  }
}
```

Then:

```bash
eas submit --platform android --profile production --non-interactive --latest
```

**NPM script:**

```bash
npm run submit:android
# (runs: eas submit --platform android)
```

### After submitting

- **Internal / closed testing** – Add testers in Play Console; they get a link to opt in.
- **Production** – Review can take a few hours to several days. Check **Publishing overview** in Play Console.

---

## Troubleshooting

### Build Number Already Submitted

If you get "You've already submitted this build", the build number is already in TestFlight. The auto-increment feature should prevent this, but if it happens:

1. Manually increment `app.json` → `expo.ios.buildNumber`
2. Or let EAS auto-increment on the next build

### GitHub Actions Fails

- Open the failed run under Actions and read the **Build and upload to TestFlight** step
- Signing errors (exit 65): the distribution certificate or App Store profile expired. Re-export both and update `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, and `BUILD_PROVISION_PROFILE_BASE64`. See `.github/ios-code-signing-secrets.md`
- Upload error `Sign in with the app-specific password`: `APPLE_APP_SPECIFIC_PASSWORD` is stale. Create a new one at [appleid.apple.com](https://appleid.apple.com) and update the secret
- "You've already submitted this build": pull latest `main` first. The pre-push hook and the auto-increment workflow both bump `buildNumber`

### Submission Fails

- Ensure build completed successfully first
- Check that App Store Connect API key is configured
- Verify ASC App ID matches your app

---

## Environment Variables

The production build automatically uses:
- `EXPO_PUBLIC_API_URL`: `https://pantry-api-154407938924.us-south1.run.app`

This is configured in `eas.json` under the production profile.

---

## Next Steps After Submission

1. **Wait for processing**: Apple processes builds in 5-10 minutes
2. **Check email**: You'll receive a notification when ready
3. **Add testers**: Add internal/external testers in TestFlight
4. **Monitor**: View status in App Store Connect

TestFlight Dashboard: https://appstoreconnect.apple.com/apps/6755445323/testflight/ios
