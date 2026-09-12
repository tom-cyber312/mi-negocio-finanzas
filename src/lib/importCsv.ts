import type { TransaccionExterna } from "./types";

function limpiarHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-záéíóúñü0-9 ]/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (field.length || row.length) row.push(field);
      if (row.length) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function num(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.,\-]/g, "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function tsDeFecha(v: string): number {
  const s = String(v).trim();
  if (!s) return Date.now();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();
  const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const dd = new Date(year, month - 1, day, 12);
    if (!isNaN(dd.getTime())) return dd.getTime();
  }
  return Date.now();
}

export interface ResultadoCsv {
  transacciones: TransaccionExterna[];
  ignoradas: number;
}

export function parseCsvTransacciones(text: string): ResultadoCsv {
  const rows = parseCsv(text);
  if (!rows.length) return { transacciones: [], ignoradas: 0 };
  const header = rows[0].map(limpiarHeader);

  const idx = (keys: string[]): number =>
    header.findIndex((h) => keys.some((k) => h.includes(k)));
  const iFecha = idx(["fecha", "date", "created", "dia"]);
  const iMonto = idx(["monto", "importe", "amount", "total", "precio", "valor"]);
  const iConcepto = idx(["concepto", "descripcion", "description", "concept", "detalle", "detalle", "nombre"]);
  const iCliente = idx(["cliente", "payer", "customer", "buyer", "client", "email", "comprador"]);
  const iMetodo = idx(["metodo", "metodo de pago", "payment method", "method", "metodo_de_pago", "channel", "tipo"]);

  if (iMonto === -1) return { transacciones: [], ignoradas: rows.length - 1 };

  const out: TransaccionExterna[] = [];
  let ignoradas = 0;
  for (let r = 1; r < rows.length; r++) {
    const raw = rows[r];
    if (!raw.length) continue;
    const get = (i: number) => (i >= 0 && i < raw.length ? raw[i].trim() : "");
    const monto = num(get(iMonto));
    if (monto <= 0) {
      ignoradas++;
      continue; // filas de comisiones, impuestos, etc.
    }
    const f = get(iFecha);
    const c = get(iConcepto);
    const cliente = get(iCliente);
    const metodoNombre = get(iMetodo).toLowerCase();
    let metodo: TransaccionExterna["metodoPago"] = "Tarjeta";
    if (metodoNombre.includes("efectivo") || metodoNombre.includes("cash")) metodo = "Efectivo";
    else if (metodoNombre.includes("transfer") || metodoNombre.includes("bank")) metodo = "Transferencia";
    else if (metodoNombre.includes("mercad")) metodo = "Mercado Pago";
    else if (metodoNombre.includes("paypal")) metodo = "Tarjeta";
    const idBase = `${f || "x"}_${raw.join("_")}`.replace(/\s+/g, "");
    out.push({
      externalId: `csv_${idBase.slice(-40)}`,
      fecha: tsDeFecha(f),
      monto,
      moneda: "ARS",
      concepto: c || "Venta importada",
      cliente,
      metodoPago: metodo,
    });
  }
  return { transacciones: out, ignoradas };
}