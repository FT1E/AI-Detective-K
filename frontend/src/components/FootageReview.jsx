import { useState, useEffect } from 'react'

const VIEW_MODES = [
  { id: 'rgb', label: 'RGB', color: 'from-blue-500 to-cyan-500' },
  { id: 'thermal', label: 'THERMAL', color: 'from-red-500 to-yellow-500' },
  { id: 'depth', label: 'DEPTH', color: 'from-purple-500 to-indigo-500' },
]

const FEED_STYLES = {
  rgb: { bg: 'from-detective-700 to-detective-800', grid: 'border-detective-accent/10', text: 'text-detective-accent', box: 'border-detective-accent' },
  thermal: { bg: 'from-red-950/80 to-orange-950/60', grid: 'border-red-500/10', text: 'text-orange-400', box: 'border-yellow-400' },
  depth: { bg: 'from-indigo-950/80 to-purple-950/60', grid: 'border-purple-500/10', text: 'text-purple-400', box: 'border-purple-400' },
}

function SimulatedFeed({ viewMode, recording, selectedEvent }) {
  const [time, setTime] = useState(0)
  const s = FEED_STYLES[viewMode]

  useEffect(() => {
    if (!recording) return
    const interval = setInterval(() => setTime((t) => t + 1), 100)
    return () => clearInterval(interval)
  }, [recording])

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${s.bg} overflow-hidden`}>
      {/* Grid */}
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className={`border ${s.grid}`} />
        ))}
      </div>

      {recording && <div className="scanline" />}

      {/* Detection boxes when recording */}
      {recording && (
        <>
          <div className={`absolute border-2 ${s.box} rounded`}
            style={{ left: `${18 + Math.sin(time * 0.04) * 6}%`, top: '28%', width: '14%', height: '38%' }}>
            <div className={`absolute -top-5 left-0 text-[10px] font-mono ${s.text} bg-black/70 px-1.5 py-0.5 rounded`}>
              S-Alpha {viewMode === 'thermal' ? '36.4°C' : viewMode === 'depth' ? '2.3m' : '94%'}
            </div>
            {viewMode === 'thermal' && <div className="absolute inset-0 bg-gradient-to-t from-red-500/30 via-yellow-500/15 to-transparent rounded" />}
            {viewMode === 'depth' && <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 to-indigo-600/25 rounded" />}
          </div>
          <div className={`absolute border-2 ${viewMode === 'thermal' ? 'border-orange-400' : s.box} rounded`}
            style={{ left: `${52 + Math.cos(time * 0.03) * 4}%`, top: '22%', width: '11%', height: '42%' }}>
            <div className={`absolute -top-5 left-0 text-[10px] font-mono ${s.text} bg-black/70 px-1.5 py-0.5 rounded`}>
              S-Gamma {viewMode === 'thermal' ? '37.3°C' : viewMode === 'depth' ? '4.1m' : '87%'}
            </div>
          </div>
        </>
      )}

      {/* Selected event highlight (reviewing a past event) */}
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
          <p className="text-detective-500 text-xs">Ready to capture footage</p>
        </div>
      )}

      {/* Timestamp */}
      {recording && (
        <div className="absolute bottom-2 left-2 font-mono text-[10px] text-gray-400 bg-black/50 px-1.5 py-0.5 rounded">
          {new Date().toLocaleTimeString()} | {viewMode.toUpperCase()}
        </div>
      )}
    </div>
  )
}

export default function FootageReview({ recording, onToggleRecording, viewMode, onViewModeChange, connected, phase, eventCount, selectedEvent }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-detective-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Footage</h2>
          {recording && (
            <span className="text-[10px] font-mono text-gray-500">{eventCount} events captured</span>
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

      {/* Feed */}
      <div className="flex-1 relative">
        <SimulatedFeed viewMode={viewMode} recording={recording} selectedEvent={selectedEvent} />
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
        <span className="text-[10px] text-gray-600">Camera 01 | {viewMode.toUpperCase()}</span>
      </div>
    </div>
  )
}
