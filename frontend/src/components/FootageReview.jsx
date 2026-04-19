import { useEffect, useRef, useState } from "react";

const VIEW_MODES = [
  { id: "rgb", label: "NORMAL", accent: "from-blue-500 to-cyan-500" },
  { id: "depth", label: "DEPTH", accent: "from-violet-500 to-indigo-500" },
];

const MODE_TINT = {
  rgb: "from-blue-950/30 via-transparent to-cyan-950/20",
  depth: "from-violet-950/50 via-transparent to-indigo-950/30",
};

export default function FootageReview({
  frames,
  viewMode,
  onViewModeChange,
  backendConnected,
  onVisionSync,
  syncing,
}) {
  const [zoom, setZoom] = useState(1);
  const [frameIndex, setFrameIndex] = useState(-1); // -1 = latest
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackFps, setPlaybackFps] = useState(10);
  const containerRef = useRef(null);

  // Resolve which frame to show
  const totalFrames = frames.length;
  const displayIndex =
    frameIndex < 0 || frameIndex >= totalFrames
      ? totalFrames - 1
      : frameIndex;
  let currentFrame = totalFrames > 0 ? frames[displayIndex] : null;

  useEffect(() => {
    setTimeout(() => {
      if(displayIndex == totalFrames) return;
      displayIndex++;
      currentFrame = frames[displayIndex]
    })
  }, [currentFrame])

  // Auto-follow latest when at the end
  useEffect(() => {
    if (isPlaying) return;
    if (frameIndex < 0 || frameIndex >= totalFrames - 1) {
      setFrameIndex(-1);
    }
  }, [totalFrames, frameIndex, isPlaying]);

  useEffect(() => {
    if (!isPlaying || totalFrames <= 1) return;

    const intervalMs = Math.max(50, Math.floor(1000 / playbackFps));
    const timer = setInterval(() => {
      setFrameIndex((prev) => {
        const current = prev < 0 ? 0 : prev;
        if (current >= totalFrames - 1) return 0;
        return current + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackFps, totalFrames]);

  useEffect(() => {
    if (totalFrames === 0 && isPlaying) {
      setIsPlaying(false);
    }
  }, [totalFrames, isPlaying]);

  const imgSrc = currentFrame
    ? viewMode === "depth" && currentFrame.depth_base64
      ? `data:image/jpeg;base64,${currentFrame.depth_base64}`
      : currentFrame.rgb_base64
        ? `data:image/jpeg;base64,${currentFrame.rgb_base64}`
        : null
    : null;

  const handleZoomChange = (next) => {
    setZoom(Math.max(1, Math.min(2.5, Number(next))));
  };

  const stepFrame = (delta) => {
    setIsPlaying(false);
    setFrameIndex((prev) => {
      const current = prev < 0 ? totalFrames - 1 : prev;
      const next = current + delta;
      if (next < 0) return 0;
      if (next >= totalFrames) return -1; // snap to latest
      return next;
    });
  };

  const togglePlayback = () => {
    if (totalFrames === 0) return;
    setIsPlaying((prev) => {
      if (!prev && (frameIndex < 0 || frameIndex >= totalFrames - 1)) {
        setFrameIndex(0);
      }
      return !prev;
    });
  };

  const handleFrameScrub = (nextIndex) => {
    setIsPlaying(false);
    setFrameIndex(nextIndex);
  };

  const isLive = frameIndex < 0 || frameIndex >= totalFrames - 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-detective-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Footage
          </h2>
          {totalFrames > 0 && (
            <span className="text-[10px] font-mono text-gray-500">
              {totalFrames} frames
            </span>
          )}
          {isLive && totalFrames > 0 && (
            <span className="text-[9px] bg-detective-danger/15 text-detective-danger px-1.5 py-0.5 rounded border border-detective-danger/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-detective-danger recording-pulse" />
              LIVE
            </span>
          )}
          {isPlaying && totalFrames > 0 && (
            <span className="text-[9px] bg-detective-success/15 text-detective-success px-1.5 py-0.5 rounded border border-detective-success/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-detective-success recording-pulse" />
              PLAYING
            </span>
          )}
        </div>
        <div className="flex gap-0.5 bg-detective-900/50 rounded p-0.5">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onViewModeChange(mode.id)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                viewMode === mode.id
                  ? `bg-gradient-to-r ${mode.accent} text-white`
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Frame display */}
      <div ref={containerRef} className="flex-1 relative bg-black overflow-hidden">
        {imgSrc != null ? (
          <>
            <img
              src={imgSrc}
              alt={`${viewMode} frame`}
              className="absolute inset-0 h-full w-full object-contain"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
              }}
            />

            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${MODE_TINT[viewMode]}`}
            />

            <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-gray-300">
              {VIEW_MODES.find((m) => m.id === viewMode)?.label} VIEW
            </div>

            <div className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-gray-300">
              {Math.round(zoom * 100)}%
            </div>

            {currentFrame && (
              <div className="absolute left-2 bottom-2 rounded bg-black/60 px-2 py-1 text-[9px] text-gray-400 font-mono">
                Frame {displayIndex + 1}/{totalFrames}
                {currentFrame.timestamp && (
                  <span className="ml-2">
                    {new Date(currentFrame.timestamp * 1000).toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {currentFrame?.detections?.length > 0 && (
              <div className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-[9px] text-gray-400">
                {currentFrame.detections.length} detection{currentFrame.detections.length !== 1 ? "s" : ""}
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-detective-800 to-detective-900 px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-detective-accent/20 bg-detective-accent/10">
              <svg
                className="h-7 w-7 text-detective-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-6 4h2a2 2 0 002-2V8a2 2 0 00-2-2H9a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-200">
              No Footage Loaded
            </p>
            <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-gray-500">
              Click Vision Sync Trigger to pull camera data from the backend and run analysis.
            </p>
            <button
              type="button"
              onClick={onVisionSync}
              disabled={syncing || !backendConnected}
              className="mt-4 rounded-lg border border-detective-accent/30 bg-detective-accent/15 px-4 py-2 text-xs font-medium text-detective-accent transition-colors hover:bg-detective-accent/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {syncing ? "Syncing..." : "Vision Sync Trigger"}
            </button>
            <div className="mt-3 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${backendConnected ? "bg-detective-success" : "bg-detective-danger"}`} />
              <span className="text-[11px] text-gray-400">
                {backendConnected ? "Backend online" : "Backend offline"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-detective-800/50 border-t border-detective-600/20 shrink-0">
        {/* Frame navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={totalFrames === 0}
            className="h-6 px-2 rounded border border-detective-accent/30 bg-detective-accent/15 text-[10px] font-medium text-detective-accent transition-colors hover:bg-detective-accent/25 disabled:opacity-40 disabled:cursor-not-allowed"
            title={isPlaying ? "Pause playback" : "Play frames as video"}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => stepFrame(-10)}
            disabled={totalFrames === 0}
            className="h-6 px-1.5 rounded border border-detective-600/20 text-[10px] text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Back 10 frames"
          >
            -10
          </button>
          <button
            type="button"
            onClick={() => stepFrame(-1)}
            disabled={totalFrames === 0}
            className="h-6 w-6 rounded border border-detective-600/20 text-[10px] text-gray-400 transition-colors hover:text-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous frame"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => stepFrame(1)}
            disabled={totalFrames === 0}
            className="h-6 w-6 rounded border border-detective-600/20 text-[10px] text-gray-400 transition-colors hover:text-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next frame"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => stepFrame(10)}
            disabled={totalFrames === 0}
            className="h-6 px-1.5 rounded border border-detective-600/20 text-[10px] text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Forward 10 frames"
          >
            +10
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex(-1);
            }}
            disabled={totalFrames === 0 || isLive}
            className="h-6 px-2 rounded border border-detective-accent/30 bg-detective-accent/15 text-[10px] font-medium text-detective-accent transition-colors hover:bg-detective-accent/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Live
          </button>
          <button
            type="button"
            onClick={onVisionSync}
            disabled={syncing || !backendConnected}
            className="h-6 px-2 rounded border border-detective-success/30 bg-detective-success/15 text-[10px] font-medium text-detective-success transition-colors hover:bg-detective-success/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-600">Zoom</span>
          <button
            type="button"
            onClick={() => handleZoomChange(zoom - 0.25)}
            disabled={zoom <= 1}
            className="h-6 w-6 rounded border border-detective-600/20 text-xs text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-40"
          >
            -
          </button>
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.25"
            value={zoom}
            onChange={(e) => handleZoomChange(e.target.value)}
            className="w-16 accent-detective-accent"
          />
          <button
            type="button"
            onClick={() => handleZoomChange(zoom + 0.25)}
            disabled={zoom >= 2.5}
            className="h-6 w-6 rounded border border-detective-600/20 text-xs text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Frame scrubber (exact frame-to-UI mapping) */}
      <div className="px-3 py-2 bg-detective-800/35 border-t border-detective-600/15 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Frame</span>
          <input
            type="range"
            min="0"
            max={Math.max(0, totalFrames - 1)}
            step="1"
            value={Math.max(0, displayIndex)}
            onChange={(e) => handleFrameScrub(Number(e.target.value))}
            disabled={totalFrames === 0}
            className="flex-1 accent-detective-accent"
          />
          <span className="text-[10px] font-mono text-gray-400 w-20 text-right">
            {totalFrames > 0 ? `${displayIndex + 1}/${totalFrames}` : "0/0"}
          </span>
          <input
            type="range"
            min="2"
            max="24"
            step="1"
            value={playbackFps}
            onChange={(e) => setPlaybackFps(Number(e.target.value))}
            disabled={totalFrames === 0}
            className="w-20 accent-detective-success"
            title="Playback FPS"
          />
          <span className="text-[10px] text-gray-500 w-10">{playbackFps} fps</span>
        </div>
      </div>
    </div>
  );
}
