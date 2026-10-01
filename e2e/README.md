# E2E Tests (Appium + WebdriverIO)

End-to-end tests for the Smart Pantry mobile app. See [.scratch/E2E_APPIUM_TESTING_PLAN.md](../.scratch/E2E_APPIUM_TESTING_PLAN.md) for the full phased plan.

## Prerequisites

- **Node.js** 20+ (required for Appium 3.x)
- **Appium 3.x** and WebdriverIO (install: `cd e2e && npm install`)
- **Appium drivers** (install once after `npm install`):
  ```bash
  npx appium driver install xcuitest       # iOS
  npx appium driver install uiautomator2   # Android
  ```
  (Drivers require Appium 3.x; the e2e package uses Appium ^3.0.0.)
- **iOS:** Xcode, iOS Simulator (e.g. iPhone 16)
- **Android:** Android SDK, emulator (e.g. `emulator-5554`)

### Android Studio & emulator

1. **Create/start an emulator**  
   Open Android Studio → **More Actions** → **Virtual Device Manager** (or **Tools** → **Device Manager**).  
   Create a device (e.g. Pixel 6, API 34) if needed, then click **Run** (▶) to start it.

2. **Run the app (no need to open the repo in Android Studio)**  
   From the repo:
   ```bash
   cd mobile && npx expo run:android
   ```
   Expo will prebuild the `android/` folder if needed, build the app, and install it on the running emulator.

3. **Optional: open the Android project in Android Studio**  
   After `npx expo run:android` has run once, you can open **`mobile/android`** in Android Studio (**File** → **Open** → select that folder) to view logs, edit native code, or run the app from the IDE.

## Build and run the app

1. Build and run the app on a simulator/emulator so the app is installed:

   **iOS:**
   ```bash
   cd mobile && npx expo run:ios
   ```
   (Pick a simulator when prompted; wait until the app is open.)

   **Android:**
   ```bash
   cd mobile && npx expo run:android
   ```
   (Start an emulator first or use a connected device.)

2. Optionally close the app so the E2E run starts from a cold launch; or leave it open—Appium will attach or relaunch by `bundleId` / `appPackage`.

## Run E2E tests

**Recommended (iOS):** Use the run script so the app is installed if needed and you can choose device vs simulator:

```bash
cd e2e
npm install
npm run e2e:ios
```

- **Device vs simulator:** If both a physical device and a simulator are available, you’ll be prompted: `Run on [D]evice or [S]imulator? (d/s)`.
- **Force device:** `npm run e2e:ios:device` — uses the first connected physical device; builds and installs the app if needed.
- **Force simulator:** `npm run e2e:ios:simulator` — uses the booted simulator (or boots one); builds and installs if needed.
- **App already installed:** `npm run e2e:ios:skip-build` — skips the build/install step and runs tests against the current simulator/device.
- **Accessibility-only run:** `npm run e2e:ios -- --a11y` — runs only the a11y suite (no register/delete).
- **Default run:** Full E2E (register new user → login → feature + a11y → delete user). Set **E2E_API_URL** (or **EXPO_PUBLIC_API_URL**) to the same backend the app uses (e.g. `http://localhost:8000`). See `.env.example`.

**Manual run (no script):**

```bash
cd e2e
npm install
# Build/install app first: cd ../mobile && npx expo run:ios [--device]
npm run e2e:smoke   # smoke only (launch, Login or Home)
npm run e2e:full    # full flow: register → login → feature + a11y → delete (requires E2E_API_URL)
npm run e2e:a11y    # a11y suite only
```

- **Default platform:** iOS. To use Android: `PLATFORM=Android npm run e2e:smoke`.
- **Full suite:** `npm run e2e` (runs all specs under `specs/`).

### Port 4723 already in use

`npm run e2e:full` (and the WDIO Appium service) starts Appium on port **4723**. If you see “Could not start REST http interface listener… port may already be in use”, something is already bound to 4723—usually a leftover Appium from a previous run or from `run-e2e-ios.sh`.

**Kill and reset:**

```bash
cd e2e
./scripts/kill-appium-port.sh
npm run e2e:full
```

Or kill by hand: `lsof -ti:4723 | xargs kill` (or `kill -9` if it doesn’t exit).

## Selectors

Tests use **accessibility id** (React Native `testID`). Examples: `~login-title`, `~home-title`, `~tab-inventory`. See the plan doc for a list of existing testIDs.

## Accessibility audit (free, no license)

Standards-based a11y audits **without a paid license**:

- **iOS (Xcode 15 / iOS 17+):** Uses Apple’s native **performAccessibilityAudit** via Appium’s XCUITest driver (`mobile: performAccessibilityAudit`). Checks contrast, hit regions, sufficient element descriptions, Dynamic Type, text clipping, and traits. No API key or Deque license required. The a11y suite **launches the app with larger Dynamic Type** (Accessibility L) so that 1.4.4 Resize Text and 1.4.10 Reflow are tested; if the layout doesn’t scale, text clips and the audit fails. Close the app before running so the session launches it with this setting.
- **Android:** The a11y spec currently asserts that Login or Home is visible; you can extend it with manual checks (e.g. interactive elements have `content-desc` / `accessibilityLabel`). A full free audit engine for Android in Appium can be added later.

**Xcode Accessibility Inspector:** The suite does **not** use the Accessibility Inspector app (the GUI in Xcode → Developer Tools → Accessibility Inspector). It uses the **programmatic** `performAccessibilityAudit()` API (same audit logic, invoked by XCTest/Appium during E2E). The Inspector is a separate manual tool you can use for spot-checks or debugging; the report’s remediation section suggests it for contrast checks.

### Full WCAG 2.1 Level AA certifiable suite (fully automated)

The suite is **100% automated**. Run the a11y E2E tests; certification is based on automated results only (no manual checklist).

- **Automated criteria:** Contrast (1.4.3, 1.4.11), Resize Text (1.4.4), Reflow (1.4.10), Page Titled (2.4.2), Link Purpose (2.4.4), Headings and Labels (2.4.6), Label in Name (2.5.3), Error Identification (3.3.1), Labels or Instructions (3.3.2), Name Role Value (4.1.2). Tested via Apple `performAccessibilityAudit` + E2E (2.4.2, 3.3.1).
- **N/A criteria:** All other A/AA criteria are reported as N/A (not automatable). See [WCAG_2.1_AA_MAPPING.md](docs/WCAG_2.1_AA_MAPPING.md).
- The generated **a11y-report.md** includes a “WCAG 2.1 Level A/AA – All criteria” table with Pass / Fail / N/A per criterion.

### Prerequisites

- **App and Appium** – Build/install the app and have Appium running on 4723 (e.g. run `./scripts/run-e2e-ios.sh --simulator` once, or start Appium manually and use `--skip-build`).
- **iOS 17+** – For the native audit on iOS, use a simulator or device on iOS 17 or later.

### Run the a11y audit

```bash
cd e2e
npm run e2e:a11y
```

Or with build/install: `npm run e2e:ios:simulator -- --a11y`.

Tests run in **high-to-low priority** order: (1) first screen (Login or Home), (2) Login, (3) Register, (4) login flow, (5) Home, (6) Inventory, (7) Recipes, (8) Recipe Box, (9) Statistics, (10) Pantry Selector modal, (11) Settings, (12) Recipe Detail (when Recipe Box has items). The suite writes **a11y-report.json** and **a11y-report.md** in the `e2e` folder. The report includes pass/fail by screen and a **WCAG 2.1 Level A/AA – All criteria** table (Pass / Fail / N/A). Certification is based on automated results only.

### Optional: Deque axe DevTools (paid)

For WCAG-focused audits and dashboard uploads, you can use [Deque axe DevTools Mobile](https://docs.deque.com/devtools-mobile/) with an API key: install the axe driver (`npm run install:axe-driver`), set `AXE_DEVTOOLS_API_KEY`, and use a separate config that sets `automationName` to `AxeXCUITest` (iOS) or `AxeUiAutomator2` (Android).

---

## Env vars

| Variable | Description |
|----------|-------------|
| `PLATFORM` | `iOS` (default) or `Android` |
| `E2E_EMAIL` | (Optional) Email for a11y login; with `E2E_PASSWORD` audits authenticated screens. |
| `E2E_PASSWORD` | (Optional) Password for a11y login. |
| `APP_PATH_IOS` | Path to `.app` bundle (optional; if set, Appium installs it) |
| `APP_PATH_ANDROID` | Path to `.apk` (optional) |
| `IOS_DEVICE_NAME` | e.g. `iPhone 16` |
| `IOS_PLATFORM_VERSION` | e.g. `18.0` |
| `ANDROID_DEVICE_NAME` | e.g. `emulator-5554` |
| `ANDROID_APP_ACTIVITY` | Main activity if different from `.MainActivity` |

## Logs

Appium server logs are written to `e2e/e2e-logs/` (created on first run).

---

## Troubleshooting: Appium won't start (unicorn-magic / Node 25)

On **Node 25**, Appium 3 can fail to start with:
`ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined in .../unicorn-magic/package.json`

**Workaround:** run Appium manually with **Node 20**, then run the tests with Appium already running:

1. **Terminal 1** – start Appium with Node 20:
   ```bash
   cd e2e
   nvm use 20   # or: nvm install 20 && nvm use 20
   npx appium
   ```
   Leave this running.

2. **Terminal 2** – run the smoke test (no need to start Appium again):
   ```bash
   cd e2e
   RUN_APPIUM_EXTERNAL=1 npm run e2e:smoke
   ```

Alternatively, use Node 20 for the whole e2e run: `nvm use 20 && npm run e2e:smoke` (if that works on your machine).
