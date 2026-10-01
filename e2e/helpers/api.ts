/**
 * E2E API helpers: register, login (get token), delete account, inventory (get, delete, process-image).
 * Set E2E_API_URL (e.g. http://localhost:8000 or your backend) so the app and tests hit the same API.
 * E2E_EMAIL / E2E_PASSWORD: optional override; otherwise fixed defaults are used for reuse across runs.
 */
import * as fs from 'fs';
import * as path from 'path';

/** Fixed E2E credentials for reuse across all future test runs. Override via E2E_EMAIL / E2E_PASSWORD. */
export const E2E_DEFAULT_EMAIL = 'e2e@test.smartpantry.local';
export const E2E_DEFAULT_PASSWORD = 'E2eTest-Reuse-Password1';

export function getE2ECredentials(): { email: string; password: string } {
  return {
    email: process.env.E2E_EMAIL || E2E_DEFAULT_EMAIL,
    password: process.env.E2E_PASSWORD || E2E_DEFAULT_PASSWORD,
  };
}

const baseUrl = (): string => {
  const url = process.env.E2E_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
  return url.replace(/\/$/, '');
};

export async function registerUser(email: string, password: string, fullName?: string): Promise<void> {
  const form = new URLSearchParams();
  form.set('email', email);
  form.set('password', password);
  if (fullName) form.set('full_name', fullName);

  const res = await fetch(`${baseUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Register failed ${res.status}: ${text}`);
  }
}

/** Register user; no-op if email already registered (reuse existing account). */
export async function registerUserIfNeeded(email: string, password: string, fullName?: string): Promise<void> {
  try {
    await registerUser(email, password, fullName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('400') && (msg.includes('already') || msg.includes('registered'))) return;
    throw err;
  }
}

export async function loginUser(email: string, password: string): Promise<{ access_token: string }> {
  const form = new URLSearchParams();
  form.set('email', email);
  form.set('password', password);

  const res = await fetch(`${baseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return { access_token: data.access_token };
}

export async function deleteUser(accessToken: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/api/auth/account`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete account failed ${res.status}: ${text}`);
  }
}

/** Recovery questions: GET /api/auth/recovery-questions (all questions + user's set ids). */
export interface RecoveryQuestionItem {
  id: number;
  text: string;
}
export interface GetRecoveryQuestionsResponse {
  all_questions: RecoveryQuestionItem[];
  user_question_ids: number[];
}

export async function getRecoveryQuestions(accessToken: string): Promise<GetRecoveryQuestionsResponse> {
  const res = await fetch(`${baseUrl()}/api/auth/recovery-questions`, {
    method: 'GET',
    headers: { ...authHeaders(accessToken), Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get recovery questions failed ${res.status}: ${text}`);
  }
  return (await res.json()) as GetRecoveryQuestionsResponse;
}

/** Set recovery answers: POST /api/auth/recovery-questions (2–3 question_id + answer pairs). */
export interface RecoveryAnswerInput {
  question_id: number;
  answer: string;
}

export async function setRecoveryQuestions(
  accessToken: string,
  answers: RecoveryAnswerInput[]
): Promise<void> {
  if (answers.length < 2 || answers.length > 3) {
    throw new Error('Recovery questions require 2 or 3 answers.');
  }
  const res = await fetch(`${baseUrl()}/api/auth/recovery-questions`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Set recovery questions failed ${res.status}: ${text}`);
  }
}

/** Fixed E2E recovery answers (question ids 1 and 2 match backend RECOVERY_QUESTIONS). Set after register so app login does not show recovery prompt. */
export const E2E_RECOVERY_ANSWERS: RecoveryAnswerInput[] = [
  { question_id: 1, answer: 'E2ePet1' },
  { question_id: 2, answer: 'E2eCity1' },
];

const authHeaders = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export interface InventoryItem {
  id: number;
  product_name?: string;
  [key: string]: unknown;
}

export async function getInventory(accessToken: string): Promise<InventoryItem[]> {
  const res = await fetch(`${baseUrl()}/api/inventory`, {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get inventory failed ${res.status}: ${text}`);
  }
  return (await res.json()) as InventoryItem[];
}

export async function deleteInventoryItem(accessToken: string, itemId: number): Promise<void> {
  const res = await fetch(`${baseUrl()}/api/inventory/${itemId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete inventory item ${itemId} failed ${res.status}: ${text}`);
  }
}

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** Process a fixture image via POST /api/inventory/process-image to add item(s) to inventory. */
export async function processImage(accessToken: string, imagePath: string): Promise<unknown> {
  const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(imagePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Fixture image not found: ${absolutePath}`);
  }
  const ext = path.extname(absolutePath).toLowerCase();
  const mime = IMAGE_MIME[ext] || 'image/png';
  const body = new FormData();
  body.append('file', new Blob([fs.readFileSync(absolutePath)], { type: mime }), path.basename(absolutePath));
  body.append('storage_location', 'pantry');

  const res = await fetch(`${baseUrl()}/api/inventory/process-image`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Process image failed ${res.status}: ${text}`);
  }
  return (await res.json()) as unknown;
}

/** Fixture image filenames in test-data/fixtures/ (for scan-by-label E2E). */
export const FIXTURE_IMAGE_FILES = [
  'wonderful-pistachios-roasted-salted.png',
  'heb-prune-juice.png',
  'kirkland-tuna-pantry-shelf.png',
  'heb-garbanzo-beans.png',
  'central-market-organics-garbanzo-beans.png',
  'kelleys-honey-wildflower.png',
] as const;

