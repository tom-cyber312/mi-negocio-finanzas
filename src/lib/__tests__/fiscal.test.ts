import { describe, it, expect } from "vitest";
import {
  ultimos12Meses,
  estadoMonotributo,
  CATEGORIAS_MONOTRIBUTO_DEFAULT,
  calcularIva,
  letraPara,
  condicionTitulo,
  factorInflacion,
  mesKeyDeFecha,
  gastosPorPresupuesto,
} from "../fiscal";
import type { CategoriaGasto, FiscalConfig, Gasto, InflacionMes, Venta } from "../types";

function venta(ts: number, u: number, p: number, costo = 0): Venta {
  return {
    id: 0,
    productoId: 1,
    nombreProducto: "Prod",
    cantidad: u,
    precioUnitario: p,
    costoUnitario: costo,
    fecha: ts,
    cliente: "",
    metodoPago: "Efectivo",
  };
}

function gasto(ts: number, monto: number, categoria: CategoriaGasto = "Servicios"): Gasto {
  return {
    id: 0,
    fecha: ts,
    categoria,
    descripcion: "x",
    monto,
    recurrente: false,
  };
}

const fiscal: FiscalConfig = {
  condicionIva: "monotributo",
  razonSocial: "",
  cuit: "",
  direccion: "",
  localidad: "",
  ptoVenta: "0001",
  ivaPct: 21,
  monotributoCategoria: "",
};

describe("fiscal", () => {
  const now = new Date(2026, 5, 15); // 15 jun 2026

  it("ultimos12Meses suma solo los últimos 12 meses", () => {
    const dic24 = new Date(2024, 11, 10).getTime();
    const jun25 = new Date(2025, 5, 1).getTime();
    const julInicio = new Date(2025, 6, 1).getTime();
    const oct25 = new Date(2025, 9, 5).getTime();
    const ventas = [
      venta(dic24, 1, 1000),
      venta(jun25, 2, 500),
      venta(julInicio, 1, 50),
      venta(oct25, 3, 100),
    ];
    // Ventana = jul 2025..jun 2026: quedan julInicio y oct25
    expect(ultimos12Meses(ventas, now)).toBe(1 * 50 + 3 * 100);
  });

  it("estadoMonotributo calcula categoría calculada y recálculo al superar el límite", () => {
    const v = [venta(new Date(2026, 0, 5).getTime(), 1, 11_000_000)];
    const est = estadoMonotributo(v, CATEGORIAS_MONOTRIBUTO_DEFAULT, fiscal, now);
    expect(est.facturado12m).toBe(11_000_000);
    expect(est.categoriaCalculada?.letra).toBe("B");
    expect(est.superado).toBe(false);
    const est2 = estadoMonotributo(
      v,
      CATEGORIAS_MONOTRIBUTO_DEFAULT,
      { ...fiscal, monotributoCategoria: "A" },
      now
    );
    expect(est2.categoriaActual?.letra).toBe("A");
    expect(est2.superado).toBe(true);
    expect(est2.usoPct).toBeCloseTo(110, 6);
  });

  it("calcularIva distingue monto con IVA incluido o excluido", () => {
    expect(calcularIva(121, 21, true)).toBeCloseTo(21, 6);
    expect(calcularIva(100, 21, false)).toBe(21);
  });

  it("letraPara y condicionTitulo", () => {
    const respin: FiscalConfig = { ...fiscal, condicionIva: "respin" };
    const exento: FiscalConfig = { ...fiscal, condicionIva: "exento" };
    expect(letraPara(respin)).toBe("A");
    expect(letraPara(exento)).toBe("C");
    expect(letraPara(fiscal)).toBe("C");
    expect(condicionTitulo("respin")).toBe("Responsable Inscripto");
    expect(condicionTitulo("monotributo")).toBe("Monotributo");
  });

  it("factorInflacion no ajusta hacia atrás o iguales y compone hacia adelante", () => {
    const inf: InflacionMes[] = [
      { mesKey: "2025-06", variacionPct: 10 },
      { mesKey: "2025-07", variacionPct: 20 },
    ];
    expect(factorInflacion(inf, "2025-01", "2025-05")).toBe(1);
    expect(factorInflacion(inf, "2025-01", "2025-06")).toBeCloseTo(1.1, 6);
    expect(factorInflacion(inf, "2025-05", "2025-05")).toBe(1);
    expect(factorInflacion(inf, "2025-08", "2025-03")).toBe(1);
    expect(factorInflacion(inf, "2025-05", "2025-07")).toBeCloseTo(1.1 * 1.2, 6);
    expect(factorInflacion([], "2025-05", "2025-08")).toBe(1);
  });

  it("mesKeyDeFecha y gastosPorPresupuesto", () => {
    const ts = new Date(2026, 2, 9).getTime();
    expect(mesKeyDeFecha(ts)).toBe("2026-03");
    const gastos = [gasto(new Date(2026, 2, 4).getTime(), 50, "Insumos"), gasto(new Date(2026, 3, 4).getTime(), 5)];
    const m = gastosPorPresupuesto(gastos, 2026, 2);
    expect(m.get("Insumos")).toBe(50);
    expect(m.get("Servicios")).toBeUndefined();
  });
});