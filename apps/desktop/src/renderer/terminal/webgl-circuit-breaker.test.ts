// Adapted from electerm/electerm@cac0a20ec4da7257781279fe54e16b9b825d5e92
// src/test/unit-ci/terminal-webgl-circuit-breaker.spec.js (MIT)

import { expect, it } from "vitest";
import { createWebglCircuitBreaker } from "./webgl-circuit-breaker";

it("allows WebGL until context loss trips the breaker for the session", () => {
  const circuit = createWebglCircuitBreaker();
  expect(circuit.isWebglAllowed()).toBe(true);
  circuit.trip();
  expect(circuit.isWebglAllowed()).toBe(false);
  circuit.trip();
  expect(circuit.isWebglAllowed()).toBe(false);
  expect(createWebglCircuitBreaker().isWebglAllowed()).toBe(true);
});
