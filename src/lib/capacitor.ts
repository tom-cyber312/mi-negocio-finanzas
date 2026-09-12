const CLAVES_CRITICAS = new Set([
  "fin_cuentas",
  "fin_cuenta_activa",
  "fin_sess",
  "fin_theme",
]);

export function esNativo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }).Capacitor;
    return !!cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform();
  } catch {
    return false;
  }
}

export async function feedbackExito(): Promise<void> {
  if (!esNativo()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // sin haptics: ignorar
  }
}

export async function aplicarBarraDeEstado(oscura: boolean): Promise<void> {
  if (!esNativo()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: oscura ? Style.Light : Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // sin status bar: ignorar
  }
}

export async function inicializarNativo(): Promise<void> {
  if (!esNativo()) return;
  try {
    await import("@capacitor/keyboard");
  } catch {
    // sin teclado nativo: ignorar
  }
}

export async function sintonizarPersistenciaNativa(): Promise<void> {
  if (!esNativo()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const pendientes: Array<[string, string]> = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("fin_")) continue;
      const value = localStorage.getItem(key);
      if (value != null) pendientes.push([key, value]);
    }
    await Promise.all(
      pendientes.map(([key, value]) => Preferences.set({ key, value }))
    );
    const { keys } = await Preferences.keys();
    const restaurables = keys.filter(
      (k) =>
        k.startsWith("fin_") &&
        (CLAVES_CRITICAS.has(k) || localStorage.getItem(k) === null)
    );
    for (const key of restaurables) {
      const { value } = await Preferences.get({ key });
      if (value != null) localStorage.setItem(key, value);
    }
  } catch {
    // la sincronización es un seguro extra; no debe romper la app
  }
}