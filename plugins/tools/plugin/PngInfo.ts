/** Reads the PNG signature and IHDR chunk; enough to validate assets. */
export class PngInfo {
  private static readonly SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  private constructor(
    readonly width: number,
    readonly height: number,
    readonly bitDepth: number,
    readonly colorType: number,
  ) {}

  static read(bytes: Buffer): PngInfo | null {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PngInfo.SIGNATURE)) return null;
    if (bytes.toString("ascii", 12, 16) !== "IHDR") return null;
    return new PngInfo(bytes.readUInt32BE(16), bytes.readUInt32BE(20), bytes.readUInt8(24), bytes.readUInt8(25));
  }

  get hasAlpha(): boolean {
    return this.colorType === 4 || this.colorType === 6;
  }
}
