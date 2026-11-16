import { useEffect, useState } from "react";

const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

/** The braille loader of the design: one frame each 80 ms. */
export function Spinner({ className = "" }: { className?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return <span aria-label="running" role="status" className={`inline-block w-[1ch] font-mono ${className}`}>{FRAMES[frame]}</span>;
}
