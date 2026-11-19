import { expect, test } from "@playwright/test";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

function launch() {
  return launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    FAKE_HC_TITLE: "Chat panel usability audit",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
  });
}

test("the orchestration tool and hc supply the workers for the chat status and sidebar", async () => {
  test.setTimeout(60_000);
  const app = await launch();
  const page = await app.firstWindow();
  const status = page.getByLabel("Status");
  await expect(status).toContainText("Orchestrating · 3 workers");
  // The sidebar shows the same three workers under the chat's agent.
  const desktop = page.getByRole("navigation", { name: "Projects" }).getByRole("region", { name: "contr-desktop" });
  for (const name of ["b-30", "b-40", "b-50"]) await expect(desktop.getByText(name, { exact: true })).toBeVisible();
  await app.close();
});
