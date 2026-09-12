const SESSION_KEY = "fin_sess";
const SESSION_DURACION_MS = 30 * 24 * 3600 * 1000; // 30 días

function leerSesion(): number {
  try {
    const v = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return Number(v || 0);
  } catch {
    return 0;
  }
}

function escribirSesion(exp: number): void {
  try {
    localStorage.setItem(SESSION_KEY, String(exp));
  } catch {
    /* noop */
  }
  try {
    sessionStorage.setItem(SESSION_KEY, String(exp));
  } catch {
    /* noop */
  }
}

function borrarSesion(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

export function openSession(): void {
  escribirSesion(Date.now() + SESSION_DURACION_MS);
}

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

export function isSessionValid(): boolean {
  const exp = leerSesion();
  return !!exp && exp > Date.now();
}

export function closeSession(): void {
  borrarSesion();
}