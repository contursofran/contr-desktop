import { expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";
import diagram from "../../e2e/fixtures/diagram.svg?url&no-inline";
import pictureFixture from "../../e2e/fixtures/missing-picture-session.jsonl?raw";
import remarksFixture from "../../e2e/fixtures/remarks-session.jsonl?raw";
import shot from "../../e2e/fixtures/shot.png?url";
import { chatRow, normalizedText } from "../../test/273-chatRows";
import { shoot } from "../../test/280-browser";
import { renderApp } from "../../test/renderApp";

vi.mock(import("./chat/markdown/markdownLocalImages"), async (importOriginal) => {
  const original = await importOriginal();
  const localImageUrl = (path: string) => {
    if (path === "/fixtures/shot.png") return shot;
    if (path === "/fixtures/diagram.svg") return diagram;
    return path;
  };
  return {
    ...original,
    localImageUrl,
    remarkLocalImages() {
      const transform = original.remarkLocalImages();
      type Tree = Parameters<typeof transform>[0];
      // The plugin calls its module-local URL builder. Map its output to Chromium URLs
      // after the real transform identifies which nodes are local pictures.
      const replaceUrls = (node: Tree) => {
        if (typeof node.url === "string" && node.url.startsWith("contr-image://local/")) {
          node.url = localImageUrl(decodeURI(node.url.slice("contr-image://local".length)));
        }
        node.children?.forEach(replaceUrls);
      };
      return (tree: Tree) => {
        transform(tree);
        replaceUrls(tree);
      };
    },
  };
});

function token(name: string, prop: "color" | "backgroundColor" = "color") {
  const probe = document.createElement("span");
  probe.style[prop] = `var(--${name})`;
  document.body.append(probe);
  const value = getComputedStyle(probe)[prop];
  probe.remove();
  return value;
}

test("a picture that cannot load is a muted chip with an icon; a web picture stays a link", async () => {
  await renderApp(pictureFixture.replaceAll("$FIXTURES", "/fixtures"));
  const md = (await chatRow("a1")).querySelector(".chat-markdown")!;
  const chips = () => Array.from(md.querySelectorAll("[data-missing-image]"));
  await expect.poll(() => chips().map(normalizedText)).toEqual(["build graph", "/nonexistent/no-alt.png", "The spinner"]);
  expect(chips().map((chip) => chip.getAttribute("title"))).toEqual([
    "/nonexistent/graph.png", "/nonexistent/no-alt.png", "/nonexistent/spin.gif",
  ]);
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    for (const chip of chips()) {
      expect(chip.querySelectorAll("svg")).toHaveLength(1);
      const style = getComputedStyle(chip);
      expect([style.color, style.backgroundColor]).toEqual([token("color-muted"), token("color-selected", "backgroundColor")]);
    }
  }

  const images = md.querySelectorAll("img");
  expect(images).toHaveLength(1);
  expect(images[0].alt).toBe("The login form");
  await expect.poll(() => images[0].naturalWidth).toBeGreaterThan(0);
  expect(md.querySelector('a[href="https://example.com/web.png"]')?.textContent).toBe("A web image");
  md.scrollIntoView({ block: "start" });
  await shoot("missing-picture");
});

test("remarks show their label, text and framed local images", async () => {
  await renderApp(remarksFixture.replaceAll("$FIXTURES", "/fixtures"));
  const row = await chatRow("r1");
  const remarks = Array.from(row.querySelectorAll(".chat-remark"));
  const labels = remarks.map((remark) => remark.querySelector(".chat-remark-word")!);
  expect(remarks).toHaveLength(5);
  expect(labels.map(normalizedText)).toEqual(["Done", "Decision needed", "Warning", "Not verified", "Note"]);
  expect(normalizedText(remarks[1])).toContain("Keep the old flag one more release, or remove it now?");
  const [dim, red, hairline, ink] = [token("color-dim"), token("blocked"), token("hairline"), token("ink-100")];
  expect(labels.map((label) => getComputedStyle(label).color)).toEqual([dim, red, dim, dim, dim]);
  for (const [i, remark] of remarks.entries()) {
    expect(getComputedStyle(remark).borderLeftWidth).toBe("0px");
    const label = labels[i].getBoundingClientRect();
    const text = remark.querySelectorAll("p")[1].getBoundingClientRect();
    expect(text.x).toBeGreaterThanOrEqual(label.x + 110);
  }

  const images = row.querySelectorAll("img");
  expect(images).toHaveLength(2);
  for (const image of Array.from(images)) {
    await expect.poll(() => image.complete && image.naturalWidth, { message: image.src }).toBeGreaterThan(0);
  }
  expect(images[0].alt).toBe("The login form");
  const frame = getComputedStyle(images[0]);
  expect([frame.borderTopWidth, frame.borderTopColor]).toEqual(["1px", hairline]);
  const file = page.elementLocator(row).getByRole("link", { name: "Not an image" });
  expect(file.elements()).toHaveLength(1);
  expect(getComputedStyle(file.element()).color).toBe(ink);
  expect(row.querySelector('a[href="https://example.com/web.png"]')?.textContent).toBe("A web image");
  row.scrollIntoView({ block: "nearest" });
  await shoot("remarks");
});
