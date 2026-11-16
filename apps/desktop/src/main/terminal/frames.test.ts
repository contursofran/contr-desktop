import { describe, expect, it } from "vitest";
import { decodeAll, encode, KIND_DATA, KIND_RESIZE, MAX_PAYLOAD, resizePayload } from "./frames";

describe("hc frames", () => {
  it("encodes the header little endian", () => {
    expect([...encode(7, KIND_DATA, Buffer.from("hi"))]).toEqual([7, 0, 0, 0, 0, 2, 0, 0, 0, 104, 105]);
  });

  it("keeps a part of a frame for the next read", () => {
    const bytes = Buffer.concat([encode(1, KIND_DATA, Buffer.from("ab")), encode(2, KIND_RESIZE, resizePayload(80, 24))]);
    const first = decodeAll(bytes.subarray(0, 15));
    expect(first.frames.map((f) => f.payload.toString())).toEqual(["ab"]);
    expect(first.rest.length).toBe(4);
    const second = decodeAll(Buffer.concat([first.rest, bytes.subarray(15)]));
    expect(second.frames).toHaveLength(1);
    expect(second.frames[0].channel).toBe(2);
    expect([...second.frames[0].payload]).toEqual([80, 0, 24, 0]);
    expect(second.rest.length).toBe(0);
  });

  it("refuses a frame that is too long", () => {
    const bad = encode(1, KIND_DATA);
    bad.writeUInt32LE(MAX_PAYLOAD + 1, 5);
    expect(() => decodeAll(bad)).toThrow(/too long/);
  });
});
