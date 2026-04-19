import { useCallback, useEffect, useRef, useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCanvasPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

function drawAnnotations(ctx, annotations, canvasW, canvasH, naturalW, naturalH) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const scaleX = canvasW / naturalW;
  const scaleY = canvasH / naturalH;
  annotations.forEach((ann, i) => {
    const rx = ann.x * naturalW * scaleX;
    const ry = ann.y * naturalH * scaleY;
    const rw = ann.width * naturalW * scaleX;
    const rh = ann.height * naturalH * scaleY;
    ctx.strokeStyle = "rgba(0, 212, 255, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(0, 212, 255, 0.08)";
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 212, 255, 0.9)";
    ctx.font = "11px monospace";
    ctx.fillText(`${i + 1}. ${ann.label}`, rx + 4, ry - 4 > 0 ? ry - 4 : ry + 14);
  });
}

function drawPreview(ctx, start, current, canvasW, canvasH) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const w = Math.abs(current.x - start.x);
  const h = Math.abs(current.y - start.y);
  ctx.strokeStyle = "rgba(0, 212, 255, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.fillStyle = "rgba(0, 212, 255, 0.1)";
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AnnotationPopup({ box, onSubmit, onCancel }) {
  const [label, setLabel] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const trimmed = label.trim();
    if (trimmed) onSubmit(trimmed);
    else onCancel();
  };

  return (
    <div
      className="absolute z-20 bg-detective-800 border border-detective-accent/40 rounded-xl shadow-lg p-3 w-56"
      style={{ left: box.popX, top: box.popY }}
    >
      <p className="text-[10px] text-detective-accent/70 uppercase tracking-wider mb-2">
        Annotate region
      </p>
      <input
        ref={inputRef}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Describe what you see…"
        className="w-full bg-detective-900/60 border border-detective-600/30 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-detective-accent/50 mb-2.5"
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          className="flex-1 px-2 py-1.5 bg-detective-accent/20 text-detective-accent border border-detective-accent/30 rounded-lg text-[11px] font-medium hover:bg-detective-accent/30 transition-colors"
        >
          Submit
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-2 py-1.5 bg-detective-800/60 text-gray-400 border border-detective-600/20 rounded-lg text-[11px] hover:text-gray-200 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FrameAnnotator({
  frame,
  annotations,
  onAnnotationsChange,
  onAnalyze,
  disabled,
}) {
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [pendingBox, setPendingBox] = useState(null);

  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // ── Canvas sizing ──────────────────────────────────────────────────────────
  const handleImgLoad = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    const ctx = canvas.getContext("2d");
    drawAnnotations(ctx, annotations, canvas.width, canvas.height, img.naturalWidth, img.naturalHeight);
  }, [annotations]);

  // ResizeObserver to handle container resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (imgRef.current && imgRef.current.complete) {
        handleImgLoad();
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [handleImgLoad]);

  // ── Redraw on annotation change ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.naturalWidth) return;
    if (drawing) return;
    const ctx = canvas.getContext("2d");
    drawAnnotations(ctx, annotations, canvas.width, canvas.height, img.naturalWidth, img.naturalHeight);
  }, [annotations, drawing]);

  // ── Draw interaction ───────────────────────────────────────────────────────
  const startDraw = useCallback((e) => {
    if (pendingBox || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getCanvasPos(e, canvas);
    setDrawing(true);
    setDrawStart(pos);
  }, [pendingBox, disabled]);

  const moveDraw = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getCanvasPos(e, canvas);
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;
    drawAnnotations(ctx, annotations, canvas.width, canvas.height, img.naturalWidth, img.naturalHeight);
    drawPreview(ctx, drawStart, pos, canvas.width, canvas.height);
  }, [drawing, drawStart, annotations]);

  const endDraw = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);

    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;

    const src = e.type === "touchend" && e.changedTouches?.length
      ? { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }
      : e;
    const pos = getCanvasPos(src, canvas);

    const x1 = Math.min(drawStart.x, pos.x);
    const y1 = Math.min(drawStart.y, pos.y);
    const x2 = Math.max(drawStart.x, pos.x);
    const y2 = Math.max(drawStart.y, pos.y);
    const w = x2 - x1;
    const h = y2 - y1;

    if (w < 8 || h < 8) {
      const ctx = canvas.getContext("2d");
      drawAnnotations(ctx, annotations, canvas.width, canvas.height, img.naturalWidth, img.naturalHeight);
      return;
    }

    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    const normX = (x1 * scaleX) / img.naturalWidth;
    const normY = (y1 * scaleY) / img.naturalHeight;
    const normW = (w * scaleX) / img.naturalWidth;
    const normH = (h * scaleY) / img.naturalHeight;

    const popX = Math.min(x1, canvas.width - 230);
    const popY = Math.min(y2 + 8, canvas.height - 120);

    setPendingBox({ x: normX, y: normY, width: normW, height: normH, popX, popY });
  }, [drawing, drawStart, annotations]);

  const submitAnnotation = useCallback((label) => {
    const { popX, popY, ...coords } = pendingBox;
    onAnnotationsChange([...annotations, { ...coords, label }]);
    setPendingBox(null);
  }, [pendingBox, annotations, onAnnotationsChange]);

  const cancelAnnotation = useCallback(() => {
    setPendingBox(null);
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    drawAnnotations(ctx, annotations, canvas.width, canvas.height, img.naturalWidth, img.naturalHeight);
  }, [annotations]);

  const deleteAnnotation = useCallback((idx) => {
    onAnnotationsChange(annotations.filter((_, i) => i !== idx));
  }, [annotations, onAnnotationsChange]);

  // ── Idle state ─────────────────────────────────────────────────────────────
  if (!frame) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Frame Annotator
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3 bg-detective-900/40">
          <div className="w-14 h-14 rounded-full border border-detective-accent/20 bg-detective-accent/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-detective-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-300">No Frame Captured</p>
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-xs">
            Capture a frame from the live feed to begin annotation
          </p>
        </div>
      </div>
    );
  }

  // ── Active state ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Frame Annotator
          </h2>
          <span className="text-[9px] bg-detective-accent/10 text-detective-accent/70 px-1.5 py-0.5 rounded border border-detective-accent/15">
            Captured
          </span>
        </div>
        {frame.timestamp && (
          <span className="text-[10px] text-gray-500 font-mono">
            {new Date(frame.timestamp * 1000).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 gap-3 flex flex-col">
        {/* Canvas frame */}
        <div ref={containerRef} className="relative select-none shrink-0" style={{ lineHeight: 0 }}>
          <img
            ref={imgRef}
            src={`data:image/jpeg;base64,${frame.rgb_base64}`}
            alt="Captured frame"
            onLoad={handleImgLoad}
            className="w-full rounded-xl block"
            draggable={false}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full rounded-xl"
            style={{ cursor: disabled ? "default" : "crosshair" }}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={(e) => { if (drawing) endDraw(e); }}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
          {pendingBox && (
            <AnnotationPopup
              box={pendingBox}
              onSubmit={submitAnnotation}
              onCancel={cancelAnnotation}
            />
          )}
        </div>

        {/* Annotation list */}
        {annotations.length > 0 && (
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Annotations ({annotations.length})
              </span>
              <button
                onClick={() => onAnnotationsChange([])}
                className="text-[9px] text-gray-600 hover:text-detective-danger transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-1">
              {annotations.map((ann, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-detective-800/40 border border-detective-600/15 rounded-lg px-2.5 py-1.5"
                >
                  <span className="text-[9px] font-bold text-detective-accent/70 w-4 shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[11px] text-gray-300 truncate">{ann.label}</span>
                  <button
                    onClick={() => deleteAnnotation(i)}
                    className="text-[10px] text-gray-600 hover:text-detective-danger transition-colors shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Draw hint */}
        {annotations.length === 0 && (
          <p className="text-[10px] text-gray-600 text-center shrink-0">
            Click and drag on the frame to annotate regions of interest
          </p>
        )}

        {/* Analyze button */}
        {annotations.length > 0 && (
          <button
            onClick={onAnalyze}
            disabled={disabled}
            className="w-full py-2 rounded-xl font-medium text-sm bg-gradient-to-r from-detective-accent to-blue-600 text-white hover:opacity-90 transition-opacity shadow-lg shadow-detective-accent/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disabled ? "Analyzing…" : "Analyze Frame"}
          </button>
        )}
      </div>
    </div>
  );
}
