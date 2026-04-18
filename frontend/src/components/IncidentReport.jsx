const THREAT_STYLES = {
  critical: { bg: 'bg-detective-danger/15', border: 'border-detective-danger/40', text: 'text-detective-danger', bar: 'bg-detective-danger' },
  high: { bg: 'bg-detective-warn/15', border: 'border-detective-warn/40', text: 'text-detective-warn', bar: 'bg-detective-warn' },
  elevated: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', bar: 'bg-yellow-500' },
  moderate: { bg: 'bg-detective-accent/15', border: 'border-detective-accent/40', text: 'text-detective-accent', bar: 'bg-detective-accent' },
}

const INVOLVEMENT_STYLE = {
  high: 'border-detective-danger/30 bg-detective-danger/5',
  medium: 'border-yellow-500/30 bg-yellow-500/5',
  low: 'border-detective-accent/30 bg-detective-accent/5',
}

function SensorBar({ label, count, total, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] uppercase w-16 shrink-0 ${color}`}>{label}</span>
      <div className="flex-1 h-1.5 bg-detective-900 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${
          label === 'thermal' ? 'bg-red-500' : label === 'depth' ? 'bg-purple-500' : 'bg-blue-500'
        }`} style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
      </div>
      <span className="text-[10px] text-gray-500 font-mono w-6 text-right">{count}</span>
    </div>
  )
}

function AnalyzingState({ eventCount }) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-2 border-detective-accent/30 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-detective-accent/50 border-t-detective-accent animate-spin" />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-gray-200 mb-1">Generating Investigation Report</h3>
      <p className="text-xs text-gray-500">Analyzing {eventCount} captured events across multi-modal sensors...</p>
      <div className="flex gap-3 mt-4">
        {['RGB Analysis', 'Thermal Correlation', 'Depth Mapping', 'Behavioral Modeling'].map((step, i) => (
          <span key={i} className="text-[9px] text-detective-accent/60 bg-detective-accent/5 px-2 py-0.5 rounded">
            {step}
          </span>
        ))}
      </div>
    </div>
  )
}

function IdleState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <svg className="w-16 h-16 text-detective-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.75}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Investigation Report</h3>
      <p className="text-xs text-gray-500 max-w-md leading-relaxed">
        Record footage to capture events, then stop recording to generate a comprehensive
        post-incident analysis. The AI detective will reconstruct the timeline, identify key
        subjects, and explain what happened using multi-modal sensor evidence.
      </p>
      <div className="flex gap-4 mt-6">
        {[
          { label: 'Timeline Reconstruction', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Evidence Chain', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101' },
          { label: 'Subject Profiles', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-lg bg-detective-800/60 border border-detective-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-detective-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
            </div>
            <span className="text-[9px] text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function IncidentReport({ report, phase, analyzing, eventCount }) {
  if (phase === 'analyzing' || analyzing) return <AnalyzingState eventCount={eventCount} />
  if (!report) return <IdleState />

  const threat = THREAT_STYLES[report.threat_assessment.level] || THREAT_STYLES.moderate
  const totalSensorHits = Math.max(1, report.sensor_coverage.rgb + report.sensor_coverage.thermal + report.sensor_coverage.depth)

  return (
    <div className="flex flex-col h-full">
      {/* Report Header */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Investigation Report</h2>
          <span className="text-[10px] font-mono text-gray-500">{report.case_id}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>{report.observation_window.event_count} events</span>
          <span>Generated {new Date(report.generated_at).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Report Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Threat Assessment Banner */}
        <div className={`p-4 rounded-xl border ${threat.bg} ${threat.border}`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`text-xs font-bold uppercase tracking-widest ${threat.text}`}>
              {report.threat_assessment.label}
            </div>
          </div>
          <div className="flex gap-4 mt-2">
            <div className="text-center">
              <div className="text-xl font-bold text-detective-danger font-mono">{report.threat_assessment.high_severity_count}</div>
              <div className="text-[9px] text-gray-500 uppercase">High</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-400 font-mono">{report.threat_assessment.medium_severity_count}</div>
              <div className="text-[9px] text-gray-500 uppercase">Medium</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-detective-accent font-mono">
                {report.observation_window.event_count - report.threat_assessment.high_severity_count - report.threat_assessment.medium_severity_count}
              </div>
              <div className="text-[9px] text-gray-500 uppercase">Low</div>
            </div>
            <div className="ml-auto">
              <div className="text-[10px] text-gray-400 mb-1.5 font-medium">Sensor Contributions</div>
              <div className="space-y-1 w-48">
                <SensorBar label="rgb" count={report.sensor_coverage.rgb} total={totalSensorHits} color="text-blue-400" />
                <SensorBar label="thermal" count={report.sensor_coverage.thermal} total={totalSensorHits} color="text-red-400" />
                <SensorBar label="depth" count={report.sensor_coverage.depth} total={totalSensorHits} color="text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div>
          <SectionHeader label="Incident Narrative" />
          <div className="bg-detective-800/40 rounded-xl p-4 border border-detective-600/15">
            <p className="text-sm text-gray-300 leading-relaxed">{report.narrative}</p>
          </div>
        </div>

        {/* Key Findings */}
        <div>
          <SectionHeader label="Key Findings" />
          <div className="space-y-3">
            {report.key_findings.map((finding, i) => (
              <div key={i} className="bg-detective-800/40 rounded-xl p-4 border border-detective-600/15">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-detective-accent/10 border border-detective-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-detective-accent">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-200 mb-1">{finding.finding}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed mb-2">{finding.significance}</p>
                    <div className="flex items-start gap-1.5 bg-detective-900/40 rounded-lg p-2.5 border border-detective-600/10">
                      <svg className="w-3.5 h-3.5 text-detective-warn shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-detective-warn/90 leading-relaxed">{finding.implication}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subject Profiles */}
        <div>
          <SectionHeader label="Subject Profiles" />
          <div className="grid grid-cols-2 gap-3">
            {report.subject_profiles.map((subject) => (
              <div key={subject.id}
                className={`rounded-xl p-3.5 border ${INVOLVEMENT_STYLE[subject.involvement_level] || INVOLVEMENT_STYLE.low}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-detective-700 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-300">{subject.id}</span>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-200">{subject.label}</div>
                      <div className="text-[10px] text-gray-500">{subject.description}</div>
                    </div>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                    subject.involvement_level === 'high' ? 'bg-detective-danger/20 text-detective-danger'
                    : subject.involvement_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-detective-accent/20 text-detective-accent'
                  }`}>
                    {subject.involvement_level}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-gray-600">Events: </span>
                    <span className="text-gray-400 font-mono">{subject.event_count}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Zones: </span>
                    <span className="text-gray-400 font-mono">{subject.zones_visited.length}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">First seen: </span>
                    <span className="text-gray-400 font-mono">
                      {new Date(subject.first_seen).toLocaleTimeString()}
                    </span>
                    <span className="text-gray-600 ml-2">Last: </span>
                    <span className="text-gray-400 font-mono">
                      {new Date(subject.last_seen).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence Chain */}
        <div>
          <SectionHeader label="Evidence Chain" />
          <div className="bg-detective-800/40 rounded-xl border border-detective-600/15 divide-y divide-detective-600/10">
            {report.evidence_chain.map((ev) => (
              <div key={ev.sequence} className="p-3.5 flex gap-3">
                <div className="shrink-0 flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    ev.severity === 'high' ? 'bg-detective-danger/20 text-detective-danger'
                    : ev.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-detective-accent/20 text-detective-accent'
                  }`}>
                    {ev.sequence}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-200">{ev.type}</span>
                    <span className="text-[9px] text-gray-500 font-mono">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    <span className="text-[9px] text-gray-600">{ev.zone}</span>
                    <div className="flex gap-0.5 ml-auto">
                      {ev.sensors_used.map((s) => (
                        <span key={s} className={`text-[8px] uppercase px-1 rounded ${
                          s === 'thermal' ? 'bg-red-500/10 text-red-400'
                          : s === 'depth' ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-blue-500/10 text-blue-400'
                        }`}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{ev.detail}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] text-gray-500">{ev.subject}</span>
                    <span className="text-[9px] text-gray-600">|</span>
                    <span className="text-[9px] text-gray-500 capitalize">{ev.evidence_type} evidence</span>
                    <span className="text-[9px] text-gray-600">|</span>
                    <span className="text-[9px] text-gray-500 font-mono">{(ev.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div>
          <SectionHeader label="Recommendation" />
          <div className={`rounded-xl p-4 border ${threat.bg} ${threat.border}`}>
            <p className={`text-sm leading-relaxed ${threat.text}`}>{report.recommendation}</p>
          </div>
        </div>

        {/* Spacer */}
        <div className="h-4" />
      </div>
    </div>
  )
}

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</h3>
      <div className="flex-1 h-px bg-detective-600/15" />
    </div>
  )
}
