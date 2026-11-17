import { describe, expect, it } from "vitest";
import { serial } from "./menu";
import { cutSent, outbox, type SendResult } from "./outbox";

/** A slow fake send: each call waits until the test answers it. */
function slowSend() {
  const calls: { body: string; answer: (r: SendResult) => void }[] = [];
  const send = (body: string) => new Promise<SendResult>((answer) => calls.push({ body, answer }));
  return { calls, send };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("cutSent", () => {
  it("cuts the sent text and images from the start of the box", () =>
    expect(cutSent({ text: "one two", images: ["a", "b"] }, { text: "one", images: ["a"] })).toEqual({ text: " two", images: ["b"] }));
  it("keeps a field that no longer starts with the sent part", () =>
    expect(cutSent({ text: "other", images: ["b"] }, { text: "one", images: ["a"] })).toEqual({ text: "other", images: ["b"] }));
});

describe("outbox", () => {
  it("queues Enter during a slow send: the second message is only the new text, and it goes after the first", async () => {
    const { calls, send } = slowSend();
    const out = outbox(serial(), send);
    const first = out.take({ text: "one", images: ["a"] });
    expect(first?.part).toEqual({ text: "one", images: ["a"] });
    // The same box again is no new message.
    expect(out.take({ text: "one", images: ["a"] })).toBeNull();
    expect(out.untaken({ text: "one two", images: ["a", "b"] })).toEqual({ text: " two", images: ["b"] });
    const second = out.take({ text: "one two", images: ["a", "b"] });
    await tick();
    expect(calls.map((c) => c.body)).toEqual(["one\na"]);
    calls[0].answer({ ok: true });
    expect(await first?.done).toEqual({ ok: true });
    await tick();
    expect(calls.map((c) => c.body)).toEqual(["one\na", "two\nb"]);
    calls[1].answer({ ok: true });
    expect(await second?.done).toEqual({ ok: true });
    expect(out.untaken({ text: "three", images: [] })).toEqual({ text: "three", images: [] });
  });

  it("after a failed send, the messages queued behind it do not go and the whole box is untaken again", async () => {
    const { calls, send } = slowSend();
    const out = outbox(serial(), send);
    const first = out.take({ text: "one", images: [] });
    const second = out.take({ text: "one two", images: [] });
    await tick();
    calls[0].answer({ ok: false, message: "no terminal" });
    expect(await first?.done).toEqual({ ok: false, message: "no terminal" });
    expect(await second?.done).toEqual({ ok: false, skipped: true });
    expect(calls).toHaveLength(1);
    expect(out.untaken({ text: "one two", images: [] })).toEqual({ text: "one two", images: [] });
  });

  it("a send that throws is a failed send", async () => {
    const out = outbox(serial(), () => Promise.reject(new Error("gone")));
    expect(await out.take({ text: "x", images: [] })?.done).toEqual({ ok: false, message: "Error: gone" });
  });
});
