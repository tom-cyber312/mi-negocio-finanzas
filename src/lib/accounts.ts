import { hashPassword, verifyPasswordHash } from "./auth";

export interface Cuenta {
  id: string;
  nombre: string;
  email: string;
  hash: string;
  createdAt: number;
}

const CUENTAS_KEY = "fin_cuentas";
const ACTIVA_KEY = "fin_cuenta_activa";

export function getCuentas(): Cuenta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUENTAS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveCuentas(list: Cuenta[]): void {
  try {
    localStorage.setItem(CUENTAS_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function getCuentaActivaId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVA_KEY);
}

export function getCuentaActiva(): Cuenta | null {
  const id = getCuentaActivaId();
  if (!id) return null;
  return getCuentas().find((c) => c.id === id) ?? null;
}

export function setCuentaActiva(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(ACTIVA_KEY);
    else localStorage.setItem(ACTIVA_KEY, id);
  } catch {
    /* noop */
  }
}

function nextId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export async function crearCuenta(
  nombre: string,
  email: string,
  password: string
): Promise<Cuenta> {
  const emailNorm = email.trim().toLowerCase();
  const list = getCuentas();
  if (list.some((c) => c.email === emailNorm)) {
    throw new Error("Ya existe una cuenta con ese correo.");
  }
  const cuenta: Cuenta = {
    id: list.length === 0 ? "default" : nextId(),
    nombre: nombre.trim() || "Mi negocio",
    email: emailNorm,
    hash: await hashPassword(password),
    createdAt: Date.now(),
  };
  saveCuentas([...list, cuenta]);
  return cuenta;
}

export async function validarLogin(
  email: string,
  password: string
): Promise<Cuenta | null> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm || !password) return null;
  const cuenta = getCuentas().find((c) => c.email === emailNorm);
  if (!cuenta) return null;
  const ok = await verifyPasswordHash(password, cuenta.hash);
  return ok ? cuenta : null;
}

export function renombrarCuenta(id: string, nombre: string): void {
  const list = getCuentas().map((c) =>
    c.id === id ? { ...c, nombre: nombre.trim() || c.nombre } : c
  );
  saveCuentas(list);
}

export function actualizarCuenta(cuenta: Cuenta): void {
  const list = getCuentas().map((c) => (c.id === cuenta.id ? cuenta : c));
  saveCuentas(list);
}

export function eliminarCuenta(id: string): Cuenta[] {
  const list = getCuentas().filter((c) => c.id !== id);
  saveCuentas(list);
  return list;
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}