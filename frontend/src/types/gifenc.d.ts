declare module 'gifenc' {
  export type PaletteColor = [number, number, number] | [number, number, number, number];

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>
  ): PaletteColor[];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: PaletteColor[],
    format?: string
  ): Uint8Array;

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: PaletteColor[];
        delay?: number;
        first?: boolean;
        transparent?: boolean;
        transparentIndex?: number;
        repeat?: number;
        dispose?: number;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
    buffer: ArrayBuffer;
    stream: unknown;
  };
}
