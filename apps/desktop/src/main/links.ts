import { appendFileSync } from "node:fs";
import { shell, type WebContents } from "electron";

/** The only schemes that a link in a message can open, and only in the system browser or mail app. */
const OPEN_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/** The URL to give to the system, or null to open nothing. A message's text comes from an agent, so each other scheme
 * (`file:`, `javascript:`, a custom scheme) and each link to the app's own page (a relative path in dev) opens nothing. */
export function linkToOpen(url: string, appUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!OPEN_SCHEMES.has(parsed.protocol)) return null;
  if (parsed.protocol !== "mailto:" && parsed.origin === new URL(appUrl, "file:///").origin) return null;
  return parsed.href;
}

/** The app's page itself (a reload or a hash change), or the first load, before the page has a URL. */
function samePage(url: string, appUrl: string): boolean {
  return appUrl === "" || url.split("#")[0] === appUrl.split("#")[0];
}

/** No window opens and the page never navigates away: a link goes to `open` when `linkToOpen` allows it, else nowhere. */
export function guardLinks(contents: Pick<WebContents, "setWindowOpenHandler" | "on" | "getURL">, open: (url: string) => void): void {
  const send = (url: string) => {
    const target = linkToOpen(url, contents.getURL());
    if (target) open(target);
  };
  contents.setWindowOpenHandler(({ url }) => {
    send(url);
    return { action: "deny" };
  });
  const stay = (event: { preventDefault(): void }, url: string) => {
    if (samePage(url, contents.getURL())) return;
    event.preventDefault();
    send(url);
  };
  contents.on("will-navigate", (event) => stay(event, event.url));
  contents.on("will-redirect", (event) => stay(event, event.url));
}

/** Opens a URL in the system browser. e2e runs never open the owner's browser: they write the URL to CONTR_OPEN_LOG. */
export function openExternal(url: string): void {
  if (process.env.CONTR_E2E === "1") appendFileSync(process.env.CONTR_OPEN_LOG ?? "/dev/null", `${url}\n`);
  else void shell.openExternal(url);
}
