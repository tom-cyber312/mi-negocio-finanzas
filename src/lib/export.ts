import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Factura, FiscalConfig, Gasto, Producto, Venta } from "./types";
import { CURRENCIES, currencyCode, fmtDate, fmtDateTime, MESES } from "./format";
import { calcularIva, condicionTitulo } from "./fiscal";
import { guardarArchivo } from "./download";

function money(n: number): string {
  const c = CURRENCIES.find((x) => x.code === currencyCode());
  return new Intl.NumberFormat(c?.locale || "es-AR", {
    style: "currency",
    currency: c?.code || "ARS",
    maximumFractionDigits: (c?.code || "ARS") === "CLP" ? 0 : 2,
  }).format(n);
}

function agregarHojaExcel(
  wb: ExcelJS.Workbook,
  nombre: string,
  encabezados: string[],
  filas: unknown[][]
): void {
  const ws = wb.addWorksheet(nombre);
  ws.addRow(encabezados).font = { bold: true };
  filas.forEach((f) => ws.addRow(f));
  ws.columns.forEach((col, i) => {
    const max = filas.reduce(
      (m, f) => Math.max(m, String(f[i] ?? "").length),
      encabezados[i]?.length ?? 0
    );
    col.width = Math.min(Math.max(max + 2, 12), 40);
  });
  ws.getRow(1).height = 20;
}

async function guardarWorkbook(
  wb: ExcelJS.Workbook,
  nombre: string
): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  await guardarArchivo({
    nombre,
    data: new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  });
}

export async function exportarExcelGeneral(
  productos: Producto[],
  ventas: Venta[],
  gastos: Gasto[],
  filename = "reporte"
) {
  const wb = new ExcelJS.Workbook();

  agregarHojaExcel(
    wb,
    "Productos",
    [
      "Nombre",
      "Categoría",
      "SKU",
      "Costo",
      "Precio venta",
      "Margen %",
      "Stock",
      "Umbral",
      "Costo invertido",
      "Ganancia potencial",
    ],
    productos.map((p) => [
      p.nombre,
      p.categoria,
      p.sku,
      p.costo,
      p.precio,
      p.precio ? +(((p.precio - p.costo) / p.precio) * 100).toFixed(1) : 0,
      p.stock,
      p.umbralStock,
      +(p.costo * p.stock).toFixed(2),
      +((p.precio - p.costo) * p.stock).toFixed(2),
    ])
  );

  agregarHojaExcel(
    wb,
    "Ventas",
    [
      "Fecha",
      "Producto",
      "Cantidad",
      "Precio unitario",
      "Total",
      "Costo venta",
      "Ganancia",
      "Cliente",
      "Método de pago",
    ],
    ventas.map((v) => [
      fmtDateTime(v.fecha),
      v.nombreProducto,
      v.cantidad,
      v.precioUnitario,
      +(v.cantidad * v.precioUnitario).toFixed(2),
      +(v.cantidad * v.costoUnitario).toFixed(2),
      +((v.precioUnitario - v.costoUnitario) * v.cantidad).toFixed(2),
      v.cliente || "",
      v.metodoPago,
    ])
  );

  agregarHojaExcel(
    wb,
    "Gastos",
    ["Fecha", "Categoría", "Descripción", "Monto", "Recurrente"],
    gastos.map((g) => [
      fmtDate(g.fecha),
      g.categoria,
      g.descripcion,
      g.monto,
      g.recurrente ? "Sí" : "No",
    ])
  );

  await guardarWorkbook(wb, `${filename}.xlsx`);
}

export async function exportarExcelMensual(
  year: number,
  monthIdx: number,
  ventas: Venta[],
  gastos: Gasto[],
  ingresos: number,
  egresos: number
) {
  const wb = new ExcelJS.Workbook();

  agregarHojaExcel(
    wb,
    "Resumen",
    ["Concepto", "Valor"],
    [
      ["Mes", `${MESES[monthIdx]} ${year}`],
      ["Ingresos", ingresos],
      ["Egresos", egresos],
      ["Balance neto", ingresos - egresos],
    ]
  );

  agregarHojaExcel(
    wb,
    "Ventas",
    [
      "Fecha",
      "Producto",
      "Cantidad",
      "Precio unitario",
      "Total",
      "Cliente",
      "Método de pago",
    ],
    ventas.map((v) => [
      fmtDateTime(v.fecha),
      v.nombreProducto,
      v.cantidad,
      v.precioUnitario,
      +(v.cantidad * v.precioUnitario).toFixed(2),
      v.cliente || "",
      v.metodoPago,
    ])
  );

  agregarHojaExcel(
    wb,
    "Gastos",
    ["Fecha", "Categoría", "Descripción", "Monto", "Recurrente"],
    gastos.map((g) => [
      fmtDate(g.fecha),
      g.categoria,
      g.descripcion,
      g.monto,
      g.recurrente ? "Sí" : "No",
    ])
  );

  await guardarWorkbook(
    wb,
    `reporte-${MESES[monthIdx].toLowerCase()}-${year}.xlsx`
  );
}

export async function exportarPDFMensual(
  year: number,
  monthIdx: number,
  ventas: Venta[],
  gastos: Gasto[],
  ingresos: number,
  egresos: number
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Reporte Mensual — ${MESES[monthIdx]} ${year}`, 14, 16);
  doc.setFontSize(10);
  doc.text(`Generado el ${fmtDate(Date.now())}`, 14, 22);

  type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };
const lastY = (doc: jsPDF, fallback: number): number =>
  (doc as DocWithTable).lastAutoTable?.finalY ?? fallback;

autoTable(doc, {
    startY: 28,
    head: [["Concepto", "Monto"]],
    body: [
      ["Ingresos", money(ingresos)],
      ["Egresos", money(egresos)],
      ["Balance neto", money(ingresos - egresos)],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
  });

  if (ventas.length) {
    autoTable(doc, {
      startY: lastY(doc, 28) + 8,
      head: [["Fecha", "Producto", "Cantidad", "P. Unit", "Total", "Cliente"]],
      body: ventas
        .sort((a, b) => a.fecha - b.fecha)
        .map((v) => [
          fmtDateTime(v.fecha),
          v.nombreProducto,
          String(v.cantidad),
          money(v.precioUnitario),
          money(v.cantidad * v.precioUnitario),
          v.cliente || "—",
        ]),
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 },
    });
  }

  if (gastos.length) {
    autoTable(doc, {
      startY: lastY(doc, 80) + 8,
      head: [["Fecha", "Categoría", "Descripción", "Monto"]],
      body: gastos
        .sort((a, b) => a.fecha - b.fecha)
        .map((g) => [
          fmtDate(g.fecha),
          g.categoria,
          g.descripcion,
          money(g.monto),
        ]),
      headStyles: { fillColor: [139, 92, 246] },
      styles: { fontSize: 8 },
    });
  }

  await guardarArchivo({
    nombre: `reporte-${MESES[monthIdx].toLowerCase()}-${year}.pdf`,
    data: doc.output("blob"),
  });
}

export async function generarFacturaPDF(f: Factura, fiscal: FiscalConfig) {
  const doc = new jsPDF();
  const iva = f.letra === "A" ? calcularIva(f.monto, fiscal.ivaPct, true) : 0;
  const neto = f.monto - iva;

  doc.setFontSize(14);
  doc.text("FACTURA", 14, 16);
  doc.setFontSize(9);
  doc.text(`Letra ${f.letra} — N° ${f.numero}`, 14, 22);
  doc.text(`Fecha: ${fmtDate(f.fecha)}`, 14, 27);
  doc.text(`Condición IVA: ${condicionTitulo(fiscal.condicionIva)}`, 14, 32);

  doc.setFontSize(10);
  doc.text("Datos del emisor", 14, 42);
  doc.setFontSize(9);
  doc.text(fiscal.razonSocial || "Mi Negocio", 14, 47);
  doc.text(`CUIT: ${fiscal.cuit || "—"}`, 14, 52);
  doc.text(`${fiscal.direccion || ""} ${fiscal.localidad || ""}`.trim(), 14, 57);
  doc.text(`Punto de venta: ${fiscal.ptoVenta || "0001"}`, 14, 62);

  doc.setFontSize(10);
  doc.text("Datos del cliente", 14, 72);
  doc.setFontSize(9);
  doc.text(f.cliente || "Consumidor final", 14, 77);
  doc.text(`CUIT: ${f.cuit || "—"}`, 14, 82);

  autoTable(doc, {
    startY: 90,
    head: [["Detalle", "Importe"]],
    body: [
      ["Subtotal (neto)", money(neto)],
      ...(f.letra === "A" ? [["IVA", money(iva)]] : []),
      ["Total", money(f.monto)],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
  });

  doc.setFontSize(9);
  let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  y += 8;
  doc.text(f.detalle, 14, y);

  await guardarArchivo({
    nombre: `factura-${f.letra}-${f.numero.replace(/\s+/g, "-")}.pdf`,
    data: doc.output("blob"),
  });
}

/** Informe mensual "Pro": portada con resumen, mejores productos, gastos
 * por categoría, métodos de pago y estado general del negocio. */
export async function exportarPDFInformePro(
  year: number,
  monthIdx: number,
  ventas: Venta[],
  gastos: Gasto[],
  ingresos: number,
  egresos: number,
  productos: Producto[],
  negocioNombre = "Mi Negocio"
) {
  const doc = new jsPDF({ format: "a4" });

  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("INFORME MENSUAL PROFESIONAL", 14, 12);
  doc.setFontSize(10);
  doc.text(negocioNombre, 14, 18);
  doc.text(`${MESES[monthIdx]} ${year}`, 196, 18, { align: "right" });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(9);
  doc.text(`Generado el ${fmtDate(Date.now())} por Mi Negocio — Finanzas`, 14, 34);

  type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };
  const lastY = (d: jsPDF, fb: number): number =>
    (d as DocWithTable).lastAutoTable?.finalY ?? fb;

  autoTable(doc, {
    startY: 38,
    head: [["Concepto", "Monto"]],
    body: [
      ["Ingresos del mes", money(ingresos)],
      ["Egresos del mes", money(egresos)],
    ],
    foot: [["Balance neto", money(ingresos - egresos)]],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
    footStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
  });

  const top = topProductosMes(ventas).slice(0, 8);
  if (top.length) {
    autoTable(doc, {
      startY: lastY(doc, 52) + 8,
      head: [["Producto", "Unidades", "Venta total", "Utilidad"]],
      body: top.map((p) => [p.nombre, String(p.cant), money(p.total), money(p.util)]),
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 9 },
    });
  }

  const catGasto = new Map<string, number>();
  for (const g of gastos) catGasto.set(g.categoria, (catGasto.get(g.categoria) || 0) + g.monto);
  if (catGasto.size) {
    autoTable(doc, {
      startY: lastY(doc, 60) + 8,
      head: [["Gastos por categoría", "Monto"]],
      body: Array.from(catGasto.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([c, m]) => [c, money(m)]),
      headStyles: { fillColor: [139, 92, 246] },
      styles: { fontSize: 9 },
    });
  }

  const met = new Map<string, number>();
  for (const v of ventas) met.set(v.metodoPago, (met.get(v.metodoPago) || 0) + v.cantidad * v.precioUnitario);
  if (met.size) {
    autoTable(doc, {
      startY: lastY(doc, 60) + 8,
      head: [["Método de pago", "Monto"]],
      body: Array.from(met.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([m, t]) => [m, money(t)]),
      headStyles: { fillColor: [251, 191, 36], textColor: 0 },
      styles: { fontSize: 9 },
    });
  }

  autoTable(doc, {
    startY: lastY(doc, 60) + 8,
    body: [
      [
        `Estado general: ${ventas.length} ventas, ${gastos.length} gastos, ${productos.length} productos relevados.`,
        "",
      ],
    ],
    theme: "plain",
    styles: { fontSize: 9, textColor: [82, 82, 91] },
  });

  await guardarArchivo({
    nombre: `informe-pro-${MESES[monthIdx].toLowerCase()}-${year}.pdf`,
    data: doc.output("blob"),
  });
}

function topProductosMes(ventas: Venta[]): {
  nombre: string;
  cant: number;
  total: number;
  util: number;
}[] {
  const map = new Map<string, { nombre: string; cant: number; total: number; util: number }>();
  for (const v of ventas) {
    const cur =
      map.get(v.nombreProducto) || {
        nombre: v.nombreProducto,
        cant: 0,
        total: 0,
        util: 0,
      };
    cur.cant += v.cantidad;
    cur.total += v.cantidad * v.precioUnitario;
    cur.util = (v.precioUnitario - v.costoUnitario) * v.cantidad + cur.util;
    map.set(v.nombreProducto, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.util - a.util);
}