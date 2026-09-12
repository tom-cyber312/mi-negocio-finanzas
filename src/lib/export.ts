import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Gasto, Producto, Venta } from "./types";
import { CURRENCIES, currencyCode, fmtDate, fmtDateTime, MESES } from "./format";

function money(n: number): string {
  const c = CURRENCIES.find((x) => x.code === currencyCode());
  return new Intl.NumberFormat(c?.locale || "es-AR", {
    style: "currency",
    currency: c?.code || "ARS",
    maximumFractionDigits: (c?.code || "ARS") === "CLP" ? 0 : 2,
  }).format(n);
}

export function exportarExcelGeneral(
  productos: Producto[],
  ventas: Venta[],
  gastos: Gasto[],
  filename = "reporte"
) {
  const wb = XLSX.utils.book_new();

  const prodRows = productos.map((p) => ({
    Nombre: p.nombre,
    Categoría: p.categoria,
    SKU: p.sku,
    Costo: p.costo,
    "Precio venta": p.precio,
    "Margen %": p.precio ? +(((p.precio - p.costo) / p.precio) * 100).toFixed(1) : 0,
    Stock: p.stock,
    Umbral: p.umbralStock,
    "Costo invertido": +(p.costo * p.stock).toFixed(2),
    "Ganancia potencial": +((p.precio - p.costo) * p.stock).toFixed(2),
  }));
  const ventaRows = ventas.map((v) => ({
    Fecha: fmtDateTime(v.fecha),
    Producto: v.nombreProducto,
    Cantidad: v.cantidad,
    "Precio unitario": v.precioUnitario,
    Total: +(v.cantidad * v.precioUnitario).toFixed(2),
    "Costo venta": +(v.cantidad * v.costoUnitario).toFixed(2),
    "Ganancia": +((v.precioUnitario - v.costoUnitario) * v.cantidad).toFixed(2),
    Cliente: v.cliente || "",
    "Método de pago": v.metodoPago,
  }));
  const gastoRows = gastos.map((g) => ({
    Fecha: fmtDate(g.fecha),
    Categoría: g.categoria,
    Descripción: g.descripcion,
    Monto: g.monto,
    Recurrente: g.recurrente ? "Sí" : "No",
  }));

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(prodRows),
    "Productos"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(ventaRows),
    "Ventas"
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastoRows), "Gastos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportarExcelMensual(
  year: number,
  monthIdx: number,
  ventas: Venta[],
  gastos: Gasto[],
  ingresos: number,
  egresos: number
) {
  const wb = XLSX.utils.book_new();
  const resumen = [
    { Concepto: "Mes", Valor: `${MESES[monthIdx]} ${year}` },
    { Concepto: "Ingresos", Valor: ingresos },
    { Concepto: "Egresos", Valor: egresos },
    { Concepto: "Balance neto", Valor: ingresos - egresos },
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(resumen),
    "Resumen"
  );

  const ventaRows = ventas.map((v) => ({
    Fecha: fmtDateTime(v.fecha),
    Producto: v.nombreProducto,
    Cantidad: v.cantidad,
    "Precio unitario": v.precioUnitario,
    Total: +(v.cantidad * v.precioUnitario).toFixed(2),
    Cliente: v.cliente || "",
    "Método de pago": v.metodoPago,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(ventaRows),
    "Ventas"
  );

  const gastoRows = gastos.map((g) => ({
    Fecha: fmtDate(g.fecha),
    Categoría: g.categoria,
    Descripción: g.descripcion,
    Monto: g.monto,
    Recurrente: g.recurrente ? "Sí" : "No",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(gastoRows),
    "Gastos"
  );

  XLSX.writeFile(wb, `reporte-${MESES[monthIdx].toLowerCase()}-${year}.xlsx`);
}

export function exportarPDFMensual(
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

  doc.save(`reporte-${MESES[monthIdx].toLowerCase()}-${year}.pdf`);
}