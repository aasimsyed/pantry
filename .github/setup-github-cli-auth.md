# Non-Interactive GitHub CLI Authentication

This guide shows how to authenticate GitHub CLI using a Personal Access Token (PAT) for non-interactive use.

## Step 1: Create GitHub Personal Access Token

1. **Go to GitHub Settings:**
   - Visit: https://github.com/settings/tokens
   - Or: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Create a new token:**
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a descriptive name: "GitHub CLI - Smart Pantry"
   - Set expiration (recommended: 90 days or custom)
   - Select scopes (minimum required):
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Action workflows)
   - Click "Generate token"

3. **Copy the token:**
   - ⚠️ **Important**: Copy it immediately - you won't see it again!
   - Save it somewhere safe

## Step 2: Authenticate GitHub CLI

Run this command (replace YOUR_GITHUB_TOKEN with your token):

```bash
echo "YOUR_GITHUB_TOKEN" | gh auth login --with-token
```

Or set it as an environment variable:

```bash
export GITHUB_TOKEN="YOUR_GITHUB_TOKEN"
gh auth login --with-token < <(echo "$GITHUB_TOKEN")
```

## Step 3: Verify Authentication

```bash
gh auth status
```

You should see:
```
✓ Logged in to github.com as aasimsyed (keyring)
```

## Alternative: Using gh auth login with token file

```bash
# Save token to a file (temporarily, then delete it)
echo "YOUR_GITHUB_TOKEN" > /tmp/github_token.txt
gh auth login --with-token < /tmp/github_token.txt
rm /tmp/github_token.txt
```

## Security Note

- Never commit tokens to git
- Delete temporary token files after use
- Use token with minimal required permissions
- Rotate tokens periodically
