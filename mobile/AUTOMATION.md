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

**Automated GitHub Actions workflow** that builds and submits on push to `main`/`master`:

**Trigger:**
- Automatically triggers on pushes to `main`/`master` branches when `mobile/` files change
- Can also be triggered manually via GitHub Actions UI

**Setup required:**

1. **Get Expo Token:**
   ```bash
   eas login
   eas whoami
   # Get your Expo token from: https://expo.dev/accounts/aasimsyed/settings/access-tokens
   ```

2. **Add GitHub Secret:**
   - Go to: `https://github.com/YOUR_USERNAME/pantry/settings/secrets/actions`
   - Add secret: `EXPO_TOKEN` with your Expo access token

3. **Push to trigger:**
   ```bash
   git add mobile/
   git commit -m "Update mobile app"
   git push origin main
   ```

**Features:**
- ✅ Fully automated (runs on push)
- ✅ No local setup needed
- ✅ Builds in cloud (GitHub Actions runners)
- ✅ Auto-submits to TestFlight
- ✅ Optional manual trigger with custom build number

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
- **Local script**: Runs `eas submit --platform ios --non-interactive --latest` after build
- **GitHub Actions**: Runs submit command after build completes
- **Configuration**: Uses `eas.json` submit settings (ASC App ID: 6755445323)

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

## Troubleshooting

### Build Number Already Submitted

If you get "You've already submitted this build", the build number is already in TestFlight. The auto-increment feature should prevent this, but if it happens:

1. Manually increment `app.json` → `expo.ios.buildNumber`
2. Or let EAS auto-increment on the next build

### GitHub Actions Fails

- Check that `EXPO_TOKEN` secret is set correctly
- Verify token has necessary permissions
- Check workflow logs in GitHub Actions

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
