# iOS code signing secrets for GitHub Actions

The **Build and Deploy iOS App** workflow needs these secrets so `xcodebuild archive` can sign the app on the runner. Without them you get **exit code 65**.

**Team:** Aasim S Syed (Team ID: K5A25879TB)

## Required secrets

| Secret | Description |
|--------|-------------|
| `APPLE_ID` | Your Apple ID email (for TestFlight upload) |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords |
| `BUILD_CERTIFICATE_BASE64` | Your **Apple Distribution** (.p12) certificate, base64-encoded |
| `P12_PASSWORD` | Password you set when exporting the .p12 |
| `BUILD_PROVISION_PROFILE_BASE64` | **App Store** provisioning profile for this app, base64-encoded |
| `KEYCHAIN_PASSWORD` | Any string (e.g. `secret`) — used for a temporary keychain on the runner |

## 1. Export the distribution certificate (.p12)

1. On your Mac, open **Keychain Access**.
2. Find your **Apple Distribution** certificate (under “My Certificates”). If you don’t have one, create it in [App Store Connect](https://appstoreconnect.apple.com) → Users and Access → Keys, or in Xcode → Signing & Capabilities.
3. Right-click the certificate → **Export** → save as `.p12` and set a password (remember it for `P12_PASSWORD`).
4. Base64-encode for the secret:
   ```bash
   base64 -i YourCertificate.p12 | pbcopy
   ```
   Paste the result into GitHub **Settings → Secrets and variables → Actions** as `BUILD_CERTIFICATE_BASE64`.

## 2. Get the App Store provisioning profile

1. In [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Profiles**.
2. Create or download the **App Store** provisioning profile for **com.aasimsyed.smartpantry** (must match your app’s bundle ID and the distribution cert).
3. Base64-encode it:
   ```bash
   base64 -i YourProfile.mobileprovision | pbcopy
   ```
   Paste into GitHub as `BUILD_PROVISION_PROFILE_BASE64`.

## 3. Add the rest

- `P12_PASSWORD`: the password you used when exporting the .p12.
- `KEYCHAIN_PASSWORD`: any string (e.g. `secret`).
- `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD`: as in the table above (for `altool` upload to TestFlight).

## Reference

- [GitHub: Sign Xcode applications](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
