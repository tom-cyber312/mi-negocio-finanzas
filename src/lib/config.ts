import type { FiscalConfig, GatewayConfig } from "./types";

const FISCAL_KEY = "fin_fiscal";
const GW_KEY = "fin_gateways";
const CONTADOR_KEY = "fin_factura_contadores";

export const DEFAULT_FISCAL: FiscalConfig = {
  razonSocial: "",
  cuit: "",
  condicionIva: "monotributo",
  monotributoCategoria: "A",
  ivaPct: 21,
  ptoVenta: "0001",
  direccion: "",
  localidad: "",
};

export function getFiscalConfig(): FiscalConfig {
  if (typeof window === "undefined") return DEFAULT_FISCAL;
  try {
    const raw = localStorage.getItem(FISCAL_KEY);
    if (!raw) return DEFAULT_FISCAL;
    return { ...DEFAULT_FISCAL, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FISCAL;
  }
}

export function setFiscalConfig(cfg: FiscalConfig): void {
  try {
    localStorage.setItem(FISCAL_KEY, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}

export const DEFAULT_GATEWAYS: GatewayConfig = {
  mpToken: "",
  mpEnabled: false,
  stripeSecret: "",
  stripeEnabled: false,
  paypalClientId: "",
  paypalSecret: "",
  paypalEnabled: false,
};

export function getGateways(): GatewayConfig {
  if (typeof window === "undefined") return DEFAULT_GATEWAYS;
  try {
    const raw = localStorage.getItem(GW_KEY);
    if (!raw) return DEFAULT_GATEWAYS;
    return { ...DEFAULT_GATEWAYS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GATEWAYS;
  }
}

export function setGateways(cfg: GatewayConfig): void {
  try {
    localStorage.setItem(GW_KEY, JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}

export interface ContadoresFactura {
  [letra: string]: number;
}

export function getContadorFactura(letra: string): number {
  try {
    const raw = localStorage.getItem(CONTADOR_KEY);
    const c: ContadoresFactura = raw ? JSON.parse(raw) : {};
    return c[letra] || 0;
  } catch {
    return 0;
  }
}

export function incrementarContadorFactura(letra: string): number {
  try {
    const raw = localStorage.getItem(CONTADOR_KEY);
    const c: ContadoresFactura = raw ? JSON.parse(raw) : {};
    const next = (c[letra] || 0) + 1;
    c[letra] = next;
    localStorage.setItem(CONTADOR_KEY, JSON.stringify(c));
    return next;
  } catch {
    return 1;
  }
}

const MONO_LIMITES_KEY = "fin_monotributo_limites";

export function getLimitesMonotributo(): { letra: string; limiteAnual: number }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MONO_LIMITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setLimitesMonotributo(arr: { letra: string; limiteAnual: number }[]): void {
  try {
    localStorage.setItem(MONO_LIMITES_KEY, JSON.stringify(arr));
  } catch {
    /* noop */
  }
}