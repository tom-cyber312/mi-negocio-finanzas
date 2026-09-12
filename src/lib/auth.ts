const SESSION_KEY = "fin_sess";

export async function sha256Hex(text: string): Promise<string> {
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

export async function hashPassword(password: string): Promise<string> {
  const salt = randomSalt();
  return (await sha256Hex(salt + password)) + ":" + salt;
}

export async function verifyPasswordHash(
  password: string,
  stored: string
): Promise<boolean> {
  const [hash, salt] = (stored || "").split(":");
  if (!hash || !salt) return false;
  const candidate = await sha256Hex(salt + password);
  return candidate === hash;
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