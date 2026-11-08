/** A small zip writer (stored, no compression): enough for a backup of text files, no library needed. */
const table = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function zip(files: { name: string; data: string | Blob | Uint8Array }[], when = new Date()): Promise<Blob> {
  const enc = new TextEncoder();
  const time = ((when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)) & 0xffff;
  const date = (((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()) & 0xffff;
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data instanceof Blob ? new Uint8Array(await f.data.arrayBuffer()) : f.data;
    const name = enc.encode(f.name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // names in UTF-8
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    const entry = new Uint8Array(46 + name.length);
    entry.set(new Uint8Array(c.buffer), 0);
    entry.set(name, 46);
    central.push(entry);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, e) => n + e.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}

/** Read the files of a zip made by `zip` (stored entries only). */
export async function unzip(blob: Blob): Promise<Map<string, Uint8Array>> {
  const b = new Uint8Array(await blob.arrayBuffer());
  const v = new DataView(b.buffer);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  let p = 0;
  while (p + 30 <= b.length && v.getUint32(p, true) === 0x04034b50) {
    const method = v.getUint16(p + 8, true);
    const size = v.getUint32(p + 18, true);
    const nameLen = v.getUint16(p + 26, true);
    const extra = v.getUint16(p + 28, true);
    const name = dec.decode(b.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extra;
    if (method === 0) out.set(name, b.subarray(start, start + size));
    p = start + size;
  }
  return out;
}
