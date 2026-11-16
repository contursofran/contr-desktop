import { useSyncExternalStore } from "react";

const query = "(prefers-color-scheme: light)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** The system appearance; the theme tokens in index.css follow the same media query. */
export function useColorScheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, () => (window.matchMedia(query).matches ? "light" : "dark"));
}
