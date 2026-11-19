/** WCAG 2.x relative luminance and contrast ratio for `#RRGGBB` colours. */
export class Contrast {
  private static readonly HEX = /^#[0-9A-Fa-f]{6}$/;

  static isHex(value: string): boolean {
    return Contrast.HEX.test(value);
  }

  static ratio(foreground: string, background: string): number {
    const a = Contrast.luminance(foreground);
    const b = Contrast.luminance(background);
    const [light, dark] = a > b ? [a, b] : [b, a];
    return (light + 0.05) / (dark + 0.05);
  }

  static luminance(hex: string): number {
    if (!Contrast.isHex(hex)) throw new Error(`Not a #RRGGBB colour: ${hex}`);
    const channel = (offset: number): number => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  }
}
