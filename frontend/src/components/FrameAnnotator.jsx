import { useEffect, useMemo, useRef, useState } from "react";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function toImageSrc(frame) {
  const value = frame?.rgb_base64 || "";
  if (!value || typeof value !== "string") return null;
  return value.startsWith("data:") ? value : `data:image/jpeg;base64,${value}`;
}

function getNormalizedPoint(event, element) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return { x: 0, y: 0 };
  }
  const x = clamp((event.clientX - rect.left) / rect.width);
  const y = clamp((event.clientY - rect.top) / rect.height);
  return { x, y };
}

export default function FrameAnnotator({
  frame,
  analyzing,
  onAnalyze,
  onClearCapture,
}) {
  const [annotations, setAnnotations] = useState([]);
  const [draftRect, setDraftRect] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const stageRef = useRef(null);

  const imgSrc = useMemo(() => toImageSrc(frame), [frame]);

  useEffect(() => {
    setAnnotations([]);
    setDraftRect(null);
    setActiveId(null);
  }, [frame]);

  const handlePointerDown = (event) => {
    if (!imgSrc || !stageRef.current) return;
    const point = getNormalizedPoint(event, stageRef.current);
    setDraftRect({
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y,
      w: 0,
      h: 0,
    });
  };

  const handlePointerMove = (event) => {
    if (!draftRect || !stageRef.current) return;

    const point = getNormalizedPoint(event, stageRef.current);
    const x1 = Math.min(draftRect.startX, point.x);
    const y1 = Math.min(draftRect.startY, point.y);
    const x2 = Math.max(draftRect.startX, point.x);
    const y2 = Math.max(draftRect.startY, point.y);

    setDraftRect((prev) => ({
      ...prev,
      x: x1,
      y: y1,
      w: x2 - x1,
      h: y2 - y1,
    }));
  };

  const finalizeDraft = () => {
    if (!draftRect) return;
    if (draftRect.w < 0.01 || draftRect.h < 0.01) {
      setDraftRect(null);
      return;
    }

    const nextId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAnnotations((prev) => {
      const next = [
        ...prev,
        {
          id: nextId,
          label: `Region ${prev.length + 1}`,
          x: draftRect.x,
          y: draftRect.y,
          w: draftRect.w,
          h: draftRect.h,
        },
      ];
      return next;
    });
    setActiveId(nextId);
    setDraftRect(null);
  };

  const handleRemove = (id) => {
    setAnnotations((prev) => prev.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleLabelChange = (id, value) => {
    setAnnotations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label: value } : item)),
    );
  };

  return (
    <div className="h-full flex flex-col bg-detective-900 rounded-lg border border-detective-600/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-detective-800/50 border-b border-detective-600/20">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Frame Annotator
        </h3>
        <div className="text-[10px] text-gray-500 font-mono">
          {annotations.length} box{annotations.length !== 1 ? "es" : ""}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div
          ref={stageRef}
          className="relative flex-1 min-h-0 bg-black"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={finalizeDraft}
          onMouseLeave={finalizeDraft}
        >
          {imgSrc ? (
            <>
              <img
                src={imgSrc}
                alt="Captured frame"
                className="absolute inset-0 w-full h-full object-contain"
                draggable={false}
              />
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {annotations.map((box) => (
                  <g key={box.id}>
                    <rect
                      x={`${box.x * 100}%`}
                      y={`${box.y * 100}%`}
                      width={`${box.w * 100}%`}
                      height={`${box.h * 100}%`}
                      fill="rgba(30, 136, 229, 0.18)"
                      stroke={box.id === activeId ? "#29b6f6" : "#1e88e5"}
                      strokeWidth="2"
                    />
                    <text
                      x={`${(box.x + 0.004) * 100}%`}
                      y={`${Math.max(0.012, box.y - 0.006) * 100}%`}
                      fill="#e3f2fd"
                      fontSize="10"
                    >
                      {box.label}
                    </text>
                  </g>
                ))}
                {draftRect && (
                  <rect
                    x={`${draftRect.x * 100}%`}
                    y={`${draftRect.y * 100}%`}
                    width={`${draftRect.w * 100}%`}
                    height={`${draftRect.h * 100}%`}
                    fill="rgba(102, 187, 106, 0.16)"
                    stroke="#66bb6a"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                )}
              </svg>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6">
              <p className="text-xs text-gray-500 leading-relaxed">
                Use Capture in Footage Review to bring a frame here,
                then drag to annotate regions.
              </p>
            </div>
          )}
        </div>

        <div className="p-2 border-t border-detective-600/20 bg-detective-900/80">
          <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
            {annotations.length === 0 ? (
              <div className="text-[10px] text-gray-500">
                No annotations yet.
              </div>
            ) : (
              annotations.map((item) => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleLabelChange(item.id, e.target.value)}
                    onFocus={() => setActiveId(item.id)}
                    className="flex-1 h-6 px-2 rounded bg-detective-800/70 border border-detective-600/30 text-[10px] text-gray-200 focus:outline-none focus:border-detective-accent/40"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="h-6 px-2 text-[10px] rounded border border-detective-danger/35 bg-detective-danger/10 text-detective-danger"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onClearCapture?.()}
              disabled={!frame}
              className="h-7 px-2.5 rounded border border-detective-600/30 bg-detective-800/50 text-[10px] text-gray-300 disabled:opacity-40"
            >
              Clear Capture
            </button>
            <button
              type="button"
              onClick={() => onAnalyze?.(annotations)}
              disabled={!frame || analyzing}
              className="h-7 px-3 rounded border border-detective-accent/35 bg-detective-accent/15 text-[10px] font-semibold text-detective-accent disabled:opacity-40"
            >
              {analyzing ? "Analyzing..." : "Analyze Frame"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
