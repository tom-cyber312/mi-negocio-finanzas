import type { CapacitorConfig } from "@capacitor/cli";

// Ajustes para el wrapper nativo (publicación en App Store).
// - server.url: apunta a la app desplegada en Vercel para que las rutas de
//   la API (/api/import/...) sigan disponibles dentro del webview iOS.
//   En desarrollo local comentá/borrá `server` o apuntá a http://localhost:3000.
// - appId: reemplazalo por tu bundle identifier real antes de publicar.
const config: CapacitorConfig = {
  appId: "com.minegocio.finanzas",
  appName: "Mi Negocio Finanzas",
  webDir: "public",
  server: {
    url: "https://finanzas-sandy-sigma.vercel.app",
    cleartext: false,
  },
};

export default config;