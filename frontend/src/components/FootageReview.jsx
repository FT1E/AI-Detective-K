import { useEffect, useRef, useState } from "react";

const VIEW_MODES = [
  { id: "rgb", label: "NORMAL", accent: "from-blue-500 to-cyan-500" },
  { id: "thermal", label: "THERMAL", accent: "from-red-500 to-orange-500" },
  { id: "depth", label: "DEPTH", accent: "from-violet-500 to-indigo-500" },
];

const MODE_TINT = {
  rgb: "from-blue-950/30 via-transparent to-cyan-950/20",
  thermal: "from-red-950/50 via-transparent to-orange-950/30",
  depth: "from-violet-950/50 via-transparent to-indigo-950/30",
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FootageReview({
  videoSources,
  onUploadVideo,
  onClearSession,
  onAnalyze,
  viewMode,
  onViewModeChange,
  phase,
  eventCount,
  selectedEvent,
  analyzing,
  backendConnected,
}) {
  const [zoom, setZoom] = useState(1);
  const inputRefs = useRef({});
  const videoRefs = useRef({});
  const activeSource = videoSources[viewMode];
  const hasUploads = Object.values(videoSources).some(Boolean);

  useEffect(() => {
    setZoom(1);
  }, [viewMode]);

  const openFilePicker = (mode) => {
    inputRefs.current[mode]?.click();
  };

  const pauseAllVideos = () => {
    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.pause();
    });
  };

  const handleAnalyzeClick = () => {
    pauseAllVideos();
    onAnalyze();
  };

  const handleZoomChange = (nextZoom) => {
    setZoom(Math.max(1, Math.min(2.5, Number(nextZoom))));
  };

  const skipVideo = (seconds) => {
    const video = videoRefs.current[viewMode];
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with view mode toggles */}
      <div className="flex items-center justify-between px-3 py-2 bg-detective-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Footage
          </h2>
          {hasUploads && (
            <span className="text-[10px] font-mono text-gray-500">
              {Object.values(videoSources).filter(Boolean).length} views
            </span>
          )}
          {phase === "report" && (
            <span className="text-[9px] bg-detective-success/15 text-detective-success px-1.5 py-0.5 rounded border border-detective-success/20">
              Analyzed
            </span>
          )}
        </div>
        <div className="flex gap-0.5 bg-detective-900/50 rounded p-0.5">
          {VIEW_MODES.map((mode) => {
            const source = videoSources[mode.id];
            return (
              <button
                key={mode.id}
                onClick={() => onViewModeChange(mode.id)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                  viewMode === mode.id
                    ? `bg-gradient-to-r ${mode.accent} text-white`
                    : source
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-gray-600 hover:text-gray-400"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden file inputs */}
      {VIEW_MODES.map((mode) => (
        <input
          key={mode.id}
          ref={(node) => {
            inputRefs.current[mode.id] = node;
          }}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onUploadVideo(mode.id, file);
            }
            e.target.value = "";
          }}
        />
      ))}

      {/* Video player area */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {activeSource ? (
          <>
            {VIEW_MODES.map((mode) => {
              const source = videoSources[mode.id];
              if (!source) return null;

              return (
                <video
                  key={mode.id}
                  ref={(node) => {
                    videoRefs.current[mode.id] = node;
                  }}
                  src={source.url}
                  controls
                  playsInline
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity ${
                    mode.id === viewMode ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                />
              );
            })}

            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${MODE_TINT[viewMode]}`}
            />

            <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-gray-300">
              {VIEW_MODES.find((mode) => mode.id === viewMode)?.label} VIEW
            </div>

            <div className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-gray-300">
              {Math.round(zoom * 100)}%
            </div>

            {activeSource && (
              <div className="absolute left-2 bottom-2 rounded bg-black/60 px-2 py-1 text-[9px] text-gray-400 max-w-[200px] truncate">
                {activeSource.name} &middot; {formatBytes(activeSource.size)}
              </div>
            )}

            {selectedEvent && phase === "report" && (
              <div className="absolute inset-x-4 bottom-4 rounded-xl border border-detective-accent/20 bg-black/65 p-3">
                <div className="text-[10px] uppercase tracking-widest text-detective-accent mb-1">
                  Selected Event
                </div>
                <div className="text-xs text-gray-200">{selectedEvent.summary}</div>
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
              Vision Sync Trigger
            </p>
            <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-gray-500">
              Sync video recordings to the backend for analysis. You can add normal, thermal, and depth views.
            </p>
            <button
              type="button"
              onClick={() => openFilePicker(viewMode)}
              className="mt-4 rounded-lg border border-detective-accent/30 bg-detective-accent/15 px-3 py-1.5 text-xs font-medium text-detective-accent transition-colors hover:bg-detective-accent/25"
            >
              Vision Sync Trigger
            </button>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-detective-800/50 border-t border-detective-600/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openFilePicker(viewMode)}
            className="flex items-center gap-1 rounded-lg border border-detective-accent/30 bg-detective-accent/15 px-2.5 py-1 text-[11px] font-medium text-detective-accent transition-all hover:bg-detective-accent/25"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Vision Sync
          </button>
          <button
            type="button"
            onClick={handleAnalyzeClick}
            disabled={!hasUploads || analyzing || !backendConnected}
            className="flex items-center gap-1 rounded-lg border border-detective-danger/30 bg-detective-danger/20 px-2.5 py-1 text-[11px] font-medium text-detective-danger transition-all hover:bg-detective-danger/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-2 h-2 rounded-sm bg-detective-danger" />
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
          <button
            type="button"
            onClick={() => {
              pauseAllVideos();
              onClearSession();
            }}
            disabled={!hasUploads}
            className="rounded-lg border border-detective-600/20 bg-detective-900/40 px-2 py-1 text-[10px] text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>

        {/* Playback controls */}
        {activeSource && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => skipVideo(-10)}
              className="h-6 w-6 rounded border border-detective-600/20 text-[10px] text-gray-400 transition-colors hover:text-gray-200 flex items-center justify-center"
              title="Rewind 10s"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => skipVideo(10)}
              className="h-6 w-6 rounded border border-detective-600/20 text-[10px] text-gray-400 transition-colors hover:text-gray-200 flex items-center justify-center"
              title="Forward 10s"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
            </button>
          </div>
        )}

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
    </div>
  );
}
