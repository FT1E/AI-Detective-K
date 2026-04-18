import { useEffect, useRef, useState } from "react";
import FootageReview from "./components/FootageReview";
import IncidentReport from "./components/IncidentReport";
import EventTimeline from "./components/EventTimeline";
import DetectiveChat from "./components/DetectiveChat";
import { getApiUrl } from "./lib/backend";

const EMPTY_VIDEO_SOURCES = {
  rgb: null,
  thermal: null,
  depth: null,
};

function revokeVideoSource(entry) {
  if (entry?.url) {
    URL.revokeObjectURL(entry.url);
  }
}

function Dashboard() {
  const [events, setEvents] = useState([]);
  const [report, setReport] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState("rgb");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [videoSources, setVideoSources] = useState(EMPTY_VIDEO_SOURCES);
  const [backendConnected, setBackendConnected] = useState(false);
  const latestVideoSourcesRef = useRef(videoSources);

  useEffect(() => {
    latestVideoSourcesRef.current = videoSources;
  }, [videoSources]);

  useEffect(() => {
    return () => {
      Object.values(latestVideoSourcesRef.current).forEach(revokeVideoSource);
    };
  }, []);

  useEffect(() => {
    fetch(getApiUrl("/case/dummy"))
      .then(async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(
            `Failed to load /api/case/dummy: ${res.status} ${res.statusText}\n${text.slice(0, 200)}`,
          );
          setBackendConnected(false);
          return null;
        }
        if (!ct.includes("application/json")) {
          const text = await res.text().catch(() => "");
          console.error(
            `Expected JSON from /api/case/dummy but got ${ct}. Response snippet:\n${text.slice(0, 200)}`,
          );
          setBackendConnected(false);
          return null;
        }
        setBackendConnected(true);
        return res.json();
      })
      .then((data) => {
        if (data) setCaseData(data);
      })
      .catch((err) => {
        setBackendConnected(false);
        console.error("Error fetching dummy case:", err);
      });
  }, []);

  const resetAnalysisState = () => {
    setEvents([]);
    setReport(null);
    setSelectedEvent(null);
    setAnalyzing(false);
  };

  const handleUploadVideo = (mode, file) => {
    if (!file) return;

    resetAnalysisState();
    setViewMode(mode);

    setVideoSources((prev) => {
      const next = { ...prev };
      revokeVideoSource(next[mode]);
      next[mode] = {
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      };
      return next;
    });
  };

  const handleClearSession = () => {
    Object.values(videoSources).forEach(revokeVideoSource);
    setVideoSources(EMPTY_VIDEO_SOURCES);
    setViewMode("rgb");
    resetAnalysisState();
  };

  const handleAnalyze = async () => {
    const hasUploads = Object.values(videoSources).some(Boolean);
    if (!hasUploads || analyzing) return;

    setAnalyzing(true);
    setSelectedEvent(null);

    try {
      const res = await fetch(getApiUrl("/analysis/demo"));
      const ct = res.headers.get("content-type") || "";

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to analyze footage: ${res.status} ${res.statusText} ${text.slice(0, 200)}`,
        );
      }

      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Expected JSON from /api/analysis/demo but got ${ct}. ${text.slice(0, 200)}`,
        );
      }

      const data = await res.json();
      setBackendConnected(true);
      setEvents(data.events || []);
      setReport(data.report || null);
      if (data.case_data) {
        setCaseData(data.case_data);
      }
    } catch (err) {
      setBackendConnected(false);
      console.error("Analyze footage error:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const hasUploads = Object.values(videoSources).some(Boolean);
  const uploadedViewCount = Object.values(videoSources).filter(Boolean).length;
  const phase = report
    ? "report"
    : analyzing
      ? "analyzing"
      : hasUploads
        ? "reviewing"
        : "idle";

  return (
    <div className="h-screen flex flex-col bg-detective-900">
      <header className="flex items-center justify-between px-6 py-2.5 bg-detective-800 border-b border-detective-600/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-detective-accent to-blue-600 flex items-center justify-center font-bold text-sm">
            K
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            AI Detective <span className="text-detective-accent">K</span>
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-gray-600 ml-2">
            Post-Crime Analysis System
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {report && (
            <span className="text-xs font-mono text-detective-accent bg-detective-accent/10 px-2 py-0.5 rounded border border-detective-accent/20">
              Case {report.case_id}
            </span>
          )}
          {hasUploads && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-detective-accent" />
              <span className="text-gray-400 text-xs">
                {uploadedViewCount} view{uploadedViewCount === 1 ? "" : "s"} loaded
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${backendConnected ? "bg-detective-success" : "bg-detective-danger"}`}
            />
            <span className="text-gray-400 text-xs">
              {backendConnected ? "Backend Online" : "Backend Offline"}
            </span>
          </div>
          {analyzing && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-detective-warn recording-pulse" />
              <span className="text-detective-warn font-medium text-xs">
                ANALYZING
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[28%] flex flex-col border-r border-detective-600/30 shrink-0">
          <div className="h-[45%] flex flex-col border-b border-detective-600/20">
            <FootageReview
              videoSources={videoSources}
              onUploadVideo={handleUploadVideo}
              onClearSession={handleClearSession}
              onAnalyze={handleAnalyze}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              phase={phase}
              eventCount={events.length}
              selectedEvent={selectedEvent}
              analyzing={analyzing}
              backendConnected={backendConnected}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <EventTimeline
              events={events}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
              phase={phase}
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden border-r border-detective-600/30">
          <IncidentReport
            report={report}
            phase={phase}
            analyzing={analyzing}
            eventCount={events.length}
          />
        </div>

        <div className="w-[28%] overflow-hidden shrink-0">
          <DetectiveChat caseData={caseData} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <Dashboard />;
}
