"use client";

import { FileText, Sparkles, CloudUpload, X } from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Informes PDF profesionales",
    desc: "Informe mensual con portada, resumen, mejores productos, gastos por categoría y métodos de pago, en un PDF listo para compartir.",
  },
  {
    icon: Sparkles,
    title: "Recomendaciones IA",
    desc: "Pedile a tu modelo de lenguaje favorito recomendaciones finas sobre tus datos, sin salir de la app.",
  },
  {
    icon: CloudUpload,
    title: "Copias de seguridad en la nube",
    desc: "Respaldo automático y cifrado de tu negocio en la nube, con restauración desde cualquier dispositivo.",
  },
];

export default function ProModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Plan Pro
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="rounded-xl bg-gradient-to-br from-amber-500/15 to-emerald-500/15 p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Desbloqueá todas las funciones Pro
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Una licencia por negocio, activable desde Ajustes. Sin
              renovaciones automáticas.
            </p>
          </div>
          <div className="space-y-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {f.title}
                    </p>
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {f.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              ¿Cómo consigo mi licencia?
            </p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Contactame para coordinar el pago.</li>
              <li>Te entrego una clave de licencia.</li>
              <li>La activás en Ajustes → Plan Pro.</li>
            </ol>
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}