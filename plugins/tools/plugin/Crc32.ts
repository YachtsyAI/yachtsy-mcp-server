/**
 * CRC-32 (IEEE 802.3), as used by ZIP and PNG. Implemented here because
 * `zlib.crc32` only exists from Node 22.2 and this tool supports Node 20.
 */
export class Crc32 {
  private static readonly TABLE: Uint32Array = Crc32.buildTable();

  static of(...chunks: readonly Uint8Array[]): number {
    let crc = 0xffffffff;
    for (const chunk of chunks) {
      for (let index = 0; index < chunk.length; index += 1) {
        crc = (Crc32.TABLE[(crc ^ (chunk[index] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private static buildTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  }
}
