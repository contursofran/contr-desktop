import { expect, onTestFinished } from "vitest";
import { commands, page } from "vitest/browser";
import type { ContrApi, FeedRow } from "../src/shared/api";
import { renderApp } from "./renderApp";

export const chatList = () => page.getByRole("list", { name: "Chat" });
export const findRow = (id: string, list = chatList().element()) =>
  list.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);

export async function rowInViewport(id: string) {
  const list = await chatList().findElement();
  await expect.poll(() => findRow(id, list)).not.toBeNull();
  await expect.element(findRow(id, list)).toBeInViewport();
}

/** Deliver the same splice events as the preload, with new rows at their fixture offsets. */
export async function renderFeed(rows: (from: number, to: number) => FeedRow[], count: number) {
  const initial = rows(0, count);
  let listener: Parameters<ContrApi["onFeed"]>[0] | undefined;
  await renderApp(initial.map((row) => JSON.stringify(row)).join("\n"), null, {
    onFeed(receive) {
      listener = receive;
      receive({ type: "splice", at: 0, rows: initial, agent: "claude", model: "claude-opus-5-5" });
      return () => { listener = undefined; };
    },
  });
  return (from: number, to: number) => {
    if (!listener) throw new Error("Wait for the chat to receive its initial rows before appending");
    listener({ type: "splice", at: from, rows: rows(from, to) });
  };
}

/** Wait for the virtual list's position, height and row range to stay the same for three frames. */
export async function chatSettled(list = chatList().element()) {
  let last = "";
  for (let same = 0, frame = 0; same < 3 && frame < 120; frame++) {
    await new Promise<void>((done) => requestAnimationFrame(() => done()));
    const ids = Array.from(list.querySelectorAll("[data-row-id]"), (row) => row.getAttribute("data-row-id"));
    const now = `${list.scrollTop} ${list.scrollHeight} ${ids.join(",")}`;
    same = now === last ? same + 1 : 0;
    last = now;
  }
}

/** Find a virtual row by scrolling half a viewport at a time, as the Electron helper does. */
export async function chatRow(id: string) {
  const list = await chatList().findElement();
  await expect.element(chatList().getByRole("listitem").first()).toBeVisible();
  await expect.poll(async () => {
    await chatSettled(list);
    for (let top = 0; ; ) {
      list.scrollTo({ top });
      await chatSettled(list);
      const row = findRow(id, list);
      if (row) {
        row.scrollIntoView({ block: "nearest" });
        await chatSettled(list);
        const box = findRow(id, list)?.getBoundingClientRect();
        const view = list.getBoundingClientRect();
        if (box && box.bottom > view.top && box.top < view.bottom) return true;
      }
      const max = list.scrollHeight - list.clientHeight;
      if (top >= max) return false;
      top = Math.min(top + list.clientHeight / 2, max);
    }
  }, { timeout: 20_000 }).toBe(true);
  const row = findRow(id, list)!;
  await expect.element(row).toBeInViewport();
  return row;
}

export async function shoot(name: string, themed = true) {
  if (themed) {
    for (const scheme of ["dark", "light"] as const) {
      await commands.colorScheme(scheme);
      await page.screenshot({ path: `../../../../tmp/shots/browser/${name}-${scheme}.png` });
    }
  } else {
    await page.screenshot({ path: `../../../../tmp/shots/browser/${name}.png` });
  }
}

export function addStyle(css: string) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  onTestFinished(() => style.remove());
}
