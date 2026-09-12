const SALT_KEY = "fin_pwd_salt";
const HASH_KEY = "fin_pwd_hash";
const SESSION_KEY = "fin_sess";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPassword(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(HASH_KEY);
}

export async function createPassword(password: string): Promise<void> {
  const salt = randomSalt();
  const hash = (await sha256Hex(salt + password)) + ":" + salt;
  localStorage.setItem(HASH_KEY, hash);
  openSession();
}

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = localStorage.getItem(HASH_KEY);
  if (!stored) return false;
  const [hash, salt] = stored.split(":");
  const candidate = await sha256Hex((salt || "") + password);
  return candidate === hash;
}

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const ok = await verifyPassword(oldPassword);
  if (!ok) return false;
  const salt = randomSalt();
  const hash = (await sha256Hex(salt + newPassword)) + ":" + salt;
  localStorage.setItem(HASH_KEY, hash);
  return true;
}

export function openSession(hours = 24 * 7): void {
  const exp = Date.now() + hours * 3600 * 1000;
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, String(exp));
}

export function isSessionValid(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const exp = Number(sessionStorage.getItem(SESSION_KEY) || 0);
  return !!exp && exp > Date.now();
}

export function closeSession(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function resetPassword(): void {
  localStorage.removeItem(HASH_KEY);
  localStorage.removeItem(SALT_KEY);
  closeSession();
}