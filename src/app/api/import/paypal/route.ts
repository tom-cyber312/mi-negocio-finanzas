import { NextResponse } from "next/server";
import type { TransaccionExterna } from "@/lib/types";

export const runtime = "nodejs";

interface PpTx {
  transaction_info?: {
    transaction_id?: string;
    transaction_initiation_date?: string;
    gross_amount?: { value?: string; currency_code?: string };
    transaction_status?: string;
  };
  payer_info?: { email_address?: string; payer_name?: { given_name?: string; surname?: string } };
}

export async function POST(req: Request) {
  const body = (await req.json()) as { clientId: string; secret: string; from: string; to: string };
  const { clientId, secret, from, to } = body || {};
  if (!clientId || !secret) return NextResponse.json({ error: "Faltan las credenciales de PayPal." }, { status: 400 });

  const startDate = new Date(from).toISOString();
  const endDate = new Date(new Date(to).getTime() + 86400000).toISOString();

  try {
    const tokenResp = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(30000),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return NextResponse.json({ error: `PayPal (token) respondió ${tokenResp.status}: ${t.slice(0, 300)}` }, { status: 502 });
    }
    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenData.access_token) return NextResponse.json({ error: "No se pudo obtener token de PayPal." }, { status: 502 });

    const url = `https://api-m.paypal.com/v1/reporting/transactions?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&fields=all&page_size=1000`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({ error: `PayPal respondió ${resp.status}: ${t.slice(0, 300)}` }, { status: 502 });
    }
    const data = (await resp.json()) as { transaction_details?: PpTx[] };
    const out: TransaccionExterna[] = [];
    for (const tx of data.transaction_details || []) {
      const info = tx.transaction_info;
      if (!info?.transaction_id) continue;
      if (info.transaction_status && !["S", "Completed"].includes(info.transaction_status)) continue;
      const name = tx.payer_info?.payer_name
        ? `${tx.payer_info.payer_name.given_name || ""} ${tx.payer_info.payer_name.surname || ""}`.trim()
        : "";
      out.push({
        externalId: `paypal_${info.transaction_id}`,
        fecha: new Date(info.transaction_initiation_date || "").getTime() || Date.now(),
        monto: parseFloat(info.gross_amount?.value || "0") || 0,
        moneda: (info.gross_amount?.currency_code || "USD").toUpperCase(),
        concepto: `Pago PayPal ${info.transaction_id}`,
        cliente: name || tx.payer_info?.email_address || "",
        metodoPago: "Otro",
      });
    }
    return NextResponse.json({ transacciones: out });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}