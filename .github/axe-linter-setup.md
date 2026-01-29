# axe DevTools Linter setup

Runs **axe DevTools Linter** (Deque) on PRs that touch `mobile/**` and posts accessibility findings as PR comments.

## One-time setup

1. **Add the API key as a GitHub secret** (do not commit the key):
   - Repo → **Settings** → **Secrets and variables** → **Actions**
   - **New repository secret**
   - Name: `AXE_LINTER_API_KEY`
   - Value: your axe Linter API key (trial or subscription)

2. The workflow will then run on pull requests that change `mobile/**` and comment with a11y issues.

Config: `axe-linter.yml` at repo root with `global-libraries: react-native`.
