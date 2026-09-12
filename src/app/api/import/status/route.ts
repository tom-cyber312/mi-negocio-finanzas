import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Informa (sin exponer valores) si el deploy tiene claves configuradas
// como variables de entorno (Vercel). Los tokens no salen del servidor.
export function GET() {
  return NextResponse.json({
    mp: !!process.env.MP_ACCESS_TOKEN,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    paypal: !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_SECRET,
  });
}