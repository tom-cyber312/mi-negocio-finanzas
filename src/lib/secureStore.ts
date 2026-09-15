import { getCuentaActivaId } from "./accounts";

/* ------------------------------------------------------------------ */
/*  Almacenamiento seguro de claves de pasarelas (AES-GCM + PBKDF2).   */
/*  Los tokens se guardan CIFRADOS con una clave derivada de la        */
/*  contraseña de la cuenta. La clave derivada vive solo en memoria.   */
/* ------------------------------------------------------------------ */

let claveActiva: { id: string; key: CryptoKey } | null = null;

export const SLOTS = {
  mp: "mp_token",
  stripe: "stripe_secret",
  paypalClient: "paypal_client",
  paypalSecret: "paypal_secret",
  ia: "ia_api_key",
} as const;

export type Slot = (typeof SLOTS)[keyof typeof SLOTS];

function soportaCrypto(): boolean {
  return typeof crypto !== "undefined" && !!crypto?.subtle && !!crypto.getRandomValues;
}

function base64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const b = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b.length % 4 === 0 ? "" : "=".repeat(4 - (b.length % 4));
  const bin = atob(b + pad);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function saltKey(id: string): string {
  return `fin_gw_salt_${id}`;
}

export function claveDisponible(): boolean {
  const act = getCuentaActivaId() || "default";
  return soportaCrypto() && claveActiva !== null && claveActiva.id === act;
}

export async function crearClave(password: string): Promise<void> {
  const act = getCuentaActivaId() || "default";
  if (!soportaCrypto()) return;
  let saltB64 = localStorage.getItem(saltKey(act));
  if (!saltB64) {
    saltB64 = base64(crypto.getRandomValues(new Uint8Array(16)));
    localStorage.setItem(saltKey(act), saltB64);
  }
  const salt = fromBase64(saltB64);
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  claveActiva = { id: act, key };
}

export function limpiarClave(): void {
  claveActiva = null;
}

export function slotKeyFor(slot: Slot, id: string): string {
  return `fin_gw_${slot}_${id}`;
}

export function haySecretoGuardado(slot: Slot): boolean {
  const act = getCuentaActivaId() || "default";
  return !!localStorage.getItem(slotKeyFor(slot, act));
}

export async function guardarSecreto(slot: Slot, plain: string): Promise<void> {
  const act = getCuentaActivaId() || "default";
  if (!claveDisponible())
    throw new Error(
      "No hay sesión de claves activa. Ingresá la contraseña de la cuenta para poder cifrar."
    );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    claveActiva!.key,
    new TextEncoder().encode(plain)
  );
  localStorage.setItem(
    slotKeyFor(slot, act),
    `${base64(iv)}.${base64(ct)}`
  );
}

export async function leerSecreto(slot: Slot): Promise<string | null> {
  const act = getCuentaActivaId() || "default";
  if (!claveDisponible()) return null;
  const raw = localStorage.getItem(slotKeyFor(slot, act));
  if (!raw) return null;
  const [ivB64, ctB64] = raw.split(".");
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivB64) },
      claveActiva!.key,
      fromBase64(ctB64)
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export function borrarSecreto(slot: Slot): void {
  const act = getCuentaActivaId() || "default";
  localStorage.removeItem(slotKeyFor(slot, act));
}

/** Cifra texto arbitrario con la clave derivada de la cuenta (AES-GCM).
 * Devuelve el IV y el texto cifrado en base64url para guardar donde quieras. */
export async function encriptarTexto(
  plain: string
): Promise<{ iv: string; ct: string }> {
  if (!claveDisponible())
    throw new Error(
      "No hay sesión de claves activa. Ingresá la contraseña de la cuenta para poder cifrar."
    );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    claveActiva!.key,
    new TextEncoder().encode(plain)
  );
  return { iv: base64(iv), ct: base64(ct) };
}

/** Descifra texto cifrado con encriptarTexto. */
export async function desencriptarTexto(
  ivB64: string,
  ctB64: string
): Promise<string> {
  if (!claveDisponible())
    throw new Error(
      "No hay sesión de claves activa. Ingresá la contraseña de la cuenta para poder desencriptar."
    );
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivB64) },
      claveActiva!.key,
      fromBase64(ctB64)
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error(
      "No se pudo desencriptar. ¿Usaste la misma contraseña de la cuenta?"
    );
  }
}

export function limpiarSecretosDeCuenta(id: string): void {
  for (const s of Object.values(SLOTS)) {
    localStorage.removeItem(slotKeyFor(s as Slot, id));
  }
  localStorage.removeItem(saltKey(id));
}