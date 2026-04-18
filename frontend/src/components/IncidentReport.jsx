import { useState, useEffect } from "react";

const THREAT_STYLES = {
  critical: { bg: 'bg-detective-danger/15', border: 'border-detective-danger/40', text: 'text-detective-danger', bar: 'bg-detective-danger' },
  high: { bg: 'bg-detective-warn/15', border: 'border-detective-warn/40', text: 'text-detective-warn', bar: 'bg-detective-warn' },
  elevated: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', bar: 'bg-yellow-500' },
  moderate: { bg: 'bg-detective-accent/15', border: 'border-detective-accent/40', text: 'text-detective-accent', bar: 'bg-detective-accent' },
}

function EditableField({ value, onChange, multiline = false, className = "" }) {
  if (multiline) {
    return (
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-transparent border border-transparent hover:border-detective-600/30 focus:border-detective-accent/40 rounded-lg px-2 py-1 resize-none focus:outline-none transition-colors ${className}`}
        rows={3}
      />
    );
  }
  return (
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-transparent border border-transparent hover:border-detective-600/30 focus:border-detective-accent/40 rounded px-2 py-0.5 focus:outline-none transition-colors ${className}`}
    />
  );
}

function SensorBar({ label, count, total }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] uppercase w-14 shrink-0 ${
        label === 'thermal' ? 'text-red-400' : label === 'depth' ? 'text-purple-400' : 'text-blue-400'
      }`}>{label}</span>
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
      <h3 className="text-sm font-semibold text-gray-200 mb-1">Generating Report</h3>
      <p className="text-xs text-gray-500">Analyzing {eventCount} events...</p>
    </div>
  )
}

function IdleState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <svg className="w-12 h-12 text-detective-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.75}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Investigation Report</h3>
      <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
        This report will be filled as the AI detective analyzes the case.
        You can also edit any field directly. Upload footage and start the
        investigation to begin.
      </p>
    </div>
  )
}

export default function IncidentReport({ report, phase, analyzing, eventCount, onReportUpdate }) {
  if (phase === 'analyzing' || analyzing) return <AnalyzingState eventCount={eventCount} />
  if (!report) return <IdleState />

  const threat = THREAT_STYLES[report.threat_assessment?.level] || THREAT_STYLES.moderate
  const totalSensorHits = Math.max(1,
    (report.sensor_coverage?.rgb || 0) +
    (report.sensor_coverage?.thermal || 0) +
    (report.sensor_coverage?.depth || 0)
  )

  const updateField = (path, value) => {
    if (!onReportUpdate) return;
    const updated = JSON.parse(JSON.stringify(report));
    const keys = path.split('.');
    let obj = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    onReportUpdate(updated);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Report</h2>
          <span className="text-[10px] font-mono text-gray-500">{report.case_id}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>{report.observation_window?.event_count || 0} events</span>
          <span className="text-[9px] text-detective-accent/50">click to edit</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Threat Assessment */}
        {report.threat_assessment && (
          <div className={`p-3 rounded-xl border ${threat.bg} ${threat.border}`}>
            <div className={`text-xs font-bold uppercase tracking-widest ${threat.text} mb-2`}>
              {report.threat_assessment.label}
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-detective-danger font-mono">{report.threat_assessment.high_severity_count}</div>
                <div className="text-[9px] text-gray-500 uppercase">High</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-yellow-400 font-mono">{report.threat_assessment.medium_severity_count}</div>
                <div className="text-[9px] text-gray-500 uppercase">Medium</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-detective-accent font-mono">
                  {(report.observation_window?.event_count || 0) - (report.threat_assessment.high_severity_count || 0) - (report.threat_assessment.medium_severity_count || 0)}
                </div>
                <div className="text-[9px] text-gray-500 uppercase">Low</div>
              </div>
              {report.sensor_coverage && (
                <div className="ml-auto">
                  <div className="text-[10px] text-gray-400 mb-1 font-medium">Sensors</div>
                  <div className="space-y-0.5 w-36">
                    <SensorBar label="rgb" count={report.sensor_coverage.rgb} total={totalSensorHits} />
                    <SensorBar label="thermal" count={report.sensor_coverage.thermal} total={totalSensorHits} />
                    <SensorBar label="depth" count={report.sensor_coverage.depth} total={totalSensorHits} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Narrative */}
        <div>
          <SectionHeader label="Incident Narrative" />
          <div className="bg-detective-800/40 rounded-xl p-3 border border-detective-600/15">
            <EditableField
              value={report.narrative}
              onChange={(val) => updateField('narrative', val)}
              multiline
              className="text-sm text-gray-300 leading-relaxed"
            />
          </div>
        </div>

        {/* Key Findings */}
        {report.key_findings?.length > 0 && (
          <div>
            <SectionHeader label="Key Findings" />
            <div className="space-y-2">
              {report.key_findings.map((finding, i) => (
                <div key={i} className="bg-detective-800/40 rounded-xl p-3 border border-detective-600/15">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-detective-accent/10 border border-detective-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-detective-accent">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <EditableField
                        value={finding.finding}
                        onChange={(val) => {
                          const findings = [...report.key_findings];
                          findings[i] = { ...findings[i], finding: val };
                          updateField('key_findings', findings);
                        }}
                        className="text-xs font-medium text-gray-200"
                      />
                      <EditableField
                        value={finding.significance}
                        onChange={(val) => {
                          const findings = [...report.key_findings];
                          findings[i] = { ...findings[i], significance: val };
                          updateField('key_findings', findings);
                        }}
                        multiline
                        className="text-[11px] text-gray-400 leading-relaxed mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subject Profiles */}
        {report.subject_profiles?.length > 0 && (
          <div>
            <SectionHeader label="Subjects" />
            <div className="grid grid-cols-2 gap-2">
              {report.subject_profiles.map((subject) => (
                <div key={subject.id}
                  className={`rounded-xl p-3 border ${
                    subject.involvement_level === 'high' ? 'border-detective-danger/30 bg-detective-danger/5'
                    : subject.involvement_level === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5'
                    : 'border-detective-accent/30 bg-detective-accent/5'
                  }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-detective-700 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-gray-300">{subject.id}</span>
                      </div>
                      <span className="text-[11px] font-medium text-gray-200">{subject.label}</span>
                    </div>
                    <span className={`text-[8px] px-1 py-0.5 rounded uppercase font-semibold ${
                      subject.involvement_level === 'high' ? 'bg-detective-danger/20 text-detective-danger'
                      : subject.involvement_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-detective-accent/20 text-detective-accent'
                    }`}>
                      {subject.involvement_level}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {subject.event_count} events &middot; {subject.zones_visited?.length || 0} zones
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {report.recommendation && (
          <div>
            <SectionHeader label="Recommendation" />
            <div className={`rounded-xl p-3 border ${threat.bg} ${threat.border}`}>
              <EditableField
                value={report.recommendation}
                onChange={(val) => updateField('recommendation', val)}
                multiline
                className={`text-xs leading-relaxed ${threat.text}`}
              />
            </div>
          </div>
        )}

        <div className="h-2" />
      </div>
    </div>
  )
}

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</h3>
      <div className="flex-1 h-px bg-detective-600/15" />
    </div>
  )
}
