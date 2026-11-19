import { afterEach, expect, onTestFinished, test, vi } from "vitest";
import { commands, page, userEvent, type Locator } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { chatRow, rowInViewport, shoot } from "../../test/274-chat";
import { renderApp } from "../../test/renderApp";
import type { FeedRow } from "../shared/api";
import { saveDraft } from "./chat/reply/drafts";

const row = async (id: string) => page.elementLocator(await chatRow(id));
const text = (locator: Locator) => expect.poll(() => locator.query()?.textContent?.replace(/\s+/g, " ").trim());
const box = () => page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });

// The reply draft stays in memory across app mounts in this browser file.
afterEach(() => saveDraft("t7", { text: "", images: [] }));

test("the transcript opens at the end and renders messages, tools and working status", async () => {
  const rows: FeedRow[] = transcript.trim().split("\n").map((line) => JSON.parse(line));
  await renderApp(transcript, null, {
    onFeed(receive) {
      receive({ type: "splice", at: 0, rows, agent: "claude", model: "claude-opus-5-5" });
      receive({ type: "working", working: { text: "Hashing…", detail: "35s · ↓ 1.2k tokens" } });
      return () => {};
    },
  });

  await rowInViewport("a6");
  await expect.element(page.getByRole("button", { name: /Running a command/ }).getByRole("status")).toBeVisible();
  await text(await row("u1")).toContain("After a rejected sign-in, the login form clears the email");
  await expect.element((await row("a1-t1")).getByRole("button")).toHaveTextContent("▶Searched 2 patterns, read 1 file");
  await text(await row("a3")).toContain("Opened PR #14");
  await expect.element(await row("f-a3")).toHaveTextContent("14:06 · Worked 1m 0s · 7 tools");
  await expect.element(await row("u2")).toHaveTextContent("↳ t2 docs-worker: I pushed the sign-in guide changes to draft PR #15. The updated steps cover retrying after a rejected password.");
  await text(await row("u4")).toContain("2 pictures");
  await text(page.getByLabelText("Status", { exact: true })).toContain("Hashing…35s · ↓ 1.2k tokens");
  const tools = await chatRow("a2-t1");
  const ran = page.getByRole("button", { name: "Edited 2 files, ran 2 commands" });
  await ran.click();
  await expect.element(ran).toHaveAttribute("aria-expanded", "true");
  await expect.element(tools).toMatchTextContent("12 passed");
  await expect.element(tools.querySelector<HTMLElement>('[role="img"][aria-label="failed"]')).toHaveTextContent("✕");
  await expect.element(page.getByRole("main")).toHaveStyle({ backgroundColor: "rgb(20, 21, 24)" });
  await chatRow("u1");
  await shoot("helper-rows", false);
  await chatRow("a6");
  await shoot("helper-rows-end", false);
});

test("the reply box sends two lines and an image path, then clears", async () => {
  const send = vi.fn(async () => ({ ok: true }));
  const pasteImage = vi.fn(async () => ({ ok: true, path: "/fake/paste/shot.png" }));
  await renderApp(transcript, null, { send, pasteImage });

  await expect.element(box()).toHaveAttribute("placeholder", "Reply to Chat panel usability audit");
  await box().click();
  await userEvent.keyboard("first line{Shift>}{Enter}{/Shift}second line");
  const data = new DataTransfer();
  data.items.add(new File(["x"], "shot.png", { type: "image/png" }));
  box().element().dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  await expect.element(page.getByRole("list", { name: "Attachments" })).toHaveTextContent("shot.png");
  expect(pasteImage).toHaveBeenCalledOnce();
  await shoot("reply-box", false);
  await userEvent.keyboard("{Enter}");
  await expect.element(box()).toHaveValue("");
  expect(send).toHaveBeenCalledExactlyOnceWith("first line\nsecond line\n/fake/paste/shot.png");
});

test("a failed send shows the error and keeps the draft", async () => {
  await renderApp(transcript, null, { send: async () => ({ ok: false, message: "fake send error no-terminal" }) });
  await box().fill("hello");
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("alert")).toHaveTextContent("Not sent: fake send error no-terminal");
  await expect.element(box()).toHaveValue("hello");
});

test("a no-core feed error shows the helper error panel", async () => {
  await renderApp(transcript, null, {
    onFeed(receive) {
      receive({ type: "error", code: "no-core", message: "fake error no-core" });
      return () => {};
    },
  });

  const alert = page.getByRole("alert", { name: "Helper error" });
  await expect.element(alert.getByText("hc is not running.", { exact: true })).toBeVisible();
  await expect.element(alert.getByText("no-core: fake error no-core", { exact: true })).toBeVisible();
});

test("assistant Markdown shows code, tables, checkboxes and copy feedback", async () => {
  const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  onTestFinished(() => clipboard.mockRestore());
  await renderApp(transcript);
  const answer = await row("a5");
  await expect.element(answer.getByRole("heading", { name: "Sign-in retry coverage" })).toBeVisible();
  const content = answer.element();
  expect(content.querySelectorAll("table tbody tr")).toHaveLength(3);
  expect(content.querySelector("td code")?.textContent).toBe("src/auth/LoginForm.tsx");
  expect(content.querySelectorAll("input[type=checkbox]")).toHaveLength(3);
  expect(content.querySelector("[data-language=tsx]")?.textContent).toContain("tsx");
  const shell = content.querySelector<HTMLElement>("[data-language=sh]")!;
  expect(shell.textContent).toContain("pnpm test auth --watch=false");
  const tsx = content.querySelector<HTMLElement>("[data-language=tsx] pre > code")!;
  await expect.element(tsx).toBeVisible();
  expect(tsx.querySelectorAll("*")).toHaveLength(0);
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    const probe = document.createElement("span");
    probe.style.color = "var(--ink-85)";
    tsx.append(probe);
    const colors = [getComputedStyle(tsx).color, getComputedStyle(probe).color];
    probe.remove();
    expect(colors[0]).toBe(colors[1]);
  }

  await commands.colorScheme("dark");
  await page.elementLocator(shell).getByRole("button", { name: "Copy code" }).click();
  await expect.element(page.elementLocator(shell).getByRole("button", { name: "Copied" })).toBeVisible();
  expect(clipboard).toHaveBeenCalledExactlyOnceWith("pnpm test auth --watch=false");

  await page.viewport(900, 1000);
  await chatRow("a5");
  await shoot("markdown-dark", false);
  await commands.colorScheme("light");
  await expect.element(page.getByRole("main")).toHaveStyle({ backgroundColor: "rgb(239, 240, 242)" });
  await shoot("markdown-light", false);
});
