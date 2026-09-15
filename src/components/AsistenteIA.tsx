"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Crown,
  KeyRound,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { tienePro } from "@/lib/license";
import {
  SLOTS,
  borrarSecreto,
  claveDisponible,
  guardarSecreto,
  haySecretoGuardado,
} from "@/lib/secureStore";
import { construirPromptParaIA, type DatosParaAnalisis } from "@/lib/recommendations";
import ProModal from "@/components/ProModal";
import { Button, Card, CardHeader } from "@/components/ui";

const URL_DEFECTO = "https://api.openai.com/v1/chat/completions";

export default function AsistenteIA({
  datos,
}: {
  datos: DatosParaAnalisis | null;
}) {
  const [proOpen, setProOpen] = useState(false);
  const [url, setUrl] = useState(URL_DEFECTO);
  const [modelo, setModelo] = useState("gpt-4o-mini");
  const [key, setKey] = useState("");
  const [guardarClaveLocal, setGuardarClaveLocal] = useState(false);
  const [tieneClaveGuardada, setTieneClaveGuardada] = useState(() =>
    haySecretoGuardado(SLOTS.ia)
  );
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    if (!datos) return "";
    return construirPromptParaIA(datos);
  }, [datos]);

  const generar = useCallback(async () => {
    if (!prompt) return;
    setGenerando(true);
    setErr(null);
    try {
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          modelo,
          ...(key.trim() ? { apiKey: key.trim() } : {}),
          prompt: `Sos un asesor de negocios. Analizá el contexto del negocio y devolvé 2 o 3 recomendaciones prácticas y concretas en español, con una accion puntual en cada una. Formato:\n1) Título breve\nDescripción + acción.\n\nCONTEXTO:\n${prompt}`,
        }),
      });
      const data = (await res.json()) as { texto?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Error al generar.");
      setResultado(data.texto || "");
      if (guardarClaveLocal && key.trim()) {
        if (claveDisponible()) {
          try {
            await guardarSecreto(SLOTS.ia, key.trim());
            setTieneClaveGuardada(true);
          } catch {
            // si no hay sesión de claves, guardamos igual en memoria la próxima
          }
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setGenerando(false);
    }
  }, [prompt, url, modelo, key, guardarClaveLocal]);

  if (!tienePro()) {
    return (
      <Card className="mt-6">
        <CardHeader
          title="Asistente IA"
          subtitle="Recomendaciones finas generadas por un modelo de lenguaje con tus datos."
          right={
            <Button onClick={() => setProOpen(true)}>
              <Crown className="h-4 w-4" /> Desbloquear con Pro
            </Button>
          }
        />
        <div className="px-5 py-6">
          <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center dark:border-zinc-700">
            <Sparkles className="mx-auto h-7 w-7 text-amber-500" />
            <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Disponible en el Plan Pro
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Activá tu licencia en Ajustes → Plan Pro para usar tu modelo de
              lenguaje favorito dentro de la app.
            </p>
          </div>
        </div>
        <ProModal open={proOpen} onClose={() => setProOpen(false)} />
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title="Asistente IA"
        subtitle="Conectá un modelo de lenguaje (compatible con la API de OpenAI). La clave viaja cifrada solo dentro de tu sesión."
      />
      <div className="space-y-3 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              URL del proveedor
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder={URL_DEFECTO}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Modelo
            </span>
            <input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="gpt-4o-mini"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            API key (no se guarda salvo que lo pidas)
          </span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder="sk-…"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={guardarClaveLocal}
              onChange={(e) => setGuardarClaveLocal(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-600"
            />
            <KeyRound className="h-3.5 w-3.5" />
            Recordar esta clave en este dispositivo (cifrada con tu contraseña)
          </label>
          {tieneClaveGuardada && (
            <button
              onClick={() => {
                borrarSecreto(SLOTS.ia);
                setTieneClaveGuardada(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Olvidar clave guardada
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            disabled={generando || !prompt}
            onClick={() => void generar()}
          >
            {generando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generando ? "Analizando…" : "Generar recomendaciones"}
          </Button>
          {!generando && resultado && (
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(resultado)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => {});
              }}
              className="rounded-lg bg-zinc-100 p-2 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              title="Copiar resultado"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {err && (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
            {err}
          </p>
        )}
        {resultado && (
          <pre className="whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 text-xs leading-relaxed text-emerald-300 dark:bg-black">
            {resultado}
          </pre>
        )}
        {!resultado && !err && (
          <p className="text-[11px] text-zinc-400">
            La recomendación se arma con los últimos 6 meses y el estado actual
            de tus productos. Consumís créditos de la API de tu proveedor.
          </p>
        )}
      </div>
    </Card>
  );
}