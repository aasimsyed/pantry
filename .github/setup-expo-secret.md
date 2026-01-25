# Setting Up EXPO_TOKEN GitHub Secret

This guide will help you set up the `EXPO_TOKEN` secret for automated iOS builds via GitHub Actions.

## Step 1: Create Expo Access Token

1. **Go to Expo Access Tokens page:**
   - Visit: https://expo.dev/accounts/aasimsyed/settings/access-tokens
   - Or navigate: Expo Dashboard → Account Settings → Access Tokens

2. **Create a new token:**
   - Click "Create Token" or "New Token"
   - Give it a descriptive name (e.g., "GitHub Actions - Smart Pantry")
   - Select appropriate permissions (typically needs build and submit permissions)
   - Click "Create"

3. **Copy the token:**
   - ⚠️ **Important**: Copy the token immediately - you won't be able to see it again!
   - Save it somewhere safe temporarily

## Step 2: Add Token to GitHub Secrets

### Option A: Using GitHub CLI (Recommended - Automated)

If you have GitHub CLI installed and authenticated:

```bash
# Replace YOUR_EXPO_TOKEN with the token you just copied
gh secret set EXPO_TOKEN --body "YOUR_EXPO_TOKEN" --repo aasimsyed/pantry
```

### Option B: Using GitHub Web Interface (Manual)

1. **Go to GitHub repository secrets:**
   - Visit: https://github.com/aasimsyed/pantry/settings/secrets/actions
   - Or navigate: Repository → Settings → Secrets and variables → Actions

2. **Add new secret:**
   - Click "New repository secret"
   - Name: `EXPO_TOKEN`
   - Value: Paste your Expo access token
   - Click "Add secret"

## Step 3: Verify Setup

After setting the secret, the GitHub Actions workflow will automatically:
- Use the token to authenticate with Expo
- Build iOS apps on push to `main`/`master`
- Submit builds to TestFlight

## Testing

To test the setup:

```bash
# Push changes to mobile directory
cd /Users/aasimsyed/src/pantry
git add mobile/ .github/workflows/build-mobile-ios.yml
git commit -m "Add mobile CI/CD automation"
git push origin main
```

Then check the GitHub Actions tab:
- https://github.com/aasimsyed/pantry/actions

## Troubleshooting

### Token Invalid or Expired
- Create a new token from https://expo.dev/accounts/aasimsyed/settings/access-tokens
- Update the `EXPO_TOKEN` secret in GitHub

### Permission Denied
- Ensure the token has build and submit permissions
- Check token hasn't been revoked

### GitHub Actions Fails
- Check workflow logs in GitHub Actions tab
- Verify secret name is exactly `EXPO_TOKEN` (case-sensitive)

---

**Quick Links:**
- Create Token: https://expo.dev/accounts/aasimsyed/settings/access-tokens
- GitHub Secrets: https://github.com/aasimsyed/pantry/settings/secrets/actions
- GitHub Actions: https://github.com/aasimsyed/pantry/actions
