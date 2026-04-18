import { useState, useEffect } from 'react'

// OAK Streams component is optional
let Streams = null
try {
  const oak = await import('@luxonis/depthai-viewer-common')
  Streams = oak.Streams
} catch {}

const VIEW_MODES = [
  { id: 'rgb', label: 'RGB', color: 'from-blue-500 to-cyan-500' },
  { id: 'thermal', label: 'THERMAL', color: 'from-red-500 to-yellow-500' },
  { id: 'depth', label: 'DEPTH', color: 'from-purple-500 to-indigo-500' },
]

// Map our view modes to OAK topic names
const VIEW_MODE_TOPICS = {
  rgb: ['Video'],
  thermal: ['Thermal'],
  depth: ['Depth'],
}

function OakCameraFeed({ viewMode, oakConnection, recording, selectedEvent }) {
  const [streamReady, setStreamReady] = useState(false)

  // Latch stream availability
  useEffect(() => {
    if (streamReady) return
    if (
      Array.isArray(oakConnection?.topics) &&
      oakConnection.topics.some((t) => t.name === 'Video')
    ) {
      setStreamReady(true)
    }
  }, [oakConnection?.topics, streamReady])

  // OAK device connected and stream available — show real feed
  if (Streams && oakConnection?.connected && streamReady) {
    return (
      <div className="relative w-full h-full bg-black overflow-hidden">
        <Streams
          defaultTopics={VIEW_MODE_TOPICS[viewMode] || ['Video']}
          hideToolbar
        />
        {/* Recording overlay */}
        {recording && <div className="scanline" />}
        {/* Timestamp overlay */}
        {recording && (
          <div className="absolute bottom-2 left-2 font-mono text-[10px] text-gray-400 bg-black/50 px-1.5 py-0.5 rounded">
            {new Date().toLocaleTimeString()} | {viewMode.toUpperCase()} | OAK-4-PRO
          </div>
        )}
      </div>
    )
  }

  // OAK connected but stream not yet available
  if (Streams && oakConnection?.connected && !streamReady) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-detective-700 to-detective-800 flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-detective-accent/50 border-t-detective-accent animate-spin mb-3" />
        <p className="text-detective-accent text-xs">Loading camera streams...</p>
        <p className="text-detective-600 text-[10px] mt-1">Initializing OAK-4-PRO pipeline</p>
      </div>
    )
  }

  // Fallback — OAK not connected, show placeholder with selected event
  return <FallbackFeed viewMode={viewMode} recording={recording} selectedEvent={selectedEvent} />
}

function FallbackFeed({ viewMode, recording, selectedEvent }) {
  const FEED_STYLES = {
    rgb: { bg: 'from-detective-700 to-detective-800', grid: 'border-detective-accent/10', text: 'text-detective-accent' },
    thermal: { bg: 'from-red-950/80 to-orange-950/60', grid: 'border-red-500/10', text: 'text-orange-400' },
    depth: { bg: 'from-indigo-950/80 to-purple-950/60', grid: 'border-purple-500/10', text: 'text-purple-400' },
  }
  const s = FEED_STYLES[viewMode]

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${s.bg} overflow-hidden`}>
      {/* Grid */}
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className={`border ${s.grid}`} />
        ))}
      </div>

      {recording && <div className="scanline" />}

      {/* Selected event highlight */}
      {!recording && selectedEvent && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/60 rounded-lg p-3 max-w-[80%] text-center">
            <div className={`text-[10px] font-mono ${s.text} uppercase tracking-wider mb-1`}>
              Reviewing Event
            </div>
            <div className="text-xs text-gray-300">{selectedEvent.summary}</div>
            <div className="flex gap-2 justify-center mt-2">
              {selectedEvent.sensors?.map((sensor) => (
                <span key={sensor} className="text-[9px] uppercase bg-detective-700/80 text-gray-400 px-1.5 py-0.5 rounded">
                  {sensor}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Idle state */}
      {!recording && !selectedEvent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <svg className="w-10 h-10 text-detective-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-detective-500 text-xs">OAK camera not connected</p>
          <p className="text-detective-600 text-[10px] mt-1">Connect OAK-4-PRO to see live feed</p>
        </div>
      )}

      {recording && (
        <div className="absolute bottom-2 left-2 font-mono text-[10px] text-gray-400 bg-black/50 px-1.5 py-0.5 rounded">
          {new Date().toLocaleTimeString()} | {viewMode.toUpperCase()} | SIMULATED
        </div>
      )}
    </div>
  )
}

export default function FootageReview({ recording, onToggleRecording, viewMode, onViewModeChange, connected, oakConnection, phase, eventCount, selectedEvent }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-detective-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Footage</h2>
          {recording && (
            <span className="text-[10px] font-mono text-gray-500">{eventCount} events captured</span>
          )}
          {oakConnection.connected && (
            <span className="text-[9px] bg-detective-success/15 text-detective-success px-1.5 py-0.5 rounded border border-detective-success/20">
              OAK LIVE
            </span>
          )}
        </div>
        <div className="flex gap-0.5 bg-detective-900/50 rounded p-0.5">
          {VIEW_MODES.map((mode) => (
            <button key={mode.id} onClick={() => onViewModeChange(mode.id)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                viewMode === mode.id ? `bg-gradient-to-r ${mode.color} text-white` : 'text-gray-500 hover:text-gray-300'
              }`}>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed — real OAK or fallback */}
      <div className="flex-1 relative">
        <OakCameraFeed
          viewMode={viewMode}
          oakConnection={oakConnection}
          recording={recording}
          selectedEvent={selectedEvent}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-detective-800/50 border-t border-detective-600/20 shrink-0">
        <button onClick={onToggleRecording} disabled={!connected}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
            recording
              ? 'bg-detective-danger/20 text-detective-danger border border-detective-danger/30 hover:bg-detective-danger/30'
              : 'bg-detective-accent/20 text-detective-accent border border-detective-accent/30 hover:bg-detective-accent/30'
          } disabled:opacity-40 disabled:cursor-not-allowed`}>
          {recording ? (
            <>
              <div className="w-2.5 h-2.5 rounded-sm bg-detective-danger" />
              Stop & Analyze
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-detective-accent" />
              {phase === 'report' ? 'New Session' : 'Start Recording'}
            </>
          )}
        </button>
        <span className="text-[10px] text-gray-600">
          {oakConnection.connected ? 'OAK-4-PRO' : 'Camera 01'} | {viewMode.toUpperCase()}
        </span>
      </div>
    </div>
  )
}
