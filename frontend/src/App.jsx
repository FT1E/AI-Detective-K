import { useCallback, useEffect, useRef, useState } from "react";
import FootageReview from "./components/FootageReview";
import IncidentReport from "./components/IncidentReport";
import SceneCanvas3D from "./components/SceneCanvas3D";
import DetectiveChat from "./components/DetectiveChat";
import { fetchCaseData, runAnalysis, fetchCameraOutput } from "./lib/api";

/* ── Resize hook ── */
function useResize(initial, axis) {
  const [ratio, setRatio] = useState(initial);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = axis === "col" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const move = (ev) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let next;
        if (axis === "col") {
          next = (ev.clientX - rect.left) / rect.width;
        } else {
          next = (ev.clientY - rect.top) / rect.height;
        }
        setRatio(Math.max(0.2, Math.min(0.8, next)));
      };

      const up = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [axis],
  );

  return { ratio, containerRef, onPointerDown };
}

/* ── Theme icons ── */
function SunIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

function Dashboard() {
  const [events, setEvents] = useState([]);
  const [report, setReport] = useState(null);
  const [viewMode, setViewMode] = useState("rgb");
  const [caseData, setCaseData] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [cameraFrames, setCameraFrames] = useState([]);

  // Controls for split ratio — re-used to allow drag resizing of grid rows/cols
  const col = useResize(0.5, "col");
  const row = useResize(0.5, "row");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchCaseData()
      .then((data) => {
        setBackendConnected(true);
        setCaseData(data);
      })
      .catch((err) => {
        setBackendConnected(false);
        console.error("Error fetching case:", err);
      });
  }, []);

  const [syncing, setSyncing] = useState(false);

  const handleVisionSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const data = await fetchCameraOutput();
      // const allFrames = data.flat();
      setCameraFrames(data);
      setBackendConnected(true);

      yield data;
      
      // Run analysis with the fetched data
      const analysis = await runAnalysis();
      setEvents(analysis.events || []);
      setReport(analysis.report || null);
      if (analysis.case_data) setCaseData(analysis.case_data);
    } catch (err) {
      console.error("Vision sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleReportUpdate = (updatedReport) => {
    setReport(updatedReport);
  };

  const phase = report
    ? "report"
    : syncing
      ? "analyzing"
      : cameraFrames.length > 0
        ? "reviewing"
        : "idle";

  // Layout toggles for right cells: "report" | "scene"
  const [topRightView, setTopRightView] = useState("report");
  const [bottomRightView, setBottomRightView] = useState("report");

  const colPct = `${col.ratio * 100}%`;
  const rowPct = `${row.ratio * 100}%`;

  // CSS grid template using the resize ratios
  const gridTemplateColumns = `${colPct} 1fr`;
  const gridTemplateRows = `${rowPct} 1fr`;

  return (
    <div className="h-screen flex flex-col bg-detective-900">
      <header className="flex items-center justify-between px-6 py-2.5 bg-detective-800 border-b border-detective-600/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-detective-accent to-blue-600 flex items-center justify-center font-bold text-sm text-white">
            K
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-gray-200">
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
          {cameraFrames.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-detective-accent" />
              <span className="text-gray-400 text-xs">
                {cameraFrames.length} frames
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
          {syncing && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-detective-warn recording-pulse" />
              <span className="text-detective-warn font-medium text-xs">
                SYNCING
              </span>
            </div>
          )}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-lg border border-detective-600/30 bg-detective-800/60 text-gray-400 hover:text-gray-200 hover:border-detective-accent/30 transition-colors"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* Grid layout: 2 columns x 2 rows */}
      <div
        ref={col.containerRef}
        className="flex-1 relative overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns,
          gridTemplateRows,
          gap: "8px",
        }}
      >
        {/* Cell (1,1) — Footage (top-left) */}
        <div className="min-w-0 min-h-0 overflow-hidden border-r border-b border-detective-600/30 bg-detective-900 p-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Footage
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleVisionSync}
                className="px-3 py-1 text-xs rounded-lg bg-detective-accent/20 text-detective-accent border border-detective-accent/30 hover:bg-detective-accent/30 transition"
              >
                Sync
              </button>
            </div>
          </div>
          <div className="h-full">
            <FootageReview
              frames={cameraFrames}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              backendConnected={backendConnected}
              onVisionSync={handleVisionSync}
              syncing={syncing}
            />
          </div>
        </div>

        {/* Cell (1,2) — Top-right: toggle between Report and 3D Scene */}
        <div className="min-w-0 min-h-0 overflow-hidden border-b border-detective-600/30 bg-detective-900 p-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {topRightView === "report" ? "Investigation Report" : "3D Scene"}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTopRightView("report")}
                className={`px-2 py-1 text-xs rounded ${topRightView === "report" ? "bg-detective-accent text-white" : "bg-detective-800 text-gray-300"}`}
                title="Show report"
              >
                Report
              </button>
              <button
                onClick={() => setTopRightView("scene")}
                className={`px-2 py-1 text-xs rounded ${topRightView === "scene" ? "bg-detective-accent text-white" : "bg-detective-800 text-gray-300"}`}
                title="Show 3D scene"
              >
                3D
              </button>
            </div>
          </div>
          <div className="h-full">
            {topRightView === "report" ? (
              <IncidentReport
                report={report}
                phase={phase}
                analyzing={syncing}
                eventCount={events.length}
                onReportUpdate={handleReportUpdate}
              />
            ) : (
              <SceneCanvas3D />
            )}
          </div>
        </div>

        {/* Cell (2,1) — Bottom-left: AI Detective chat */}
        <div
          className="min-w-0 min-h-0 overflow-hidden border-r border-detective-600/30 bg-detective-900 p-2"
          style={{ gridRow: "1 / span 2" }}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              AI Detective
            </h2>
            <div className="text-xs text-gray-500">Phase: {phase}</div>
          </div>
          <div className="h-full">
            <DetectiveChat
              caseData={caseData}
              report={report}
              onReportUpdate={handleReportUpdate}
            />
          </div>
        </div>

        {/* Resize handles: horizontal and vertical */}
        <div
          onPointerDown={row.onPointerDown}
          className="absolute left-0 right-0 h-1 cursor-row-resize -translate-y-1/2 z-30"
          style={{ top: `calc(${rowPct})` }}
        />
        <div
          onPointerDown={col.onPointerDown}
          className="absolute top-0 bottom-0 w-1 cursor-col-resize -translate-x-1/2 z-30"
          style={{ left: `calc(${colPct})` }}
        />
      </div>
    </div>
  );
}

export default function App() {
  return <Dashboard />;
}