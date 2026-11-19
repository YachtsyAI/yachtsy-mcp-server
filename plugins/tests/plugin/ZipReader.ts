import { inflateRawSync } from "node:zlib";
import { Crc32 } from "../../tools/plugin/Crc32.js";

export interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly dosTime: number;
  readonly dosDate: number;
  readonly externalAttributes: number;
  readonly data: Buffer;
}

/** Test-only ZIP reader: walks the central directory and checks CRCs. */
export class ZipReader {
  static read(archive: Buffer): ZipEntry[] {
    const endOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (endOffset < 0) throw new Error("no end of central directory");
    const count = archive.readUInt16LE(endOffset + 10);
    let offset = archive.readUInt32LE(endOffset + 16);
    const entries: ZipEntry[] = [];
    for (let index = 0; index < count; index += 1) {
      if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error("bad central header");
      const method = archive.readUInt16LE(offset + 10);
      const dosTime = archive.readUInt16LE(offset + 12);
      const dosDate = archive.readUInt16LE(offset + 14);
      const crc = archive.readUInt32LE(offset + 16);
      const compressedSize = archive.readUInt32LE(offset + 20);
      const nameLength = archive.readUInt16LE(offset + 28);
      const extraLength = archive.readUInt16LE(offset + 30);
      const commentLength = archive.readUInt16LE(offset + 32);
      const externalAttributes = archive.readUInt32LE(offset + 38);
      const localOffset = archive.readUInt32LE(offset + 42);
      const name = archive.toString("utf8", offset + 46, offset + 46 + nameLength);

      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const raw = archive.subarray(start, start + compressedSize);
      const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
      if (Crc32.of(data) !== crc) throw new Error(`CRC mismatch for ${name}`);
      entries.push({ name, method, dosTime, dosDate, externalAttributes, data });
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }
}
