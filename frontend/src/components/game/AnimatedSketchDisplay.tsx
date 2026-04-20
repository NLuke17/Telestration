import React, { useLayoutEffect, useRef, useMemo, useCallback, useState } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { ReactSketchCanvasRef } from 'react-sketch-canvas';
import type { CanvasPath } from 'react-sketch-canvas';
import { DRAWING_CANVAS_HEIGHT, DRAWING_CANVAS_WIDTH } from '../../constants/drawingCanvas';

/**
 * Parse JSON produced by `ReactSketchCanvas.exportPaths()` (stored in `Drawing.drawingData` or blobs).
 */
export function parseCanvasPathsJson(drawingData: string | null | undefined): CanvasPath[] | null {
    if (!drawingData || typeof drawingData !== 'string' || !drawingData.trim()) {
        return null;
    }
    try {
        const raw = JSON.parse(drawingData) as unknown;
        if (!Array.isArray(raw)) {
            return null;
        }
        const paths: CanvasPath[] = [];
        for (const item of raw) {
            if (!item || typeof item !== 'object') {
                continue;
            }
            const o = item as Record<string, unknown>;
            if (!Array.isArray(o.paths)) {
                continue;
            }
            const pts: { x: number; y: number }[] = [];
            for (const pt of o.paths) {
                if (!pt || typeof pt !== 'object') {
                    continue;
                }
                const p = pt as Record<string, unknown>;
                const x = Number(p.x);
                const y = Number(p.y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    continue;
                }
                pts.push({ x, y });
            }
            if (pts.length === 0) {
                continue;
            }
            const strokeWidth = typeof o.strokeWidth === 'number' ? o.strokeWidth : 4;
            const strokeColor = typeof o.strokeColor === 'string' ? o.strokeColor : '#000000';
            const drawMode = typeof o.drawMode === 'boolean' ? o.drawMode : true;
            paths.push({
                paths: pts,
                strokeWidth,
                strokeColor,
                drawMode,
            });
        }
        return paths.length > 0 ? paths : null;
    } catch {
        return null;
    }
}

export type AnimatedSketchDisplayProps = {
    drawingData: string | null | undefined;
    /** CSS width of the on-screen frame (e.g. `100%`, `260px`). Height follows the drawing canvas ratio. */
    width?: string;
    /** @deprecated Ignored; frame height follows the drawing canvas aspect ratio (600×360). */
    height?: string;
    /** Delay between each stroke (first stroke appears immediately). */
    strokeDelayMs?: number;
    className?: string;
    /** Bump to replay the same payload from a cleared canvas. */
    replayNonce?: number;
};

/**
 * Read-only sketch replay: progressively calls `loadPaths` so strokes appear in order.
 * Always renders at the same logical resolution as the drawing page, then scales to fit `width`.
 */
export const AnimatedSketchDisplay: React.FC<AnimatedSketchDisplayProps> = ({
    drawingData,
    width = '100%',
    strokeDelayMs = 90,
    className = '',
    replayNonce = 0,
}) => {
    const ref = useRef<ReactSketchCanvasRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const paths = useMemo(() => parseCanvasPathsJson(drawingData ?? null), [drawingData]);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const clearTimers = useCallback(() => {
        timersRef.current.forEach((t) => clearTimeout(t));
        timersRef.current = [];
    }, []);

    useLayoutEffect(() => {
        const el = wrapperRef.current;
        if (!el) {
            return;
        }
        const update = () => {
            const w = el.getBoundingClientRect().width;
            if (w > 0) {
                setScale(w / DRAWING_CANVAS_WIDTH);
            }
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useLayoutEffect(() => {
        const canvas = ref.current;
        clearTimers();
        if (!canvas) {
            return;
        }
        if (!paths?.length) {
            canvas.clearCanvas();
            return;
        }

        canvas.clearCanvas();
        let i = 0;

        const step = () => {
            const c = ref.current;
            if (!c) {
                return;
            }
            c.loadPaths(paths.slice(0, i + 1));
            i += 1;
            if (i >= paths.length) {
                return;
            }
            timersRef.current.push(setTimeout(step, strokeDelayMs));
        };

        step();

        return () => clearTimers();
    }, [paths, strokeDelayMs, replayNonce, clearTimers]);

    return (
        <div
            ref={wrapperRef}
            className={`rounded border border-dark-grey overflow-hidden bg-white ${className}`}
            style={{
                width,
                maxWidth: '100%',
                marginInline: 'auto',
                aspectRatio: `${DRAWING_CANVAS_WIDTH} / ${DRAWING_CANVAS_HEIGHT}`,
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: DRAWING_CANVAS_WIDTH,
                    height: DRAWING_CANVAS_HEIGHT,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            >
                <ReactSketchCanvas
                    ref={ref}
                    width={`${DRAWING_CANVAS_WIDTH}px`}
                    height={`${DRAWING_CANVAS_HEIGHT}px`}
                    strokeColor="#000000"
                    canvasColor="#ffffff"
                    style={{ pointerEvents: 'none', touchAction: 'none', display: 'block' }}
                />
            </div>
        </div>
    );
};
