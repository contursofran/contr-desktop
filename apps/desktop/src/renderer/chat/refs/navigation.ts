import { createContext } from "react";
import type { SidebarAgent } from "../../../shared/api";

/** Chip targets in the current chat. Worker names are scoped to their coordinator. */
export const ChipNavigation = createContext<{
  workers: SidebarAgent[] | undefined;
  select: (terminal: string) => void;
  openInbox: (item: string) => void;
} | null>(null);
