import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { CanvasPath } from 'react-sketch-canvas';
import { parseCanvasPathsJson } from '../components/game/AnimatedSketchDisplay';

/** Match in-game drawing canvas so stored path coordinates line up. */
export const FLIPBOOK_GIF_CANVAS_WIDTH = 600;
export const FLIPBOOK_GIF_CANVAS_HEIGHT = 360;

function drawPaths(
  ctx: CanvasRenderingContext2D,
  paths: CanvasPath[],
  width: number,
  height: number
): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  for (const stroke of paths) {
    const pts = stroke.paths;
    if (pts.length < 2) {
      continue;
    }
    ctx.lineWidth = stroke.strokeWidth;
    ctx.strokeStyle = stroke.strokeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = stroke.drawMode ? 'source-over' : 'destination-out';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function renderDrawingToRgba(
  drawingData: string,
  width: number,
  height: number,
  scratch: HTMLCanvasElement
): Uint8ClampedArray | null {
  const paths = parseCanvasPathsJson(drawingData);
  if (!paths?.length) {
    return null;
  }
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext('2d');
  if (!ctx) {
    return null;
  }
  drawPaths(ctx, paths, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

/**
 * Encodes each drawing panel (in order) as one GIF frame, white background, looping animation.
 */
export function encodeDrawingsAsAnimatedGif(
  drawingDataStrings: string[],
  options?: { frameDelayMs?: number; scratchCanvas?: HTMLCanvasElement }
): Uint8Array {
  const width = FLIPBOOK_GIF_CANVAS_WIDTH;
  const height = FLIPBOOK_GIF_CANVAS_HEIGHT;
  const delay = options?.frameDelayMs ?? 750;
  const scratch = options?.scratchCanvas ?? document.createElement('canvas');

  const frames: Uint8ClampedArray[] = [];
  for (const data of drawingDataStrings) {
    const rgba = renderDrawingToRgba(data, width, height, scratch);
    if (rgba) {
      frames.push(new Uint8ClampedArray(rgba));
    }
  }

  if (frames.length === 0) {
    throw new Error('NO_DRAWING_FRAMES');
  }

  const gif = GIFEncoder();
  for (const data of frames) {
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay });
  }
  gif.finish();
  return gif.bytes();
}
