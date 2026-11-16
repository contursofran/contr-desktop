/// <reference types="vite/client" />
interface Window {
  contr: { platform: string; terminal: import("../preload/terminal").TerminalApi };
}
