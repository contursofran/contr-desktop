// Adapted from generalaction/emdash@9e2942b8281b17703c0e66845080a556ae262677
// apps/emdash-desktop/src/core/features/terminals/browser/pty/resize-scheduler.ts
// packages/shared/src/scheduling/debounce.ts (Apache-2.0)
// and Eugeny/tabby@467ce8ebfa467fb88cf6d154c9a5891e3d3647f0
// tabby-terminal/src/frontends/xtermFrontend.ts (MIT)

const RESIZE_MIN_INTERVAL = 32;

// Fit on the leading edge so the child redraws at the new grid size.
// Coalesce the rest of the interval and measure again at its end.
export function createResizeScheduler(fit: () => void) {
  let lastResize = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const runResize = () => {
    timer = undefined;
    lastResize = performance.now();
    fit();
  };

  return {
    schedule() {
      if (timer !== undefined) return;
      const wait = Math.max(0, RESIZE_MIN_INTERVAL - (performance.now() - lastResize));
      if (wait > 0) timer = setTimeout(runResize, Math.ceil(wait));
      else runResize();
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
