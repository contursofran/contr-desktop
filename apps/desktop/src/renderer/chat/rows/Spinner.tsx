import { useEffect, useState } from "react";

/** herdr-contr's one loader (mods/herdr-contr/state.js `BRAILLE`, `BRAILLE_MS`). */
export const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
export const FRAME_MS = 80;

/**
 * The braille loader, as herdr-contr's `loader(size)`: a `size` px square, the mono font at `size` px, one
 * frame each 80 ms. The caller sets the color.
 */
export function Spinner({ size, className = "" }: { size: number; className?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), FRAME_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      aria-label="running"
      role="status"
      className={`inline-flex shrink-0 items-center justify-center font-mono leading-none ${className}`}
      style={{ width: size, height: size, fontSize: size }}
    >
      {FRAMES[frame]}
    </span>
  );
}
