const SEVERITY_DOT = {
  low: 'bg-detective-accent',
  medium: 'bg-yellow-500',
  high: 'bg-detective-danger',
}

const SEVERITY_LINE = {
  low: 'bg-detective-accent/20',
  medium: 'bg-yellow-500/20',
  high: 'bg-detective-danger/20',
}

const EVIDENCE_ICON = {
  movement: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  behavioral: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  spatial: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  interpersonal: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0',
  physical: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
}

export default function EventTimeline({ events, selectedEvent, onSelectEvent, phase }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
        <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Event Timeline</h2>
        <span className="text-[10px] text-gray-500 font-mono">{events.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <svg className="w-8 h-8 text-detective-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-detective-500 text-xs">
              {phase === 'analyzing'
                ? 'Building timeline from uploaded footage...'
                : phase === 'reviewing'
                  ? 'Stop playback and analyze to build the timeline'
                  : 'Upload footage to build timeline'}
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-0">
            {events.map((event, i) => {
              const isSelected = selectedEvent === event
              const iconPath = EVIDENCE_ICON[event.evidence_type] || EVIDENCE_ICON.movement
              return (
                <button
                  key={i}
                  onClick={() => onSelectEvent(isSelected ? null : event)}
                  className={`w-full text-left flex gap-2.5 p-2 rounded-lg transition-all relative ${
                    isSelected
                      ? 'bg-detective-700/60 border border-detective-accent/20'
                      : 'hover:bg-detective-800/60 border border-transparent'
                  }`}
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center shrink-0 pt-0.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${SEVERITY_DOT[event.severity]} shrink-0 ${
                      event.severity === 'high' ? 'ring-2 ring-detective-danger/30' : ''
                    }`} />
                    {i < events.length - 1 && (
                      <div className={`w-px flex-1 mt-1 ${SEVERITY_LINE[event.severity]}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
                      </svg>
                      <span className="text-[10px] text-gray-300 font-medium truncate">
                        {event.type?.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[9px] px-1 py-px rounded uppercase font-medium ml-auto shrink-0 ${
                        event.severity === 'high' ? 'bg-detective-danger/20 text-detective-danger'
                        : event.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-detective-accent/20 text-detective-accent'
                      }`}>
                        {event.severity}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed truncate">{event.summary}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-gray-600 font-mono">
                        {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                      </span>
                      <span className="text-[9px] text-gray-600">{event.subject?.label}</span>
                      <div className="flex gap-0.5 ml-auto">
                        {event.sensors?.map((s) => (
                          <span key={s} className={`text-[8px] uppercase px-1 rounded ${
                            s === 'thermal' ? 'bg-red-500/10 text-red-400'
                            : s === 'depth' ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-blue-500/10 text-blue-400'
                          }`}>{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
