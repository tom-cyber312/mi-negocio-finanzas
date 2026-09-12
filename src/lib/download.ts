import { esNativo } from "./capacitor";

export interface ArchivoDescargable {
  nombre: string;
  data: Blob;
}

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      resolve(typeof r === "string" ? r.split(",")[1] ?? "" : "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function descargarEnNavegador(archivo: ArchivoDescargable): void {
  const url = URL.createObjectURL(archivo.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// En el wrapper de Capacitor, los <a download> no abren archivo de
// descargas: se escribe el archivo en el directorio temporal y se abre el
// share sheet nativo para guardarlo/compartirlo.
async function descargarEnNativo(archivo: ArchivoDescargable): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const base64 = await blobABase64(archivo.data);
  // Sin "encoding": el plugin escribe binario y espera los datos en base64.
  await Filesystem.writeFile({
    path: archivo.nombre,
    data: base64,
    directory: Directory.Cache,
  });
  const info = await Filesystem.getUri({ path: archivo.nombre, directory: Directory.Cache });
  await Share.share({
    files: [info.uri],
    title: archivo.nombre,
    dialogTitle: archivo.nombre,
  });
}

/** Descarga/guarda un archivo generado en el cliente.
 *  - Navegador: descarga clásica con <a download>.
 *  - Capacitor (iOS/Android): share sheet nativo.
 */
export async function guardarArchivo(archivo: ArchivoDescargable): Promise<void> {
  if (esNativo()) {
    try {
      await descargarEnNativo(archivo);
      return;
    } catch {
      /* si el share falla, se intenta la vía navegador */
    }
  }
  descargarEnNavegador(archivo);
}