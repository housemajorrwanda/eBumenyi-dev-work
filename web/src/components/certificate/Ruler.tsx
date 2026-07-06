import { useEffect, useRef, useState } from "react";

export const RULER_THICKNESS = 20;

const BG          = "#f5f5f5";
const TICK_COLOR  = "#aaa";
const TEXT_COLOR  = "#888";
const EDGE_COLOR  = "#4f8ef7";
const CURSOR_COLOR = "#e44";
const BORDER_COLOR = "#ddd";

interface Props {
  orientation: "horizontal" | "vertical";
  /** Logical canvas size in canvas-px (CANVAS_WIDTH or CANVAS_HEIGHT) */
  canvasSize: number;
  /** Zoom percentage, e.g. 75 */
  zoom: number;
  /** Distance from the ruler's start edge to the canvas origin, in scroll-document px */
  canvasStart: number;
  /** Current scroll offset of the canvas container (scrollLeft or scrollTop) */
  scrollOffset: number;
  /** Current mouse position in screen px from the ruler's start edge (undefined = off canvas) */
  mousePos?: number;
  /** Called when the user presses down on the ruler to start dragging a guide */
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function Ruler({ orientation, canvasSize, zoom, canvasStart, scrollOffset, mousePos, onMouseDown }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [length, setLength] = useState(0);
  const isH = orientation === "horizontal";

  // Measure container so the canvas fills it exactly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setLength(isH ? r.width : r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isH]);

  // Redraw whenever anything changes
  useEffect(() => {
    if (length === 0) return;
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const scale = zoom / 100;
    const W = isH ? length : RULER_THICKNESS;
    const H = isH ? RULER_THICKNESS : length;
    el.width  = W;
    el.height = H;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Pick tick step: smallest candidate where tickStep * scale >= 50 screen px
    const MIN_SCREEN = 50;
    const candidates = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000];
    let tickStep = 100;
    for (const c of candidates) {
      if (c * scale >= MIN_SCREEN) { tickStep = c; break; }
    }
    const minorStep = tickStep / 5;

    // Canvas coordinate range that's visible in the ruler
    const startC = (scrollOffset - canvasStart) / scale;
    const endC   = (scrollOffset - canvasStart + length) / scale;

    const screenPos = (c: number) => canvasStart - scrollOffset + c * scale;

    // Draw minor ticks
    const firstMinor = Math.floor(startC / minorStep) * minorStep;
    for (let c = firstMinor; c <= endC + minorStep; c += minorStep) {
      if (Math.abs((c % tickStep) / tickStep) < 0.01) continue; // skip major positions
      const s = screenPos(c);
      if (s < 0 || s > length) continue;
      const tickLen = RULER_THICKNESS * 0.3;
      ctx.strokeStyle = TICK_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      if (isH) { ctx.moveTo(s, H - tickLen); ctx.lineTo(s, H); }
      else      { ctx.moveTo(W - tickLen, s); ctx.lineTo(W, s); }
      ctx.stroke();
    }

    // Draw major ticks + labels
    const firstMajor = Math.floor(startC / tickStep) * tickStep;
    for (let c = firstMajor; c <= endC + tickStep; c += tickStep) {
      const s = screenPos(c);
      if (s < 0 || s > length) continue;
      const tickLen = RULER_THICKNESS * 0.55;
      ctx.strokeStyle = TICK_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      if (isH) { ctx.moveTo(s, H - tickLen); ctx.lineTo(s, H); }
      else      { ctx.moveTo(W - tickLen, s); ctx.lineTo(W, s); }
      ctx.stroke();

      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "9px sans-serif";
      const label = String(Math.round(c));
      if (isH) {
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, s + 2, 1);
      } else {
        ctx.save();
        ctx.translate(W - tickLen - 2, s);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }

    // Canvas edge markers (blue lines at 0 and canvasSize)
    for (const edge of [0, canvasSize]) {
      const s = screenPos(edge);
      if (s < 0 || s > length) continue;
      ctx.strokeStyle = EDGE_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (isH) { ctx.moveTo(s, 0); ctx.lineTo(s, H); }
      else      { ctx.moveTo(0, s); ctx.lineTo(W, s); }
      ctx.stroke();
    }

    // Cursor indicator
    if (mousePos !== undefined && mousePos >= 0 && mousePos <= length) {
      ctx.strokeStyle = CURSOR_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (isH) { ctx.moveTo(mousePos, 0); ctx.lineTo(mousePos, H); }
      else      { ctx.moveTo(0, mousePos); ctx.lineTo(W, mousePos); }
      ctx.stroke();
    }

    // Border along the inner edge
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (isH) { ctx.moveTo(0, H - 0.5); ctx.lineTo(W, H - 0.5); }
    else      { ctx.moveTo(W - 0.5, 0); ctx.lineTo(W - 0.5, H); }
    ctx.stroke();

  }, [isH, length, zoom, canvasStart, scrollOffset, mousePos, canvasSize]);

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      style={{
        width:      isH ? "100%" : RULER_THICKNESS,
        height:     isH ? RULER_THICKNESS : "100%",
        overflow:   "hidden",
        flexShrink: 0,
        userSelect: "none",
        cursor:     "crosshair",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
