import { useEffect, useState } from "react";

const THREAT_STYLES = {
  critical: {
    bg: "bg-detective-danger/15",
    border: "border-detective-danger/40",
    text: "text-detective-danger",
  },
  high: {
    bg: "bg-detective-warn/15",
    border: "border-detective-warn/40",
    text: "text-detective-warn",
  },
  elevated: {
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/40",
    text: "text-yellow-400",
  },
  moderate: {
    bg: "bg-detective-accent/15",
    border: "border-detective-accent/40",
    text: "text-detective-accent",
  },
};

const EVENT_STYLES = {
  first_seen: {
    label: "first seen",
    color: "text-detective-accent",
    dot: "bg-detective-accent",
  },
  left_scene: {
    label: "left scene",
    color: "text-gray-400",
    dot: "bg-gray-500",
  },
  closest_approach: {
    label: "closest",
    color: "text-detective-warn",
    dot: "bg-detective-warn",
  },
  peak_count: {
    label: "peak count",
    color: "text-detective-danger",
    dot: "bg-detective-danger",
  },
};

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

function AnalyzingState({ eventCount }) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-2 border-detective-accent/30 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-detective-accent/50 border-t-detective-accent animate-spin" />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-gray-200 mb-1">
        Generating Report
      </h3>
      <p className="text-xs text-gray-500">Analyzing {eventCount} events...</p>
    </div>
  );
}

function IdleState({ cameraSummary, events, onGenerate }) {
  const hasData = cameraSummary || (events && events.length > 0);
  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-200">No Report Generated</p>
        <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-gray-500">
          {hasData
            ? "Click below to capture a snapshot of the current footage and build an incident report."
            : "Sync footage first, then generate a report from the captured frames."}
        </p>
        <button
          onClick={onGenerate}
          disabled={!hasData}
          className="mt-4 rounded-lg border border-detective-accent/30 bg-detective-accent/15 px-4 py-2 text-xs font-medium text-detective-accent transition-colors hover:bg-detective-accent/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate Report
        </button>
      </div>
    </div>
  );
}

function formatDistance(m) {
  if (m == null) return "—";
  return m < 1 ? `${(m * 100).toFixed(0)} cm` : `${m.toFixed(2)} m`;
}

function CameraSummarySection({ summary, title = "Sensor Detections" }) {
  const { totalFrames, classes, closest, pairs } = summary;
  return (
    <div>
      <SectionHeader label={title} />
      <div className="bg-detective-800/40 rounded-xl p-3 border border-detective-600/15">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 mb-3">
          <span>
            <span className="font-mono text-gray-200">{totalFrames}</span>{" "}
            frames
          </span>
          {closest && (
            <span className="ml-auto text-detective-accent">
              Closest: <span className="font-mono">{closest.name}</span> @{" "}
              {formatDistance(closest.distance)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {classes.map((c) => (
            <div
              key={c.label}
              className="rounded-lg p-2 border border-detective-600/20 bg-detective-900/40"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-200 capitalize">
                  {c.name}
                </span>
                <span className="text-[9px] font-mono text-detective-accent bg-detective-accent/10 px-1.5 py-0.5 rounded">
                  {Math.round(c.maxConf * 100)}%
                </span>
              </div>
              <div className="text-[10px] text-gray-500 font-mono flex justify-between">
                <span>{c.frameCount}f</span>
                <span>
                  {c.minDistance != null
                    ? formatDistance(c.minDistance)
                    : "no depth"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsTimeline({ events, title = "Event Timeline" }) {
  return (
    <div>
      <SectionHeader label={title} />
      <div className="bg-detective-800/40 rounded-xl p-3 border border-detective-600/15">
        <ol className="space-y-1.5">
          {events.map((ev, i) => {
            const style = EVENT_STYLES[ev.type] || EVENT_STYLES.first_seen;
            return (
              <li key={i} className="flex items-start gap-2 text-[11px]">
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}
                />
                <span className="font-mono text-gray-600 w-10 shrink-0">
                  #{ev.frame_index + 1}
                </span>
                <span
                  className={`uppercase tracking-wide text-[9px] w-20 shrink-0 ${style.color}`}
                >
                  {style.label}
                </span>
                <span className="text-gray-300 leading-snug">{ev.summary}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default function IncidentReport({
  report,
  analyzing,
  eventCount,
  onReportUpdate,
  onGenerate,
  cameraSummary,
  events,
}) {
  const [narrativeDraft, setNarrativeDraft] = useState("");
  const [currentCaseId, setCurrentCaseId] = useState(null);

  useEffect(() => {
    if (report && report.case_id !== currentCaseId) {
      setNarrativeDraft(report.narrative || "");
      setCurrentCaseId(report.case_id);
    }
  }, [report?.case_id, currentCaseId]);

  if (analyzing) return <AnalyzingState eventCount={eventCount} />;
  if (!report)
    return (
      <IdleState
        cameraSummary={cameraSummary}
        events={events}
        onGenerate={onGenerate}
      />
    );

  // USE SNAPSHOT DATA FOR REPORT VIEW (STOPS THE LOOP)
  const displaySummary = report.capturedSummary;
  const displayEvents = report.capturedEvents;
  const threat =
    THREAT_STYLES[report.threat_assessment?.level] || THREAT_STYLES.moderate;

  const updateField = (path, value) => {
    if (!onReportUpdate) return;
    const updated = JSON.parse(JSON.stringify(report));
    const keys = path.split(".");
    let obj = updated;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    onReportUpdate(updated);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Report
          </h2>
          <span className="text-[10px] font-mono text-gray-500">
            {report.case_id}
          </span>
        </div>
        <button
          onClick={onGenerate}
          className="text-[10px] text-detective-accent hover:underline"
        >
          Regenerate
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {displaySummary && (
          <CameraSummarySection
            summary={displaySummary}
            title="Captured Sensor Data"
          />
        )}
        {displayEvents && (
          <EventsTimeline events={displayEvents} title="Incident Timeline" />
        )}

        {report.threat_assessment && (
          <div
            className={`p-3 rounded-xl border ${threat.bg} ${threat.border}`}
          >
            <div
              className={`text-xs font-bold uppercase tracking-widest ${threat.text}`}
            >
              {report.threat_assessment.label}
            </div>
          </div>
        )}

        <div>
          <SectionHeader label="Incident Narrative" />
          <div className="bg-detective-800/40 rounded-xl p-3 border border-detective-600/15">
            <EditableField
              value={narrativeDraft}
              onChange={setNarrativeDraft}
              multiline
              className="text-sm text-gray-300"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => updateField("narrative", narrativeDraft)}
                disabled={narrativeDraft === (report.narrative || "")}
                className="rounded-lg border border-detective-accent/30 bg-detective-accent/15 px-3 py-1.5 text-[11px] font-medium text-detective-accent disabled:opacity-30"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        {label}
      </h3>
      <div className="flex-1 h-px bg-detective-600/15" />
    </div>
  );
}
