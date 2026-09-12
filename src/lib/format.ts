import { getCuentaActivaId } from "./accounts";

export interface CurrencyOption {
  code: string;
  locale: string;
  label: string;
  symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "ARS", locale: "es-AR", label: "Peso argentino", symbol: "$" },
  { code: "USD", locale: "en-US", label: "Dólar estadounidense", symbol: "$" },
  { code: "EUR", locale: "es-ES", label: "Euro", symbol: "€" },
  { code: "CLP", locale: "es-CL", label: "Peso chileno", symbol: "$" },
  { code: "MXN", locale: "es-MX", label: "Peso mexicano", symbol: "$" },
  { code: "COP", locale: "es-CO", label: "Peso colombiano", symbol: "$" },
];

function currencyKey(): string {
  const act = getCuentaActivaId() || "default";
  return act === "default" ? "fin_settings_currency" : `fin_settings_currency_${act}`;
}

export function currencyCode(): string {
  if (typeof window === "undefined") return "ARS";
  try {
    return localStorage.getItem(currencyKey()) || "ARS";
  } catch {
    return "ARS";
  }
}

export function setCurrency(code: string) {
  try {
    localStorage.setItem(currencyKey(), code);
  } catch {
    /* noop */
  }
}

function localeFor(code: string): string {
  const c = CURRENCIES.find((c) => c.code === code);
  return c ? c.locale : "es-AR";
}

export function fmtMoney(n: number, code?: string): string {
  const c = code || currencyCode();
  try {
    return new Intl.NumberFormat(localeFor(c), {
      style: "currency",
      currency: c,
      maximumFractionDigits: c === "CLP" ? 0 : 2,
    }).format(n);
  } catch {
    return `${(c === "CLP" ? "" : "$")}${n.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}`;
  }
}

export function fmtCompact(n: number, code?: string): string {
  const c = code || currencyCode();
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const sym = CURRENCIES.find((x) => x.code === c)?.symbol ?? "$";
  if (abs >= 1_000_000) return `${sign}${sym} ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym} ${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${sym} ${abs.toFixed(0)}`;
}

export function fmtNumber(n: number, digits = 0): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return String(n);
  }
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return `${fmtDate(ts)} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const MESES_CORTO = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function fmtPct(n: number, digits = 1): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function toTimestamp(isoLocal: string): number {
  const d = new Date(isoLocal);
  return d.getTime();
}

export function toISOLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}