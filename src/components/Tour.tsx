"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  X,
} from "lucide-react";
import { GRUPOS_NAV, type ItemNav } from "@/lib/nav";
import { Button } from "@/components/ui";

interface Paso {
  tipo: "welcome" | "grupo" | "seccion" | "fin";
  key: string;
  titulo: string;
  descripcion: string;
  href?: string;
  icono?: ReactNode;
  grupoTitulo?: string;
  nroEnGrupo?: number;
  totalEnGrupo?: number;
  items?: ItemNav[];
}

export default function Tour({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);

  const pasos = useMemo<Paso[]>(() => {
    const lista: Paso[] = [
      {
        tipo: "welcome",
        key: "welcome",
        titulo: "Tu panel, de punta a punta",
        descripcion:
          "Mi Negocio organiza todo lo que hacés todos los días en 4 grupos. En este recorrido breve vamos a mirar cada sección una por una, para que sepas dónde encontrar cada cosa.",
      },
    ];
    for (const g of GRUPOS_NAV) {
      lista.push({
        tipo: "grupo",
        key: g.id,
        titulo: g.titulo,
        descripcion: g.descripcion,
        items: g.items,
        grupoTitulo: g.titulo,
      });
      g.items.forEach((it, i) => {
        const Icono = it.icon;
        lista.push({
          tipo: "seccion",
          key: it.href,
          titulo: it.label,
          descripcion: it.descripcion,
          href: it.href,
          icono: <Icono className="h-[18px] w-[18px]" />,
          grupoTitulo: g.titulo,
          nroEnGrupo: i + 1,
          totalEnGrupo: g.items.length,
        });
      });
    }
    lista.push({
      tipo: "fin",
      key: "fin",
      titulo: "La recorriste entera",
      descripcion:
        "Ya sabés dónde vive cada cosa. Si más adelante te perdés, tocá Recorrido en el menú de la izquierda y esta guía vuelve a aparecer.",
    });
    return lista;
  }, []);

  const porHref = useMemo(() => {
    const m = new Map<string, number>();
    pasos.forEach((p, i) => {
      if (p.href) m.set(p.href, i);
    });
    return m;
  }, [pasos]);

  useEffect(() => {
    const bloquea = pasos[idx]?.tipo !== "seccion";
    document.body.style.overflow = bloquea ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [pasos, idx, onClose]);

  const paso = pasos[idx];
  const total = pasos.length;
  const esGrupo = paso.tipo === "grupo";
  const esWelcome = paso.tipo === "welcome";
  const esFin = paso.tipo === "fin";
  const esSeccion = paso.tipo === "seccion";

  const ir = (i: number) => {
    const cl = Math.max(0, Math.min(total - 1, i));
    const siguiente = pasos[cl];
    if (siguiente.tipo === "seccion" && siguiente.href) {
      router.push(siguiente.href);
    }
    setIdx(cl);
  };

  const iconoBarra = esGrupo
    ? <FolderOpen className="h-[18px] w-[18px]" />
    : esFin
      ? <CheckCircle2 className="h-[18px] w-[18px]" />
      : <BookOpen className="h-[18px] w-[18px]" />;

  const footer = (
    <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Paso {idx + 1} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="white"
          size="sm"
          disabled={idx === 0}
          onClick={() => ir(idx - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        {esWelcome ? (
          <Button size="sm" onClick={() => ir(1)}>
            Comenzar
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : esGrupo ? (
          <Button
            size="sm"
            onClick={() => {
              const primero = paso.items?.[0];
              if (primero) ir(porHref.get(primero.href) ?? idx + 1);
              else ir(idx + 1);
            }}
          >
            Ver las secciones
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : esFin ? (
          <Button size="sm" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <Button size="sm" onClick={() => ir(idx + 1)}>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const cerrarBtn = (
    <button
      onClick={onClose}
      aria-label="Cerrar recorrido"
      className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      <X className="h-5 w-5" />
    </button>
  );

  if (esSeccion) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                {paso.icono}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {paso.grupoTitulo} - {paso.nroEnGrupo} de {paso.totalEnGrupo}
                </p>
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {paso.titulo}
                </p>
              </div>
            </div>
            {cerrarBtn}
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {paso.descripcion}
            </p>
          </div>
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              {iconoBarra}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Recorrido guiado
              </p>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {paso.titulo}
              </h2>
            </div>
          </div>
          {cerrarBtn}
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {paso.descripcion}
          </p>

          {esWelcome && (
            <div className="mt-5 space-y-2">
              {GRUPOS_NAV.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => ir(porHref.get(g.items[0].href) ?? 0)}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/10 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {g.titulo}
                      </span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {g.items.length}{" "}
                        {g.items.length === 1 ? "sección" : "secciones"}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </button>
              ))}
            </div>
          )}

          {esGrupo && (
            <div className="mt-5 space-y-2">
              {paso.items?.map((it) => (
                <button
                  key={it.href}
                  onClick={() => ir(porHref.get(it.href) ?? idx)}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5"
                >
                  <it.icon className="h-[18px] w-[18px] text-zinc-500 dark:text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {it.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {footer}
      </div>
    </div>
  );
}