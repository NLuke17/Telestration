import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { ReactSketchCanvasRef } from 'react-sketch-canvas';
import { parseCanvasPathsJson } from '../../components/game/AnimatedSketchDisplay';
import {
  getSavedFlipbookPresentation,
  type SavedFlipbookPresentationResponse,
} from '../../services/api/gameApi';

/** Matches drawing export coordinates; scaled down to fit `VIEW` below. */
const LOGICAL_W = 600;
const LOGICAL_H = 360;
const VIEW_W = 200;
const VIEW_H = 120;
const VIEW_SCALE = Math.min(VIEW_W / LOGICAL_W, VIEW_H / LOGICAL_H);
const CYCLE_MS = 2600;

function SketchStillFrame({
  drawingData,
  replayKey,
}: {
  drawingData: string;
  replayKey: number;
}) {
  const ref = useRef<ReactSketchCanvasRef>(null);
  const paths = useMemo(() => parseCanvasPathsJson(drawingData), [drawingData]);

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) {
      return;
    }
    if (!paths?.length) {
      c.clearCanvas();
      return;
    }
    c.clearCanvas();
    c.loadPaths(paths);
  }, [paths, drawingData, replayKey]);

  return (
    <div
      className="mx-auto overflow-hidden rounded-sm border border-gray-100 bg-white"
      style={{ width: VIEW_W, height: VIEW_H }}
    >
      <div className="relative" style={{ width: VIEW_W, height: VIEW_H }}>
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: LOGICAL_W,
            height: LOGICAL_H,
            transform: `translate(-50%, -50%) scale(${VIEW_SCALE})`,
          }}
        >
          <ReactSketchCanvas
            ref={ref}
            width={`${LOGICAL_W}px`}
            height={`${LOGICAL_H}px`}
            strokeColor="#000000"
            canvasColor="#ffffff"
            style={{ pointerEvents: 'none', touchAction: 'none', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}

type Props = {
  savedId: string;
};

const SavedFlipbookPreview: React.FC<Props> = ({ savedId }) => {
  const [data, setData] = useState<SavedFlipbookPresentationResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [drawingIndex, setDrawingIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getSavedFlipbookPresentation(savedId);
        if (!cancelled) {
          setData(res);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setData(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [savedId]);

  const promptText = data?.savedFlipbook.prompt ?? '';
  const drawings = useMemo(() => {
    const tl = data?.timeline;
    if (!tl) {
      return [];
    }
    return tl.filter((e): e is (typeof tl)[number] & { kind: 'drawing' } => e.kind === 'drawing');
  }, [data]);

  useEffect(() => {
    if (drawings.length <= 1) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setDrawingIndex((i) => (i + 1) % drawings.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [drawings.length]);

  useEffect(() => {
    setDrawingIndex(0);
  }, [savedId, drawings.length]);

  if (loadError) {
    return (
      <div
        className="mx-auto rounded-md border border-dashed border-gray-300 bg-slate-50 flex items-center justify-center text-center text-[11px] text-gray-500 px-2"
        style={{ width: VIEW_W, height: VIEW_H }}
      >
        Preview unavailable
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="mx-auto rounded-md border border-light-grey bg-slate-50 animate-pulse"
        style={{ width: VIEW_W, height: VIEW_H }}
      />
    );
  }

  const current = drawings[drawingIndex];
  const hasDrawings = drawings.length > 0;

  return (
    <div
      className="mx-auto flex w-full max-w-[200px] flex-col items-stretch overflow-hidden rounded-md border border-dark-grey bg-white"
      aria-live="polite"
    >
      <div className="flex flex-col border-b border-light-grey bg-slate-50 px-2 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Prompt</span>
        <p className="text-center text-[11px] leading-snug text-brand-charcoal line-clamp-4">{promptText}</p>
      </div>
      <div className="flex flex-col items-center bg-white py-2">
        {hasDrawings && current ? (
          <SketchStillFrame drawingData={current.drawingData} replayKey={drawingIndex} />
        ) : (
          <div
            className="mx-auto flex items-center justify-center rounded-sm border border-dashed border-gray-200 px-2 text-center text-[11px] text-gray-500"
            style={{ width: VIEW_W, height: VIEW_H }}
          >
            No drawings
          </div>
        )}
      </div>
      {hasDrawings ? (
        <div className="flex flex-col items-center gap-0.5 border-t border-light-grey bg-slate-50 px-2 py-1.5 text-center">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">
            {current?.authorUsername ?? '—'}
          </span>
          <span className="text-[10px] text-gray-600">
            {drawingIndex + 1} / {drawings.length}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default SavedFlipbookPreview;
