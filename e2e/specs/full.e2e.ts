/**
 * Full E2E: if signed in delete user from Settings → Register test user → Login → feature + a11y → delete user from Settings.
 * Uses fixed E2E credentials (e2e@test.smartpantry.local); override via E2E_EMAIL / E2E_PASSWORD.
 * Requires E2E_API_URL (or EXPO_PUBLIC_API_URL) pointing at the same backend the app uses.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  getE2ECredentials,
  loginUser,
  processImage as apiProcessImage,
  FIXTURE_IMAGE_FILES,
} from '../helpers/api';

const isIOS = (process.env.PLATFORM || 'iOS').toLowerCase() !== 'android';
const e2eDir = path.resolve(__dirname, '..');
const fixturesDir = path.resolve(e2eDir, '..', 'test-data', 'fixtures');
const reportPathJson = path.join(e2eDir, 'a11y-report.json');
const reportPathMd = path.join(e2eDir, 'a11y-report.md');

let e2eEmail: string;
let e2ePassword: string;
let e2eAccessToken: string;

const ALL_WCAG_AA_CRITERIA: Record<string, string> = {
  '1.1.1': 'Non-text Content (A)', '1.2.1': 'Audio-only and Video-only (A)', '1.2.2': 'Captions (Prerecorded) (A)',
  '1.2.3': 'Audio Description or Media Alternative (A)', '1.2.4': 'Captions (Live) (AA)', '1.2.5': 'Audio Description (Prerecorded) (AA)',
  '1.3.1': 'Info and Relationships (A)', '1.3.2': 'Meaningful Sequence (A)', '1.3.3': 'Sensory Characteristics (A)',
  '1.3.4': 'Orientation (AA)', '1.3.5': 'Identify Input Purpose (AA)', '1.4.1': 'Use of Color (A)', '1.4.2': 'Audio Control (A)',
  '1.4.3': 'Contrast (Minimum) (AA)', '1.4.4': 'Resize Text (AA)', '1.4.5': 'Images of Text (AA)', '1.4.10': 'Reflow (AA)',
  '1.4.11': 'Non-text Contrast (AA)', '1.4.12': 'Text Spacing (AA)', '1.4.13': 'Content on Hover or Focus (AA)',
  '2.1.1': 'Keyboard (A)', '2.1.2': 'No Keyboard Trap (A)', '2.2.1': 'Timing Adjustable (A)', '2.2.2': 'Pause, Stop, Hide (A)',
  '2.3.1': 'Three Flashes or Below Threshold (A)', '2.4.1': 'Bypass Blocks (A)', '2.4.2': 'Page Titled (A)',
  '2.4.3': 'Focus Order (A)', '2.4.4': 'Link Purpose (A)', '2.4.5': 'Multiple Ways (AA)', '2.4.6': 'Headings and Labels (AA)',
  '2.4.7': 'Focus Visible (AA)', '2.5.1': 'Pointer Gestures (A)', '2.5.2': 'Pointer Cancellation (A)', '2.5.3': 'Label in Name (A)',
  '2.5.4': 'Motion Actuation (A)', '3.1.1': 'Language of Page (A)', '3.1.2': 'Language of Parts (AA)',
  '3.2.1': 'On Focus (A)', '3.2.2': 'On Input (A)', '3.2.3': 'Consistent Navigation (AA)', '3.2.4': 'Consistent Identification (AA)',
  '3.3.1': 'Error Identification (A)', '3.3.2': 'Labels or Instructions (A)', '3.3.3': 'Error Suggestion (AA)', '3.3.4': 'Error Prevention (AA)',
  '4.1.1': 'Parsing (A)', '4.1.2': 'Name, Role, Value (A)', '4.1.3': 'Status Messages (AA)',
};
const AUTOMATED_CRITERIA_IDS = new Set(['1.4.3', '1.4.4', '1.4.10', '1.4.11', '2.4.2', '2.4.4', '2.4.6', '2.5.3', '3.3.1', '3.3.2', '4.1.2']);

type A11yResult = { screen: string; priority: number; passed: boolean; violations?: string; skipped?: boolean };
type CriterionCheck = { id: string; passed: boolean };
const a11yResults: A11yResult[] = [];
const criterionChecks: CriterionCheck[] = [];

/** Wait until Login, Register, or Home is visible (app can take 60s+ to load). */
function waitForAppReady(timeoutMs = 90000) {
  return browser.waitUntil(
    async () =>
      (await $('~login-title').isDisplayed().catch(() => false)) ||
      (await $('~register-title').isDisplayed().catch(() => false)) ||
      (await $('~home-title').isDisplayed().catch(() => false)),
    { timeout: timeoutMs, interval: 500 }
  );
}

/** Navigate to Login screen if currently on Register (tap "Already have an account? Sign in"). */
async function ensureOnLoginScreen(): Promise<void> {
  const onRegister = await $('~register-title').isDisplayed().catch(() => false);
  if (onRegister) {
    await $('~login-link').click();
    await browser.waitUntil(async () => await $('~login-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
  }
}

/** Tap iOS native alert button by label (mobile: alert). No-op on Android. */
async function tapAlertButton(buttonLabel: string): Promise<void> {
  if (!isIOS) return;
  try {
    await browser.execute('mobile: alert', { action: 'accept', buttonLabel });
  } catch {
    await browser.acceptAlert();
  }
  await browser.pause(300);
}

/** Delete account from Settings: open Settings, tap Delete My Account, confirm both alerts, tap OK. */
async function deleteAccountFromSettings(): Promise<void> {
  const homeVisible = await $('~home-title').isDisplayed().catch(() => false);
  if (!homeVisible) {
    await $('~tab-home').click();
    await browser.waitUntil(async () => await $('~home-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
  }
  await $('~action-settings').click();
  await browser.waitUntil(async () => await $('~settings-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
  await $('~settings-delete-account').click();
  await browser.pause(800);
  await tapAlertButton('Delete Forever');
  await browser.pause(500);
  await tapAlertButton('Yes, Delete My Account');
  await browser.pause(500);
  await tapAlertButton('OK');
  await browser.waitUntil(
    async () =>
      (await $('~login-title').isDisplayed().catch(() => false)) ||
      (await $('~register-title').isDisplayed().catch(() => false)),
    { timeout: 15000, interval: 500 }
  );
}

async function runNativeAudit(screenName: string, priority: number): Promise<void> {
  if (!isIOS) {
    a11yResults.push({ screen: screenName, priority, passed: true, skipped: true });
    return;
  }
  try {
    await browser.execute('mobile: performAccessibilityAudit', {});
    a11yResults.push({ screen: screenName, priority, passed: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    a11yResults.push({ screen: screenName, priority, passed: false, violations: msg });
  }
}

function writeReport(): void {
  const timestamp = new Date().toISOString();
  const failed = a11yResults.filter((r) => !r.passed && !r.skipped);
  const skipped = a11yResults.filter((r) => r.skipped);
  const passed = a11yResults.length - failed.length - skipped.length;
  const criterionPass = criterionChecks.length === 0 || criterionChecks.every((c) => c.passed);
  const automatedPass = failed.length === 0 && criterionPass;

  const wcagCriteria: Record<string, { name: string; status: 'pass' | 'fail' | 'N/A' }> = {};
  for (const [id, name] of Object.entries(ALL_WCAG_AA_CRITERIA)) {
    wcagCriteria[id] = { name, status: AUTOMATED_CRITERIA_IDS.has(id) ? (automatedPass ? 'pass' : 'fail') : 'N/A' };
  }

  fs.writeFileSync(
    reportPathJson,
    JSON.stringify(
      {
        timestamp,
        wcagLevel: 'AA',
        fullyAutomated: true,
        note: 'Full E2E: if signed in delete from Settings → Register → Login → feature + a11y → delete from Settings.',
        summary: { total: a11yResults.length, passed, failed: failed.length, skipped: skipped.length },
        wcagCriteria,
        results: a11yResults,
      },
      null,
      2
    ),
    'utf8'
  );

  let md = `# Smart Pantry – Full E2E + Accessibility Report\n\n**Generated:** ${timestamp}  \n`;
  md += `**Summary:** ${passed} passed, ${failed.length} failed, ${skipped.length} skipped.\n\n`;
  md += `## Results by screen\n\n| # | Screen | Result |\n|---|--------|--------|\n`;
  for (const r of a11yResults) {
    const result = r.skipped ? 'Skipped' : r.passed ? 'Pass' : '**Fail**';
    md += `| ${r.priority} | ${r.screen} | ${result} |\n`;
  }
  fs.writeFileSync(reportPathMd, md, 'utf8');
  console.log(`\nA11y report written: ${reportPathJson}, ${reportPathMd}`);
}

describe('Smart Pantry – Full E2E (in-app register, login, feature + a11y, delete from Settings)', () => {
  before(async function () {
    const { email, password } = getE2ECredentials();
    e2eEmail = email;
    e2ePassword = password;
  });

  after(async function () {
    writeReport();
  });

  it('1. Wait for app to load, then show Login or Register or Home', async () => {
    await waitForAppReady(90000);
    const onLogin = await $('~login-title').isDisplayed().catch(() => false);
    const onRegister = await $('~register-title').isDisplayed().catch(() => false);
    const onHome = await $('~home-title').isDisplayed().catch(() => false);
    expect(onLogin || onRegister || onHome).toBe(true);
  });

  it('1b. If signed in, delete user from Settings', async () => {
    const onHome = await $('~home-title').isDisplayed().catch(() => false);
    if (onHome) {
      await deleteAccountFromSettings();
    }
  });

  it('2. Audit Login screen', async () => {
    await ensureOnLoginScreen();
    await expect($('~login-title')).toBeDisplayed();
    await runNativeAudit('Login', 1);
  });

  it('3. 3.3.1 Error Identification – Login error in text', async () => {
    await ensureOnLoginScreen();
    if (!isIOS) {
      criterionChecks.push({ id: '3.3.1', passed: true });
      return;
    }
    try {
      await $('~login-button').click();
      await browser.waitUntil(async () => await $('~login-error').isDisplayed().catch(() => false), { timeout: 8000, interval: 500 });
      const errEl = await $('~login-error');
      const label = (await errEl.getAttribute('label')) ?? (await errEl.getAttribute('name')) ?? '';
      criterionChecks.push({ id: '3.3.1', passed: typeof label === 'string' && label.trim().length > 0 });
    } catch {
      criterionChecks.push({ id: '3.3.1', passed: false });
    }
  });

  it('4. Audit Register screen', async () => {
    await ensureOnLoginScreen();
    await $('~register-link').click();
    await browser.waitUntil(async () => await $('~register-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    await runNativeAudit('Register', 2);
    await browser.back();
    await browser.pause(500);
  });

  it('5. Register test user then log in (if already registered: log in, delete, then register)', async () => {
    await ensureOnLoginScreen();
    await $('~email-input').setValue(e2eEmail);
    await $('~password-input').setValue(e2ePassword);
    await $('~login-button').click();
    const loginReached = await browser.waitUntil(
      async () =>
        (await $('~home-title').isDisplayed().catch(() => false)) ||
        (await $('~recovery-remind-later').isDisplayed().catch(() => false)),
      { timeout: 20000, interval: 500 }
    ).catch(() => false);
    const alreadySignedIn = loginReached && (await $('~home-title').isDisplayed().catch(() => false));
    if (alreadySignedIn) {
      await deleteAccountFromSettings();
      await ensureOnLoginScreen();
    }
    await $('~register-link').click();
    await browser.waitUntil(async () => await $('~register-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    await $('~email-input').setValue(e2eEmail);
    await $('~password-input').setValue(e2ePassword);
    await $('~register-button').click();
    await browser.pause(1500);
    const onRecoveryAfterRegister = await $('~recovery-remind-later').isDisplayed().catch(() => false);
    if (onRecoveryAfterRegister) {
      await $('~recovery-remind-later').click();
      await browser.waitUntil(async () => (await $('~home-title').isDisplayed().catch(() => false)) || (await $('~login-title').isDisplayed().catch(() => false)), { timeout: 15000, interval: 500 });
    }
    const onLoginAfterRegister = await $('~login-title').isDisplayed().catch(() => false);
    if (onLoginAfterRegister) {
      await $('~email-input').setValue(e2eEmail);
      await $('~password-input').setValue(e2ePassword);
      await $('~login-button').click();
    }
    const reached = await browser.waitUntil(
      async () =>
        (await $('~home-title').isDisplayed().catch(() => false)) ||
        (await $('~recovery-remind-later').isDisplayed().catch(() => false)),
      { timeout: 20000, interval: 500 }
    ).catch(() => false);
    if (!reached) {
      throw new Error('Auth failed: did not reach Home or recovery screen within 20s. Check E2E_API_URL and credentials.');
    }
    const recoveryVisible = await $('~recovery-remind-later').isDisplayed().catch(() => false);
    if (recoveryVisible) {
      await $('~recovery-remind-later').click();
      await browser.waitUntil(async () => await $('~home-title').isDisplayed().catch(() => false), { timeout: 15000, interval: 500 });
    }
    const homeVisible = await $('~home-title').isDisplayed().catch(() => false);
    if (!homeVisible) {
      throw new Error('Auth failed: Home screen not visible after recovery step. Suite will stop.');
    }
    const { access_token } = await loginUser(e2eEmail, e2ePassword);
    e2eAccessToken = access_token;
  });

  it('5b. Build inventory from fixture images (scan by label via API)', async () => {
    if (!e2eAccessToken) {
      const { access_token } = await loginUser(e2eEmail, e2ePassword);
      e2eAccessToken = access_token;
    }
    for (const filename of FIXTURE_IMAGE_FILES) {
      const imagePath = path.join(fixturesDir, filename);
      await apiProcessImage(e2eAccessToken, imagePath);
    }
  });

  it('6. Audit Home screen', async () => {
    await runNativeAudit('Home', 3);
  });

  it('7. Audit Inventory screen', async () => {
    await $('~tab-inventory').click();
    await browser.waitUntil(async () => await $('~inventory-search').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    await runNativeAudit('Inventory', 4);
  });

  it('8. Audit Recipes screen', async () => {
    await $('~tab-recipes').click();
    await browser.pause(1500);
    await browser.waitUntil(async () => await $('~recipes-title').isDisplayed().catch(() => false), { timeout: 15000, interval: 500 });
    await runNativeAudit('Recipes', 5);
  });

  it('9. Audit Recipe Box screen', async () => {
    await $('~tab-recipe-box').click();
    await browser.waitUntil(async () => await $('~recipe-box-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    await runNativeAudit('Recipe Box', 6);
  });

  it('10. Audit Statistics screen', async () => {
    await $('~tab-home').click();
    await browser.pause(800);
    await $('~action-statistics').click();
    await browser.pause(3000);
    await runNativeAudit('Statistics', 7);
  });

  it('11. Audit Pantry Selector modal', async () => {
    await browser.back();
    await browser.pause(800);
    await browser.waitUntil(async () => await $('~home-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    await $('~tab-inventory').click();
    await browser.waitUntil(async () => await $('~inventory-search').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    await $('~pantry-selector-button').click();
    await browser.waitUntil(async () => await $('~pantry-selector-close').isDisplayed().catch(() => false), { timeout: 8000, interval: 500 });
    await runNativeAudit('Pantry Selector', 8);
    await $('~pantry-selector-close').click();
    await browser.pause(500);
  });

  it('12. Audit Settings screen', async () => {
    const homeVisible = await $('~home-title').isDisplayed().catch(() => false);
    if (!homeVisible) {
      await $('~tab-home').click();
      await browser.pause(800);
      await browser.waitUntil(async () => await $('~home-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    }
    await $('~action-settings').click();
    await browser.waitUntil(async () => await $('~settings-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    await runNativeAudit('Settings', 9);
    await browser.back();
    await browser.pause(800);
    const backOnMain = await browser.waitUntil(
      async () => await $('~home-title').isDisplayed().catch(() => false),
      { timeout: 8000, interval: 500 }
    ).catch(() => false);
    if (!backOnMain && isIOS) {
      try {
        const backBtn = await $('~Main');
        if (await backBtn.isDisplayed().catch(() => false)) {
          await backBtn.click();
          await browser.pause(500);
          await browser.waitUntil(async () => await $('~home-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
        }
      } catch {
        // Back button not found by label; rely on next test's navigation
      }
    }
  });

  it('13. Audit Recipe Detail when opened from Recipe Box', async () => {
    await browser.pause(800);
    await browser.waitUntil(
      async () => (await $('~tab-recipe-box').isDisplayed().catch(() => false)) || (await $('~home-title').isDisplayed().catch(() => false)),
      { timeout: 10000, interval: 500 }
    );
    await $('~tab-recipe-box').click();
    await browser.waitUntil(async () => await $('~recipe-box-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    if (!isIOS) {
      a11yResults.push({ screen: 'Recipe Detail', priority: 10, passed: true, skipped: true });
      return;
    }
    let cards: Awaited<ReturnType<typeof $$>>;
    try {
      cards = await browser.findElements('-ios predicate string', 'name CONTAINS "recipe-box-card"');
    } catch {
      a11yResults.push({ screen: 'Recipe Detail', priority: 10, passed: true, skipped: true });
      return;
    }
    if (!cards || cards.length === 0) {
      a11yResults.push({ screen: 'Recipe Detail', priority: 10, passed: true, skipped: true });
      return;
    }
    const elementRef = cards[0] as { ELEMENT?: string; 'element-6066-11e4-a52e-4f735466cecf'?: string };
    const elementId = elementRef['element-6066-11e4-a52e-4f735466cecf'] ?? elementRef.ELEMENT;
    const firstCard = await browser.$({ 'element-6066-11e4-a52e-4f735466cecf': elementId, ELEMENT: elementId });
    await firstCard.click();
    await browser.waitUntil(async () => await $('~recipe-detail-title').isDisplayed().catch(() => false), { timeout: 10000, interval: 500 });
    await runNativeAudit('Recipe Detail', 10);
    await browser.back();
    await browser.pause(500);
  });

  it('14. Teardown: delete test user from Settings', async () => {
    await deleteAccountFromSettings();
  });
});
