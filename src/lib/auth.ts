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

const PBKDF2_PREFIX = "pbkdf2:";
const PBKDF2_ITER = 250_000;

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b.length % 4 === 0 ? "" : "=".repeat(4 - (b.length % 4));
  const bin = atob(b + pad);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function fixedTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    material,
    256
  );
  const hash = new Uint8Array(bits);
  return `${PBKDF2_PREFIX}${PBKDF2_ITER}:${base64url(salt)}:${base64url(hash)}`;
}

// Acepta el formato nuevo (pbkdf2:) y el legacy (sha256 salada) para que
// las cuentas creadas antes de este cambio sigan pudiendo iniciar sesión.
export async function verifyPasswordHash(
  password: string,
  stored: string
): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith(PBKDF2_PREFIX)) {
    const partes = stored.split(":");
    if (partes.length !== 4) return false;
    const [, iterStr, saltB64, hashB64] = partes;
    const iterations = parseInt(iterStr, 10) || PBKDF2_ITER;
    const salt = base64urlDecode(saltB64);
    const esperado = base64urlDecode(hashB64);
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      material,
      esperado.length * 8
    );
    return fixedTimeEqual(new Uint8Array(bits), esperado);
  }
  const [hash, salt] = (stored || "").split(":");
  if (!hash || !salt) return false;
  const candidate = await sha256Hex(salt + password);
  return candidate === hash;
}

// True si el hash guardado usa el esquema anterior (para rehash al login).
export function esHashLegacy(stored: string): boolean {
  return !!stored && !stored.startsWith(PBKDF2_PREFIX);
}

export function isSessionValid(): boolean {
  const exp = leerSesion();
  return !!exp && exp > Date.now();
}

export function closeSession(): void {
  borrarSesion();
}