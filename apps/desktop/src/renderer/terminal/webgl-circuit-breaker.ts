// Adapted from electerm/electerm@cac0a20ec4da7257781279fe54e16b9b825d5e92
// src/client/components/terminal/terminal-webgl-circuit-breaker.mjs (MIT)

export function createWebglCircuitBreaker() {
  let state: "healthy" | "tripped" = "healthy";
  return {
    isWebglAllowed: () => state === "healthy",
    trip() {
      state = "tripped";
    },
  };
}
