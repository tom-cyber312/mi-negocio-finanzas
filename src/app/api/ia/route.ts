import { NextResponse } from "next/server";

const IA_URL_DEFAULT = "https://api.openai.com/v1/chat/completions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { url?: string; apiKey?: string; modelo?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt || prompt.length > 60000) {
    return NextResponse.json(
      { error: "El contexto está vacío o es demasiado grande." },
      { status: 400 }
    );
  }

  const url = body.url?.trim() || IA_URL_DEFAULT;
  const apiKey = body.apiKey?.trim() || process.env.IA_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta la clave de la IA. Pegá tu API key en el asistente o configurá IA_API_KEY en el servidor.",
      },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: body.modelo?.trim() || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 900,
      }),
      // Límite razonable para no colgar la petición
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const detalle = (await res.text()).slice(0, 300);
      return NextResponse.json(
        { error: `El proveedor respondió con estado ${res.status}. ${detalle}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const texto = data.choices?.[0]?.message?.content ?? "";
    if (!texto) {
      return NextResponse.json(
        { error: "El modelo no devolvió contenido." },
        { status: 502 }
      );
    }
    return NextResponse.json({ texto });
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json(
      { error: `No se pudo contactar el proveedor. ${m}`.trim() },
      { status: 502 }
    );
  }
}