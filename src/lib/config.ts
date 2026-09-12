import type { FiscalConfig, GatewayConfig } from "./types";
import { getCuentaActivaId } from "./accounts";

function k(base: string): string {
  const act = getCuentaActivaId() || "default";
  return act === "default" ? base : `${base}_${act}`;
}

const FISCAL_KEY = () => k("fin_fiscal");
const GW_KEY = () => k("fin_gateways");
const CONTADOR_KEY = () => k("fin_factura_contadores");

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
    const raw = localStorage.getItem(FISCAL_KEY());
    if (!raw) return DEFAULT_FISCAL;
    return { ...DEFAULT_FISCAL, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FISCAL;
  }
}

export function setFiscalConfig(cfg: FiscalConfig): void {
  try {
    localStorage.setItem(FISCAL_KEY(), JSON.stringify(cfg));
  } catch {
    /* noop */
  }
}

export const DEFAULT_GATEWAYS: GatewayConfig = {
  mpEnabled: false,
  mpSaveToken: false,
  mpUsarServidor: false,
  stripeEnabled: false,
  stripeSaveToken: false,
  stripeUsarServidor: false,
  paypalEnabled: false,
  paypalSaveToken: false,
  paypalUsarServidor: false,
};

export function getGateways(): GatewayConfig {
  if (typeof window === "undefined") return DEFAULT_GATEWAYS;
  try {
    const raw = localStorage.getItem(GW_KEY());
    if (!raw) return DEFAULT_GATEWAYS;
    const parsed = JSON.parse(raw);
    // Mezcla selectiva: nunca se leen tokens en claro de la config.
    return {
      ...DEFAULT_GATEWAYS,
      mpEnabled: !!parsed.mpEnabled,
      mpSaveToken: !!parsed.mpSaveToken,
      mpUsarServidor: !!parsed.mpUsarServidor,
      stripeEnabled: !!parsed.stripeEnabled,
      stripeSaveToken: !!parsed.stripeSaveToken,
      stripeUsarServidor: !!parsed.stripeUsarServidor,
      paypalEnabled: !!parsed.paypalEnabled,
      paypalSaveToken: !!parsed.paypalSaveToken,
      paypalUsarServidor: !!parsed.paypalUsarServidor,
    };
  } catch {
    return DEFAULT_GATEWAYS;
  }
}

export function setGateways(cfg: GatewayConfig): void {
  try {
    // Solo flags: los tokens se guardan cifrados aparte (secureStore).
    localStorage.setItem(
      GW_KEY(),
      JSON.stringify({
        mpEnabled: cfg.mpEnabled,
        mpSaveToken: cfg.mpSaveToken,
        mpUsarServidor: cfg.mpUsarServidor,
        stripeEnabled: cfg.stripeEnabled,
        stripeSaveToken: cfg.stripeSaveToken,
        stripeUsarServidor: cfg.stripeUsarServidor,
        paypalEnabled: cfg.paypalEnabled,
        paypalSaveToken: cfg.paypalSaveToken,
        paypalUsarServidor: cfg.paypalUsarServidor,
      })
    );
  } catch {
    /* noop */
  }
}

export interface ContadoresFactura {
  [letra: string]: number;
}

export function getContadorFactura(letra: string): number {
  try {
    const raw = localStorage.getItem(CONTADOR_KEY());
    const c: ContadoresFactura = raw ? JSON.parse(raw) : {};
    return c[letra] || 0;
  } catch {
    return 0;
  }
}

export function incrementarContadorFactura(letra: string): number {
  try {
    const raw = localStorage.getItem(CONTADOR_KEY());
    const c: ContadoresFactura = raw ? JSON.parse(raw) : {};
    const next = (c[letra] || 0) + 1;
    c[letra] = next;
    localStorage.setItem(CONTADOR_KEY(), JSON.stringify(c));
    return next;
  } catch {
    return 1;
  }
}

const MONO_LIMITES_KEY = () => k("fin_monotributo_limites");

export function getLimitesMonotributo(): { letra: string; limiteAnual: number }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MONO_LIMITES_KEY());
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setLimitesMonotributo(arr: { letra: string; limiteAnual: number }[]): void {
  try {
    localStorage.setItem(MONO_LIMITES_KEY(), JSON.stringify(arr));
  } catch {
    /* noop */
  }
}