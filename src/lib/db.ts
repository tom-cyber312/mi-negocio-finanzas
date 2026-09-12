import Dexie, { type Table } from "dexie";
import type { Gasto, Producto, Venta } from "./types";
import { METODOS_PAGO } from "./types";

export class FinDB extends Dexie {
  productos!: Table<Producto, number>;
  ventas!: Table<Venta, number>;
  gastos!: Table<Gasto, number>;

  constructor() {
    super("finanzasDB");
    this.version(1).stores({
      productos: "++id, nombre, categoria, sku",
      ventas: "++id, productoId, fecha, metodoPago",
      gastos: "++id, fecha, categoria, recurrente",
    });
  }
}

export const db = new FinDB();

export async function saveProducto(p: Producto): Promise<number> {
  if (p.id) {
    await db.productos.update(p.id, {
      nombre: p.nombre,
      categoria: p.categoria,
      sku: p.sku,
      costo: p.costo,
      precio: p.precio,
      stock: p.stock,
      umbralStock: p.umbralStock,
    });
    return p.id;
  }
  return db.productos.add({
    ...p,
    createdAt: Date.now(),
  });
}

export async function deleteProducto(id: number): Promise<void> {
  await db.productos.delete(id);
}

export async function registrarVenta(
  v: Omit<Venta, "id" | "nombreProducto" | "costoUnitario">
): Promise<number> {
  return db.transaction("rw", db.productos, db.ventas, async () => {
    const prod = await db.productos.get(v.productoId);
    if (!prod) throw new Error("El producto no existe");
    if (v.cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");
    if (prod.stock < v.cantidad)
      throw new Error(
        `Stock insuficiente: quedan ${prod.stock} unidades de ${prod.nombre}`
      );

    const id = await db.ventas.add({
      ...v,
      nombreProducto: prod.nombre,
      costoUnitario: prod.costo,
    });
    await db.productos.update(prod.id!, {
      stock: prod.stock - v.cantidad,
    });
    return id;
  });
}

export async function eliminarVenta(id: number): Promise<void> {
  await db.transaction("rw", db.productos, db.ventas, async () => {
    const v = await db.ventas.get(id);
    if (!v) return;
    await db.ventas.delete(id);
    const prod = await db.productos.get(v.productoId);
    if (prod) {
      await db.productos.update(prod.id!, { stock: prod.stock + v.cantidad });
    }
  });
}

export async function saveGasto(g: Gasto): Promise<number> {
  if (g.id) {
    await db.gastos.update(g.id, {
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto,
      fecha: g.fecha,
      recurrente: g.recurrente,
    });
    return g.id;
  }
  return db.gastos.add(g);
}

export async function deleteGasto(id: number): Promise<void> {
  await db.gastos.delete(id);
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.productos.clear(),
    db.ventas.clear(),
    db.gastos.clear(),
  ]);
}

/* ============================ DATOS DE EJEMPLO ============================ */

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function cargarDatosEjemplo(): Promise<void> {
  await clearAllData();
  const rand = mulberry32(20260912);

  const productSeeds = [
    { nombre: "Pan artesanal", categoria: "Alimentos", sku: "PAN-001", costo: 400, precio: 1200, stock: 46, umbralStock: 20 },
    { nombre: "Café molido 250g", categoria: "Alimentos", sku: "CAF-002", costo: 800, precio: 1900, stock: 25, umbralStock: 10 },
    { nombre: "Granola 500g", categoria: "Alimentos", sku: "GRN-003", costo: 600, precio: 1500, stock: 60, umbralStock: 15 },
    { nombre: "Mermelada artesanal", categoria: "Alimentos", sku: "MRM-004", costo: 500, precio: 1300, stock: 41, umbralStock: 12 },
    { nombre: "Harina sin TACC 1kg", categoria: "Alimentos", sku: "HRN-005", costo: 350, precio: 800, stock: 9, umbralStock: 15 },
    { nombre: "Aceite de oliva 500ml", categoria: "Alimentos", sku: "ACE-006", costo: 2000, precio: 3500, stock: 20, umbralStock: 8 },
    { nombre: "Miel pura 1kg", categoria: "Alimentos", sku: "MIL-007", costo: 1200, precio: 2800, stock: 30, umbralStock: 10 },
    { nombre: "Té en hebras 100g", categoria: "Bebidas", sku: "TEE-008", costo: 300, precio: 900, stock: 50, umbralStock: 20 },
    { nombre: "Queso artesanal", categoria: "Alimentos", sku: "QSO-009", costo: 1500, precio: 3200, stock: 5, umbralStock: 10 },
    { nombre: "Velas de soja", categoria: "Artículos del hogar", sku: "VLS-010", costo: 700, precio: 1800, stock: 0, umbralStock: 8 },
    { nombre: "Bolsas de tela", categoria: "Otros", sku: "BLS-011", costo: 250, precio: 600, stock: 112, umbralStock: 30 },
    { nombre: "Salsa de tomate 500ml", categoria: "Alimentos", sku: "SLS-012", costo: 450, precio: 1100, stock: 90, umbralStock: 25 },
  ];

  const clientes = [
    "Juan Pérez",
    "María Gómez",
    "Cliente mostrador",
    "Lucía Fernández",
    "Pedro Álvarez",
    "",
    "Cliente mostrador",
    "Carolina Ruiz",
    "",
  ];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowTs = now.getTime();
  const DAY = 86400000;
  const MESES_ATRAS = 8;

  const productos = await Promise.all(
    productSeeds.map((p, i) =>
      db.productos.add({ ...p, createdAt: nowTs - (MESES_ATRAS - 1) * 30 * DAY - i * 3 * DAY })
    )
  );

  const popularidad = productSeeds.map((_, i) => 0.5 + (i % 4) * 0.12 + ((i * 7) % 5) * 0.05);
  const estancados = new Set([3, 10]); // mermelada + bolsas: sin ventas recientes

  // Generar ventas en los últimos 8 meses
  for (let m = MESES_ATRAS - 1; m >= 0; m--) {
    const mesInicio = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const dias = new Date(now.getFullYear(), now.getMonth() - m + 1, 0).getDate();
    // tendencia creciente + un mes malo hace 2 meses (para recomendar ROI)
    const shock = m === 2 ? 0.45 : 1;
    const croissance = 0.75 + (MESES_ATRAS - m) * 0.06;
    const factor = shock * croissance;

    for (let d = 0; d < dias; d++) {
      const dia = new Date(mesInicio.getFullYear(), mesInicio.getMonth(), d + 1).getTime();
      if (dia > nowTs) break;
      const esFinDeSemana = [0, 6].includes(new Date(dia).getDay());
      for (let p = 0; p < productSeeds.length; p++) {
        if (estancados.has(p) && m >= 3) continue; // no vender productos estancados recientemente
        const prob = popularidad[p] * factor * (esFinDeSemana ? 1.35 : 0.75) * 0.14;
        if (rand() < prob) {
          const cantidad = 1 + Math.floor(rand() * 4);
          const precioUnitario = productSeeds[p].precio;
          const cliente = clientes[Math.floor(rand() * clientes.length)];
          const metodo = METODOS_PAGO[Math.floor(rand() * METODOS_PAGO.length)];
          const hora = 10 + Math.floor(rand() * 9);
          const ts = dia + hora * 3600000 + Math.floor(rand() * 60) * 60000;
          await db.ventas.add({
            productoId: productos[p],
            nombreProducto: productSeeds[p].nombre,
            cantidad,
            precioUnitario,
            costoUnitario: productSeeds[p].costo,
            fecha: ts,
            cliente,
            metodoPago: metodo,
          });
        }
      }
    }

    // Gastos del mes
    const mesLabel = `${mesInicio.getFullYear()}-${String(mesInicio.getMonth() + 1).padStart(2, "0")}`;

    // Insumos: compras de mercadería
    const insumos = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < insumos; i++) {
      const diaI = Math.floor(rand() * dias);
      const ts = new Date(mesInicio.getFullYear(), mesInicio.getMonth(), diaI + 1, 12 + Math.floor(rand() * 5)).getTime();
      const monto = Math.round((productSeeds[Math.floor(rand() * productSeeds.length)].costo * (20 + rand() * 60) * factor) / 50) * 50;
      await db.gastos.add({
        categoria: "Insumos",
        descripcion: `Compra insumos ${mesLabel}`,
        monto,
        fecha: ts,
        recurrente: false,
      });
    }

    // Sueldos (fijos, recurrentes)
    await db.gastos.add({
      categoria: "Sueldos",
      descripcion: "Sueldo colaborador",
      monto: 180000,
      fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), Math.min(5, dias)).getTime(),
      recurrente: true,
    });

    // Servicios: alquiler + luz + internet
    await db.gastos.add({
      categoria: "Servicios",
      descripcion: "Alquiler local",
      monto: 250000,
      fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), 1).getTime(),
      recurrente: true,
    });
    await db.gastos.add({
      categoria: "Servicios",
      descripcion: "Luz e internet",
      monto: Math.round((18000 + rand() * 9000) / 100) * 100,
      fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), Math.floor(rand() * 6)).getTime(),
      recurrente: true,
    });

    // Publicidad
    const basePub = 25000 + rand() * 20000;
    const pubAlta = m === 2 ? 95000 : basePub * (0.7 + rand() * 0.4);
    await db.gastos.add({
      categoria: "Publicidad",
      descripcion: m === 2 ? "Campaña redes sociales y ads" : "Campaña redes sociales",
      monto: Math.round(pubAlta / 100) * 100,
      fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), 8 + Math.floor(rand() * 10)).getTime(),
      recurrente: false,
    });

    // Otros
    if (rand() < 0.6) {
      await db.gastos.add({
        categoria: "Otros",
        descripcion: "Reparaciones y varios",
        monto: Math.round((8000 + rand() * 20000) / 500) * 500,
        fecha: new Date(mesInicio.getFullYear(), mesInicio.getMonth(), Math.floor(rand() * 20)).getTime(),
        recurrente: false,
      });
    }
  }
}