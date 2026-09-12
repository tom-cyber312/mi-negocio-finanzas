"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  Download,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Package,
  Plug,
  Receipt,
  Settings,
  ShoppingCart,
  Sparkles,
  Sun,
  Target,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button, ConfirmDialog, Field, Input, Select } from "@/components/ui";
import { CURRENCIES } from "@/lib/format";
import { cargarDatosEjemplo, clearAllData, exportarBackup, importarBackup } from "@/lib/db";

const NAV = [
  { href: "/dashboard", label: "Dashboard General", icon: LayoutDashboard },
  { href: "/dashboard-mensual", label: "Dashboard Mensual", icon: CalendarRange },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/gastos", label: "Gastos", icon: Wallet },
  { href: "/presupuestos", label: "Presupuestos", icon: Target },
  { href: "/facturacion", label: "Facturación", icon: Receipt },
  { href: "/integraciones", label: "Integraciones", icon: Plug },
  { href: "/recomendaciones", label: "Recomendaciones", icon: Sparkles },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard General",
  "/dashboard-mensual": "Dashboard Mensual",
  "/productos": "Productos e Inventario",
  "/ventas": "Ventas e Ingresos",
  "/gastos": "Gastos / Egresos",
  "/presupuestos": "Presupuestos y control de gasto",
  "/facturacion": "Facturación y cumplimiento fiscal",
  "/integraciones": "Integraciones externas",
  "/recomendaciones": "Recomendaciones inteligentes",
};

function PasswordForm({
  mode,
  onDone,
}: {
  mode: "create" | "enter";
  onDone: (pw: string) => Promise<boolean> | Promise<void>;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (mode === "create") {
      if (pw.length < 4) return setErr("Usá al menos 4 caracteres.");
      if (pw !== pw2) return setErr("Las contraseñas no coinciden.");
    }
    setBusy(true);
    const ok = (await onDone(pw)) as boolean;
    setBusy(false);
    if (ok === false) setErr("Contraseña incorrecta.");
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      {mode === "create" ? (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Primera vez por aquí. Creá una contraseña para proteger tus datos
            financieros. Se guarda cifrada (hash) en este navegador.
          </p>
          <Field label="Contraseña">
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </Field>
          <Field label="Repetir contraseña">
            <Input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        </>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ingresá tu contraseña para desbloquear la aplicación.
        </p>
      )}
      {mode === "enter" && (
        <Field label="Contraseña">
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
            autoFocus
          />
        </Field>
      )}
      {err && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          {err}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy
          ? "Verificando…"
          : mode === "create"
            ? "Crear contraseña"
            : "Desbloquear"}
      </Button>
      {mode === "enter" && (
        <p className="text-center text-[11px] text-zinc-400">
          ¿Olvidaste la contraseña? Podés resetearla borrando el almacenamiento
          del navegador para este sitio.
        </p>
      )}
    </form>
  );
}

function LoginScreen() {
  const { phase, createPassword, login } = useApp();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Mi Negocio — Finanzas
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Tu panel financiero personal
          </p>
        </div>
        {phase === "setup" ? (
          <PasswordForm mode="create" onDone={createPassword} />
        ) : (
          <PasswordForm mode="enter" onDone={login} />
        )}
      </div>
    </div>
  );
}

function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { currency, setCurrencyCode, theme, toggleTheme, changePassword } =
    useApp();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  if (!open) return null;

  const changePwSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (newPw.length < 4) return setErr("La nueva contraseña debe tener al menos 4 caracteres.");
    if (newPw !== confirmPw) return setErr("La nueva contraseña no coincide.");
    const ok = await changePassword(oldPw, newPw);
    if (ok) {
      setMsg("Contraseña actualizada.");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } else {
      setErr("La contraseña actual es incorrecta.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Ajustes
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-6 px-5 py-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Apariencia y moneda
            </h3>
            <div className="flex flex-col gap-3">
              <Field label="Moneda">
                <Select value={currency} onChange={(e) => setCurrencyCode(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label} ({c.symbol})
                    </option>
                  ))}
                </Select>
              </Field>
              <Button variant="white" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Modo claro" : "Modo oscuro"}
              </Button>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Datos
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="white"
                onClick={() => {
                  cargarDatosEjemplo().then(() => {
                    setMsg("Datos de ejemplo cargados.");
                    onClose();
                    window.location.reload();
                  });
                }}
              >
                Cargar datos de ejemplo
              </Button>
              <Button variant="white" onClick={exportarBackup} title="Descargar respaldo JSON de la base local">
                <Download className="h-4 w-4" /> Exportar respaldo
              </Button>
              <label
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800"
              >
                <Upload className="h-4 w-4" />
                Importar respaldo
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      await importarBackup(file);
                      setMsg("Respaldo importado correctamente.");
                      onClose();
                      window.location.reload();
                    } catch {
                      setErr("No se pudo importar el respaldo. Revisá el archivo.");
                    }
                  }}
                />
              </label>
              <Button variant="white" onClick={() => setConfirmWipe(true)}>
                Borrar todos los datos
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Los datos se guardan localmente en este navegador (IndexedDB). El
              respaldo te permite exportarlos y restaurarlos en cualquier
              dispositivo.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Seguridad
            </h3>
            <form onSubmit={changePwSubmit} className="space-y-3">
              <Field label="Contraseña actual">
                <Input
                  type="password"
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nueva contraseña">
                  <Input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                </Field>
                <Field label="Repetir nueva">
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                  />
                </Field>
              </div>
              {err && (
                <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                  {err}
                </p>
              )}
              {msg && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                  {msg}
                </p>
              )}
              <Button type="submit" variant="white" size="sm">
                Cambiar contraseña
              </Button>
            </form>
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        onConfirm={async () => {
          await clearAllData();
          window.location.reload();
        }}
        title="Borrar todos los datos"
        message="Se eliminarán productos, ventas y gastos de forma permanente. Esta acción no se puede deshacer. ¿Continuar?"
      />
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { phase, logout } = useApp();
  const pathname = usePathname() || "/dashboard";
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }
  if (phase !== "open") return <LoginScreen />;

  const NavContent = (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-200 px-5 dark:border-zinc-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Mi Negocio
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Finanzas</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
        >
          <Settings className="h-[18px] w-[18px]" />
          Ajustes
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
        >
          <Lock className="h-[18px] w-[18px]" />
          Bloquear
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:flex">
        {NavContent}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
            {NavContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold sm:text-base">
              {TITLES[pathname] || "Mi Negocio"}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Ajustes"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Bloquear"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}