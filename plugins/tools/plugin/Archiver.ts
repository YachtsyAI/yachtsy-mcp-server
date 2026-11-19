import { createHash } from "node:crypto";
import { Crc32 } from "./Crc32.js";
import type { PackageView } from "./PackageView.js";

/**
 * Deterministic ZIP writer. Entries are sorted by path, every timestamp is
 * the DOS epoch (1980-01-01 00:00), permissions are fixed (0644), there are
 * no extra fields and no directory entries, and every entry is stored
 * (method 0). Storing instead of deflating keeps the bytes independent of
 * the zlib build and the Node release, so the SHA-256 of a package
 * depends only on its contents. Packages are small (Markdown plus two
 * already-compressed PNGs), so the size cost is negligible.
 */
export class Archiver {
  private static readonly DOS_TIME = 0;
  private static readonly DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
  private static readonly UTF8_FLAG = 0x0800;
  private static readonly VERSION_NEEDED = 10; // stored entries only
  private static readonly VERSION_MADE_BY = (3 << 8) | 20; // Unix host
  private static readonly FILE_MODE = 0o100644;
  private static readonly STORE = 0;

  archive(view: PackageView): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;

    for (const [path, data] of view) {
      const name = Buffer.from(path, "utf8");
      const crc = Crc32.of(data);
      const method = Archiver.STORE;
      const payload = data;

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(Archiver.VERSION_NEEDED, 4);
      local.writeUInt16LE(Archiver.UTF8_FLAG, 6);
      local.writeUInt16LE(method, 8);
      local.writeUInt16LE(Archiver.DOS_TIME, 10);
      local.writeUInt16LE(Archiver.DOS_DATE, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(payload.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);
      locals.push(local, name, payload);

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(Archiver.VERSION_MADE_BY, 4);
      central.writeUInt16LE(Archiver.VERSION_NEEDED, 6);
      central.writeUInt16LE(Archiver.UTF8_FLAG, 8);
      central.writeUInt16LE(method, 10);
      central.writeUInt16LE(Archiver.DOS_TIME, 12);
      central.writeUInt16LE(Archiver.DOS_DATE, 14);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(payload.length, 20);
      central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(name.length, 28);
      central.writeUInt16LE(0, 30); // extra length
      central.writeUInt16LE(0, 32); // comment length
      central.writeUInt16LE(0, 34); // disk number
      central.writeUInt16LE(0, 36); // internal attributes
      central.writeUInt32LE((Archiver.FILE_MODE << 16) >>> 0, 38);
      central.writeUInt32LE(offset, 42);
      centrals.push(central, name);

      offset += local.length + name.length + payload.length;
    }

    const centralDirectory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(view.size, 8);
    end.writeUInt16LE(view.size, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...locals, centralDirectory, end]);
  }

  static sha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
}
