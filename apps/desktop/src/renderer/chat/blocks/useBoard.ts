import { useEffect, useState } from "react";
import type { Board } from "../../../shared/api";

/** The board asks again every 10 s while it shows: the orchestration tool sends no event to the app. */
export const BOARD_POLL_MS = 10_000;

/** Worker states and PR checks for these issues; null until main answers. */
export function useBoard(issues: number[]): Board | null {
  const [board, setBoard] = useState<Board | null>(null);
  const key = issues.join(",");
  useEffect(() => {
    let live = true;
    const wanted = key.split(",").map(Number);
    const read = () => void window.contr.board(wanted).then((b) => live && setBoard(b));
    read();
    const id = setInterval(read, BOARD_POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [key]);
  return board;
}
