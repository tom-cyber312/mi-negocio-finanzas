import { NextResponse } from "next/server";
import type { TransaccionExterna } from "@/lib/types";

export const runtime = "nodejs";

interface StripeCharge {
  id: string;
  created: number;
  amount: number;
  currency: string;
  paid: boolean;
  status: string;
  description?: string | null;
  receipt_email?: string | null;
  billing_details?: { name?: string | null; email?: string | null };
  payment_method_details?: { type?: string };
}

export async function POST(req: Request) {
  const body = (await req.json()) as { secretKey?: string; from: string; to: string };
  const { secretKey, from, to } = body || {};
  // Prioridad: clave enviada por el cliente, o clave del servidor (env Vercel).
  let secret = secretKey;
  if (!secret) secret = process.env.STRIPE_SECRET_KEY;
  if (!secret)
    return NextResponse.json(
      { error: "No hay clave de Stripe: cargala en la app o configurá la variable STRIPE_SECRET_KEY en Vercel." },
      { status: 400 }
    );

  const gte = Math.floor(new Date(from).getTime() / 1000);
  const lte = Math.floor(new Date(to).getTime() / 1000);

  const params = new URLSearchParams({
    limit: "100",
    "created[gte]": String(gte),
    "created[lte]": String(lte),
    expand: "data.billing_details",
  });

  try {
    const resp = await fetch(`https://api.stripe.com/v1/charges?${params.toString()}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({ error: `Stripe respondió ${resp.status}: ${t.slice(0, 300)}` }, { status: 502 });
    }
    const data = (await resp.json()) as { data?: StripeCharge[]; has_more?: boolean };
    const out: TransaccionExterna[] = [];
    for (const c of data.data || []) {
      if (!c.paid || c.status !== "succeeded") continue;
      const metodo = c.payment_method_details?.type
        ? c.payment_method_details.type.charAt(0).toUpperCase() + c.payment_method_details.type.slice(1)
        : "Tarjeta";
      out.push({
        externalId: `stripe_${c.id}`,
        fecha: c.created * 1000,
        monto: c.amount / 100,
        moneda: (c.currency || "USD").toUpperCase(),
        concepto: c.description || `Pago Stripe ${c.id}`,
        cliente: c.billing_details?.name || c.receipt_email || c.billing_details?.email || "",
        metodoPago: metodo === "Card" ? "Tarjeta" : metodo === "Transferencia" ? "Transferencia" : "Otro",
      });
    }
    return NextResponse.json({
      transacciones: out,
      hasMore: data.has_more === true,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}