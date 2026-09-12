import { NextResponse } from "next/server";
import type { TransaccionExterna } from "@/lib/types";

export const runtime = "nodejs";

interface MpPago {
  id: number;
  status: string;
  status_detail: string;
  date_created: string;
  transaction_amount: number;
  currency_id: string;
  description?: string;
  payment_method_id?: string;
  payer?: { email?: string; first_name?: string };
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    token?: string;
    from: string;
    to: string;
  };
  const { token, from, to } = body || {};
  // Prioridad: token enviado por el cliente, o token del servidor (env de Vercel).
  let secret = token;
  if (!secret) secret = process.env.MP_ACCESS_TOKEN;
  if (!secret)
    return NextResponse.json(
      { error: "No hay token de Mercado Pago: cargalo en la app o configurá la variable MP_ACCESS_TOKEN en Vercel." },
      { status: 400 }
    );

  const out: TransaccionExterna[] = [];
  let error: string | null = null;

  // La API de MP limita el rango a 31 días: partimos en tramos mensuales.
  const parts: { b: Date; e: Date }[] = [];
  let cursor = new Date(from);
  const endDate = new Date(to);
  while (cursor <= endDate) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setMonth(chunkEnd.getMonth() + 1);
    parts.push({
      b: cursor,
      e: chunkEnd < endDate ? chunkEnd : endDate,
    });
    cursor = new Date(chunkEnd);
    cursor.setDate(1);
  }

  for (const part of parts) {
    const begin = part.b.toISOString();
    const endDateStr = new Date(part.e.getTime() + 86400000).toISOString();
    const url = `https://api.mercadopago.com/v1/payments/search?limit=500&range=date_created&begin_date=${encodeURIComponent(begin)}&end_date=${encodeURIComponent(endDateStr)}`;
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        const t = await resp.text();
        error = `Mercado Pago respondió ${resp.status}: ${t.slice(0, 300)}`;
        break;
      }
      const data = (await resp.json()) as { results?: MpPago[] };
      for (const p of data.results || []) {
        if (p.status !== "approved") continue;
        out.push({
          externalId: `mp_${p.id}`,
          fecha: new Date(p.date_created).getTime(),
          monto: p.transaction_amount,
          moneda: p.currency_id || "ARS",
          concepto: p.description || `Pago Mercado Pago #${p.id}`,
          cliente: p.payer?.first_name || p.payer?.email || "",
          metodoPago: "Mercado Pago",
        });
      }
    } catch (e) {
      error = (e as Error).message;
      break;
    }
  }

  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ transacciones: out });
}