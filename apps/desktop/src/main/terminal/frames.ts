// hc's framed wire layout: channel (u32), kind (u8), payload length (u32), little endian, then the payload.
// The same layout as herdr-contr-feed's framed.rs.

export const HEADER_LEN = 9;
export const MAX_PAYLOAD = 16 << 20;
export const KIND_DATA = 0;
export const KIND_CLOSE = 2;
export const KIND_RESIZE = 3;
export const KIND_FACTS = 5;

export interface Frame {
  channel: number;
  kind: number;
  payload: Buffer;
}

export function encode(channel: number, kind: number, payload: Buffer = Buffer.alloc(0)): Buffer {
  const head = Buffer.alloc(HEADER_LEN);
  head.writeUInt32LE(channel, 0);
  head.writeUInt8(kind, 4);
  head.writeUInt32LE(payload.length, 5);
  return Buffer.concat([head, payload]);
}

export function resizePayload(cols: number, rows: number): Buffer {
  const p = Buffer.alloc(4);
  p.writeUInt16LE(cols, 0);
  p.writeUInt16LE(rows, 2);
  return p;
}

/** Takes the complete frames from the front of `buf`. Returns them and the bytes that are left. */
export function decodeAll(buf: Buffer): { frames: Frame[]; rest: Buffer } {
  const frames: Frame[] = [];
  let at = 0;
  while (buf.length - at >= HEADER_LEN) {
    const n = buf.readUInt32LE(at + 5);
    if (n > MAX_PAYLOAD) throw new Error(`frame too long: ${n} bytes`);
    if (buf.length - at < HEADER_LEN + n) break;
    frames.push({
      channel: buf.readUInt32LE(at),
      kind: buf[at + 4],
      payload: buf.subarray(at + HEADER_LEN, at + HEADER_LEN + n),
    });
    at += HEADER_LEN + n;
  }
  return { frames, rest: buf.subarray(at) };
}
