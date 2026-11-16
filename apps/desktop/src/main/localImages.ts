import { net, protocol } from "electron";
import { pathToFileURL } from "node:url";

/** The scheme that serves local images to the chat: `contr-image://local/<absolute path>`. */
export const IMAGE_SCHEME = "contr-image";
const IMAGE_FILE = /\.(?:png|jpe?g|svg)$/i;

/** Gives the local file path for a URL, or null when the URL is not an allowed image. */
export function imagePath(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${IMAGE_SCHEME}:` || parsed.host !== "local") return null;
  const path = decodeURIComponent(parsed.pathname);
  if (!path.startsWith("/") || path.includes("\0") || !IMAGE_FILE.test(path)) return null;
  return path;
}

/** Call before app ready. */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true } }]);
}

/** Serves only PNG, JPEG and SVG files; all else is 404. */
export function handleImageScheme(): void {
  protocol.handle(IMAGE_SCHEME, (request) => {
    const path = imagePath(request.url);
    return path ? net.fetch(pathToFileURL(path).href) : new Response(null, { status: 404 });
  });
}
