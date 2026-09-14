import { describe, it, expect } from "vitest";
import {
  fmtMoney,
  fmtCompact,
  fmtNumber,
  fmtDate,
  fmtDateTime,
  fmtPct,
  MESES,
  MESES_CORTO,
  startOfDay,
  toTimestamp,
  toISOLocal,
} from "../format";

describe("format", () => {
  it("MESES y MESES_CORTO tienen 12 entradas", () => {
    expect(MESES).toHaveLength(12);
    expect(MESES_CORTO).toHaveLength(12);
    expect(MESES[0]).toBe("Enero");
    expect(MESES_CORTO[11]).toBe("Dic");
  });

  it("fmtMoney formatea monedas y CLP sin decimales", () => {
    expect(fmtMoney(1234.5, "ARS")).toMatch(/^\$\s?1\.234,50$/);
    expect(fmtMoney(1234, "CLP")).toMatch(/^\$\s?1\.234$/);
    expect(fmtMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(fmtMoney(0, "USD")).toBe("$0.00");
  });

  it("fmtCompact agrupa miles y millones", () => {
    expect(fmtCompact(500)).toBe("$ 500");
    expect(fmtCompact(2500, "ARS")).toBe("$ 2.5k");
    expect(fmtCompact(-4_000_000, "ARS")).toBe("-$ 4.0M");
  });

  it("fmtNumber con miles", () => {
    expect(fmtNumber(1250000, 0)).toMatch(/1\.250\.000/);
  });

  it("fmtDate y fmtDateTime con ceros a la izquierda", () => {
    const ts = new Date(2026, 0, 4, 9, 5).getTime();
    expect(fmtDate(ts)).toBe("04/01/2026");
    expect(fmtDateTime(ts)).toBe("04/01/2026 09:05");
  });

  it("fmtPct con signo", () => {
    expect(fmtPct(12.34)).toBe("+12.3%");
    expect(fmtPct(-2)).toBe("-2.0%");
    expect(fmtPct(0)).toBe("0.0%");
  });

  it("startOfDay, toTimestamp y toISOLocal", () => {
    const ts = new Date(2026, 2, 9, 15, 30).getTime();
    expect(new Date(startOfDay(ts)).getHours()).toBe(0);
    const iso = toISOLocal(ts);
    expect(toTimestamp(iso)).toBe(ts);
  });
});