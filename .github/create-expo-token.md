# How to Create an Expo Access Token

This guide shows you how to create an Expo access token for GitHub Actions CI/CD.

## Step-by-Step Instructions

### Step 1: Go to Expo Access Tokens Page

**Direct Link:**
👉 **https://expo.dev/accounts/aasimsyed/settings/access-tokens**

**Or navigate:**
1. Go to https://expo.dev
2. Sign in with your account (`aasimsyed`)
3. Click on your profile/account icon (top right)
4. Go to **Account Settings** or **Settings**
5. Navigate to **Access Tokens** section

### Step 2: Create a New Token

1. **Click "Create Token" or "New Token" button**
   - Look for a button that says "Create Token" or "New Token"
   - Usually found at the top or bottom of the tokens list

2. **Configure the Token:**
   - **Name**: Give it a descriptive name
     - Example: `GitHub Actions - Smart Pantry`
     - Example: `CI/CD - Mobile Builds`
   - **Description** (optional): Add what it's for
     - Example: `For automated iOS builds via GitHub Actions`

3. **Select Permissions/Scopes:**
   - ✅ **Build** - Required for building apps
   - ✅ **Submit** - Required for submitting to app stores
   - ✅ **Project** - Access to project settings
   - (Select all that apply - you need build and submit at minimum)

4. **Set Expiration** (optional):
   - **No expiration** (recommended for CI/CD)
   - **Or set a custom expiration** (e.g., 1 year)

5. **Click "Create" or "Generate Token"**

### Step 3: Copy the Token Immediately

⚠️ **IMPORTANT**: Copy the token right away!
- The token will be displayed only once
- You won't be able to see it again after closing the page
- Save it somewhere safe temporarily (password manager, notes, etc.)

The token will look something like:
```
exp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
or
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 4: Add Token to GitHub Secrets

Once you have the token, run:

```bash
gh secret set EXPO_TOKEN --body "YOUR_EXPO_TOKEN_HERE" --repo aasimsyed/pantry
```

Replace `YOUR_EXPO_TOKEN_HERE` with the token you just copied.

---

## Alternative: Using Expo Dashboard

If you can't find the Access Tokens page:

1. **Go to Expo Dashboard:** https://expo.dev
2. **Click your profile** (top right)
3. **Settings** → **Access Tokens**
4. Follow the steps above

---

## Verify Token Works

After setting the token in GitHub, test it by:

1. Push a change to `main`/`master` branch in the `mobile/` directory
2. Check GitHub Actions: https://github.com/aasimsyed/pantry/actions
3. The workflow should authenticate and build successfully

---

## Troubleshooting

### Can't find Access Tokens page?
- Make sure you're logged into the correct Expo account (`aasimsyed`)
- Try the direct link: https://expo.dev/accounts/aasimsyed/settings/access-tokens

### Token not working?
- Verify the token has the correct permissions (build, submit)
- Check the token hasn't expired
- Ensure you copied the entire token (no spaces)

### Need to revoke a token?
- Go back to the Access Tokens page
- Find the token in the list
- Click "Revoke" or delete it

---

**Quick Links:**
- Create Token: https://expo.dev/accounts/aasimsyed/settings/access-tokens
- Expo Dashboard: https://expo.dev
- GitHub Secrets: https://github.com/aasimsyed/pantry/settings/secrets/actions
