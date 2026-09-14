import { describe, it, expect } from "vitest";
import {
  marginPct,
  isStockBajo,
  calcResumen,
  filtrarPorRango,
  rangoPeriodo,
  seriePorMes,
  egresosPorCategoria,
  evolucionDiaria,
  acumuladoDiario,
  resumenMes,
  pctVariacion,
  topProductos,
  diasSinVender,
  DAY_MS,
} from "../calc";
import type { CategoriaGasto, Gasto, Producto, Venta } from "../types";

function venta(ts: number, u: number, p: number, costo = 0, prod = 1): Venta {
  return {
    id: 0,
    productoId: prod,
    nombreProducto: "Prod" + prod,
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

function producto(id: number, costo: number, precio: number, stock: number, umbral = 1): Producto {
  return {
    id,
    nombre: "P" + id,
    categoria: "General",
    sku: "",
    costo,
    precio,
    stock,
    umbralStock: umbral,
    createdAt: 0,
  };
}

describe("calc", () => {
  it("marginPct e isStockBajo", () => {
    const p = producto(1, 40, 100, 3, 5);
    expect(marginPct(p)).toBeCloseTo(60, 6);
    expect(isStockBajo(p)).toBe(true);
    expect(isStockBajo({ ...p, stock: 6 })).toBe(false);
    expect(marginPct({ ...p, precio: 0 })).toBe(0);
  });

  it("calcResumen integra ventas, gastos e inventario", () => {
    const ps = [producto(1, 40, 100, 5)];
    const vs = [
      venta(Date.UTC(2026, 0, 10), 2, 100, 40),
      venta(Date.UTC(2026, 0, 11), 1, 100, 40),
    ];
    const gs = [gasto(Date.UTC(2026, 0, 12), 30, "Publicidad"), gasto(Date.UTC(2026, 0, 13), 20)];
    const r = calcResumen(ps, vs, gs);
    expect(r.ingresos).toBe(300);
    expect(r.costeVentas).toBe(120);
    expect(r.utilidadBruta).toBe(180);
    expect(r.egresos).toBe(50);
    expect(r.utilidadNeta).toBe(300 - 50);
    expect(r.gastoPublicidad).toBe(30);
    expect(r.numVentas).toBe(2);
    expect(r.unidadesVendidas).toBe(3);
    expect(r.capitalInventario).toBe(200);
    expect(r.valorPotencialVentas).toBe(500);
    expect(r.gananciaPotencialInventario).toBe(300);
    expect(r.roiPublicidad).toBe(300 / 30);
  });

  it("filtrarPorRango y rangoPeriodo", () => {
    const l = [venta(1000, 1, 1), venta(2000, 1, 1), venta(3000, 1, 1)];
    expect(filtrarPorRango(l, 2000, 3000).map((v) => v.fecha)).toEqual([2000, 3000]);
    expect(rangoPeriodo("todo")).toEqual({ desde: undefined, hasta: undefined });
    const r = rangoPeriodo("30d", 1000 * DAY_MS);
    expect(r.desde).toBe(1000 * DAY_MS - 30 * DAY_MS);
    expect(r.hasta).toBe(1000 * DAY_MS);
  });

  it("seriePorMes genera n meses y acumula correctamente", () => {
    const now = new Date(2026, 5, 10);
    const ts = new Date(2026, 5, 2).getTime();
    const s = seriePorMes(
      [venta(ts, 2, 100), venta(ts + 1, 1, 50)],
      [gasto(ts, 40)],
      3,
      now
    );
    expect(s).toHaveLength(3);
    expect(s[2].key).toBe("2026-06");
    expect(s[2].ingresos).toBe(250);
    expect(s[2].egresos).toBe(40);
    expect(s[2].utilidad).toBe(210);
  });

  it("egresosPorCategoria solo incluye categorías con gastos", () => {
    const out = egresosPorCategoria([
      gasto(Date.UTC(2026, 0, 1), 10, "Insumos"),
      gasto(Date.UTC(2026, 0, 2), 5, "Insumos"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "Insumos", value: 15 });
  });

  it("evolucionDiaria respeta días del mes y acumuladoDiario suma", () => {
    const feb = new Date(2026, 1, 3).getTime();
    const feb2 = new Date(2026, 1, 4).getTime();
    const ev = evolucionDiaria([venta(feb, 1, 100)], [gasto(feb2, 10)], 2026, 1);
    expect(ev).toHaveLength(28);
    expect(ev[2].ingresos).toBe(100);
    expect(ev[2].balance).toBe(100);
    expect(ev[3].egresos).toBe(10);
    const acc = acumuladoDiario([{ dia: "01", ingresos: 100, egresos: 20 }, { dia: "02", ingresos: 50, egresos: 5 }]);
    expect(acc).toEqual([
      { dia: "01", ingresos: 100, egresos: 20 },
      { dia: "02", ingresos: 150, egresos: 25 },
    ]);
  });

  it("resumenMes filtra por mes", () => {
    const ts = new Date(2026, 2, 5).getTime();
    const res = resumenMes(
      [venta(ts, 3, 100), venta(new Date(2026, 3, 5).getTime(), 1, 1)],
      [gasto(ts, 25)],
      2026,
      2
    );
    expect(res.ingresos).toBe(300);
    expect(res.egresos).toBe(25);
    expect(res.balance).toBe(275);
    expect(res.ventas).toHaveLength(1);
  });

  it("pctVariacion maneja bases cero", () => {
    expect(pctVariacion(10, 0)).toBeNull();
    expect(pctVariacion(0, 0)).toBeNull();
    expect(pctVariacion(120, 100)).toBe(20);
  });

  it("topProductos agrega por producto y diasSinVender calcula", () => {
    const base = Date.UTC(2026, 0, 10);
    const vs = [
      venta(base, 2, 100, 40, 1),
      venta(base - 2 * DAY_MS, 1, 100, 40, 1),
      venta(base, 1, 50, 10, 2),
    ];
    const top = topProductos(vs, [producto(1, 40, 100, 1), producto(2, 10, 50, 1)]);
    const t1 = top.get(1)!;
    expect(t1.unidades).toBe(3);
    expect(t1.ingresos).toBe(300);
    expect(t1.ganancia).toBe(180);
    const hoy = Date.UTC(2026, 0, 13);
    expect(diasSinVender(vs, 1, hoy)).toBe(3);
    expect(diasSinVender(vs, 99, hoy)).toBe(Infinity);
  });
});