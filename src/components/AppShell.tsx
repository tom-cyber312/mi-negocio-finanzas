"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  Download,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Package,
  Pencil,
  Plug,
  Receipt,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Sun,
  Target,
  Trash2,
  Upload,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button, ConfirmDialog, Field, Input, Select } from "@/components/ui";
import { CURRENCIES } from "@/lib/format";
import { emailValido, type Cuenta } from "@/lib/accounts";
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

function CrearCuentaForm({
  descripcion,
  onDone,
  onBack,
  botonLabel = "Crear cuenta",
}: {
  descripcion: string;
  onDone: (nombre: string, email: string, pw: string) => Promise<void>;
  onBack?: () => void;
  botonLabel?: string;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (nombre.trim().length === 0) {
      return setErr("Poné un nombre para identificar este negocio (ej: Kiosco de Ana).");
    }
    if (!emailValido(email)) {
      return setErr("Ingresá un correo válido, por ejemplo nombre@gmail.com.");
    }
    if (pw.length < 4) return setErr("La contraseña debe tener al menos 4 caracteres.");
    if (pw !== pw2) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await onDone(nombre.trim(), email.trim(), pw);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{descripcion}</p>
      <Field label="Nombre del negocio">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Kiosco de Ana"
          autoFocus
        />
      </Field>
      <Field label="Gmail / correo">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nombre@gmail.com"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Contraseña">
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
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
      </div>
      {err && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          {err}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creando…" : botonLabel}
      </Button>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </button>
      )}
    </form>
  );
}

function LoginForm({
  emailInicial,
  cuentas,
}: {
  emailInicial: string;
  cuentas: Cuenta[];
}) {
  const { login } = useApp();
  const [email, setEmail] = useState(emailInicial || cuentas[0]?.email || "");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!emailValido(email)) return setErr("Seleccioná una cuenta o ingresá el correo.");
    setBusy(true);
    const ok = await login(email, pw);
    setBusy(false);
    if (!ok) setErr("Correo o contraseña incorrectos.");
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Elegí tu negocio e ingresá su contraseña para desbloquear.
      </p>
      <Field label="Cuenta (negocio)">
        <Select value={email} onChange={(e) => setEmail(e.target.value)}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.email}>
              {c.nombre} — {c.email}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Contraseña">
        <Input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="••••••••"
          autoFocus
        />
      </Field>
      {err && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          {err}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Verificando…" : "Desbloquear"}
      </Button>
      <p className="text-center text-[11px] text-zinc-400">
        ¿Olvidaste la contraseña? Podés resetearla borrando el almacenamiento
        del navegador para este sitio.
      </p>
    </form>
  );
}

function LoginScreen() {
  const { phase, crearCuenta, iniciarSesionCon, cuentas, cuentaActiva } =
    useApp();
  const [adding, setAdding] = useState(false);

  const crearYEntrar = async (nombre: string, email: string, pw: string) => {
    const cuenta = await crearCuenta(nombre, email, pw);
    iniciarSesionCon(cuenta.id);
  };

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
          <CrearCuentaForm
            descripcion="Identificá tu negocio con un nombre y un correo, y elegí una contraseña para protegerlo."
            onDone={crearYEntrar}
            botonLabel="Crear mi negocio"
          />
        ) : adding ? (
          <CrearCuentaForm
            descripcion="Agregá otro negocio con su propio nombre, correo y contraseña. Cada cuenta tendrá sus propios datos."
            onDone={crearYEntrar}
            onBack={() => setAdding(false)}
            botonLabel="Crear cuenta"
          />
        ) : (
          <>
            <LoginForm
              emailInicial={cuentaActiva?.email || ""}
              cuentas={cuentas}
            />
            <button
              onClick={() => setAdding(true)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
            >
              <UserPlus className="h-4 w-4" />
              Agregar otra cuenta (otro negocio)
            </button>
          </>
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
  const {
    currency,
    setCurrencyCode,
    theme,
    toggleTheme,
    changePassword,
    cuentas,
    cuentaActiva,
    crearCuenta,
    renombrarCuenta,
    eliminarCuenta,
    cambiarCuenta,
  } = useApp();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const [addMode, setAddMode] = useState(false);
  const [aNombre, setANombre] = useState("");
  const [aEmail, setAEmail] = useState("");
  const [aPw, setAPw] = useState("");
  const [aPw2, setAPw2] = useState("");
  const [aErr, setAErr] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Cuenta | null>(null);

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

  const submitAgregar = async (e: FormEvent) => {
    e.preventDefault();
    setAErr(null);
    if (aNombre.trim().length === 0) return setAErr("Poné un nombre para el negocio.");
    if (!emailValido(aEmail)) return setAErr("Ingresá un gmail válido (nombre@gmail.com).");
    if (aPw.length < 4) return setAErr("La contraseña debe tener al menos 4 caracteres.");
    if (aPw !== aPw2) return setAErr("Las contraseñas no coinciden.");
    try {
      const c = await crearCuenta(aNombre.trim(), aEmail.trim(), aPw);
      setANombre("");
      setAEmail("");
      setAPw("");
      setAPw2("");
      setAddMode(false);
      setMsg(`Cuenta "${c.nombre}" creada. Para entrar usala desde la pantalla de inicio (o tocá "Usar").`);
    } catch (e) {
      setAErr((e as Error).message);
    }
  };

  const guardarRenombre = (e: FormEvent) => {
    e.preventDefault();
    if (!renameId) return;
    if (renameVal.trim().length === 0) return setErr("El nombre no puede quedar vacío.");
    renombrarCuenta(renameId, renameVal.trim());
    setRenameId(null);
    setRenameVal("");
    setMsg("Nombre de la cuenta actualizado.");
  };

  const confirmarEliminar = async () => {
    if (!deleteTarget) return;
    const eraActiva = eliminarCuenta(deleteTarget.id);
    if (eraActiva) {
      if (deleteTarget.id === "default") await clearAllData();
      window.location.reload();
    } else {
      setMsg(`Cuenta "${deleteTarget.nombre}" eliminada.`);
      setDeleteTarget(null);
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
              Cuentas (negocios)
            </h3>
            <div className="space-y-2">
              {cuentas.map((c) => {
                const activa = c.id === cuentaActiva?.id;
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${
                            activa ? "bg-emerald-600" : "bg-zinc-400 dark:bg-zinc-600"
                          }`}
                        >
                          {c.nombre.trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {c.nombre}
                            {activa && (
                              <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                En uso
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-zinc-500">{c.email}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!activa && (
                          <button
                            onClick={() => cambiarCuenta(c.id)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                            title="Salir y entrar en esta cuenta"
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            Usar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setRenameId(c.id);
                            setRenameVal(c.nombre);
                          }}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          title="Renombrar negocio"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          title="Eliminar cuenta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {renameId === c.id && (
                      <form
                        onSubmit={guardarRenombre}
                        className="mt-2.5 flex items-center gap-2"
                      >
                        <Input
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          placeholder="Nombre del negocio"
                          autoFocus
                        />
                        <Button type="submit" size="sm">
                          Guardar
                        </Button>
                      </form>
                    )}
                  </div>
                );
              })}
              {addMode ? (
                <form
                  onSubmit={submitAgregar}
                  className="space-y-2.5 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700"
                >
                  <Field label="Nombre del negocio">
                    <Input
                      value={aNombre}
                      onChange={(e) => setANombre(e.target.value)}
                      placeholder="Ej: Kiosco de Ana"
                      autoFocus
                    />
                  </Field>
                  <Field label="Gmail / correo">
                    <Input
                      type="email"
                      value={aEmail}
                      onChange={(e) => setAEmail(e.target.value)}
                      placeholder="nombre@gmail.com"
                    />
                  </Field>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Field label="Contraseña">
                      <Input
                        type="password"
                        value={aPw}
                        onChange={(e) => setAPw(e.target.value)}
                        placeholder="••••••••"
                      />
                    </Field>
                    <Field label="Repetir">
                      <Input
                        type="password"
                        value={aPw2}
                        onChange={(e) => setAPw2(e.target.value)}
                        placeholder="••••••••"
                      />
                    </Field>
                  </div>
                  {aErr && (
                    <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                      {aErr}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="flex-1">
                      Crear cuenta
                    </Button>
                    <Button
                      type="button"
                      variant="white"
                      size="sm"
                      onClick={() => {
                        setAddMode(false);
                        setAErr(null);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="white" onClick={() => setAddMode(true)}>
                  <UserPlus className="h-4 w-4" />
                  Agregar otra cuenta
                </Button>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Store className="h-3.5 w-3.5" />
              Cada cuenta (negocio) mantiene sus productos, ventas, gastos y
              ajustes separados, con su propio nombre.
            </p>
          </section>

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
              Datos de este negocio
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
              Seguridad de esta cuenta
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
        message="Se eliminarán productos, ventas y gastos de este negocio de forma permanente. Esta acción no se puede deshacer. ¿Continuar?"
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar cuenta"
        message={`Se eliminará la cuenta "${deleteTarget?.nombre}" (${deleteTarget?.email}). Sus datos quedarán guardados en este navegador, pero no podrás volver a entrar con ella. ¿Continuar?`}
      />
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { phase, logout, cuentaActiva, userInitial } = useApp();
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
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
            {cuentaActiva?.nombre || "Mi Negocio"}
          </p>
          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {cuentaActiva?.email || "Finanzas"}
          </p>
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-sm font-semibold sm:text-base">
              {TITLES[pathname] || "Mi Negocio"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {cuentaActiva && (
              <span
                title={`${cuentaActiva.nombre} — ${cuentaActiva.email}`}
                className="hidden items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 sm:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                  {userInitial}
                </span>
                {cuentaActiva.nombre}
              </span>
            )}
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