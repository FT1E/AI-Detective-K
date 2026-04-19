import { useCallback, useEffect, useRef, useState } from "react";
import FootageReview from "./components/FootageReview";
import FrameAnnotator from "./components/FrameAnnotator";
import FollowUpQuestions from "./components/FollowUpQuestions";
// import DetectiveChat from "./components/DetectiveChat";
import { fetchCaseData, runAnalysis, fetchCameraOutput, runAgentAnalysis, fetchFollowUpQuestions } from "./lib/api";

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
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
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
  const [syncing, setSyncing] = useState(false);

  // Left panel state
  const [capturedFrame, setCapturedFrame] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [followUpState, setFollowUpState] = useState({
    questions: null,
    history: [],
    loading: false,
    stage: "idle",
  });

  const col = useResize(0.5, "col");
  const row = useResize(0.5, "row");

  // Both resize hooks share the same grid container ref
  const gridRef = useCallback((el) => {
    col.containerRef.current = el;
    row.containerRef.current = el;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

useEffect(() => {
    fetch("/api/camera-output")
      .then((res) => {
        if (res.ok) setBackendConnected(true);
      })
      .catch(() => setBackendConnected(false));
  }, []);

  const handleVisionSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const data = await fetchCameraOutput();
      setCameraFrames(data);
      setBackendConnected(true);
    } catch (err) {
      console.error("Vision sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleReportUpdate = (updatedReport) => {
    setReport(updatedReport);
  };

  const handleCaptureFrame = (frame) => {
    setCapturedFrame(frame);
    setAnnotations([]);
    setFollowUpState({ questions: null, history: [], loading: false, stage: "idle" });
  };

  const handleAnalyze = async () => {
    if (!capturedFrame || annotations.length === 0) return;
    setFollowUpState((prev) => ({ ...prev, loading: true, stage: "analyzing" }));
    try {
      const res = await runAgentAnalysis(annotations);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const raw = line.slice(6);
            let data;
            try { data = JSON.parse(raw); } catch { data = raw; }

            if (currentEvent === "report") {
              const reportObj = typeof data === "string" ? JSON.parse(data) : data;
              if (reportObj) setReport(reportObj);
              setFollowUpState((prev) => ({ ...prev, loading: false, stage: "idle" }));
            } else if (currentEvent === "error") {
              setFollowUpState((prev) => ({ ...prev, loading: false, stage: "idle" }));
            }
            currentEvent = null;
          }
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setFollowUpState((prev) => ({ ...prev, loading: false, stage: "idle" }));
    }
  };

  const handleSelectOption = async (questionText, option) => {
    const currentQ = followUpState.questions;
    const updatedHistory = [...followUpState.history, { question: currentQ, answer: option }];
    setFollowUpState((prev) => ({
      ...prev,
      history: updatedHistory,
      questions: null,
      loading: true,
    }));
    try {
      const nextQ = await fetchFollowUpQuestions(annotations, report?.narrative || "", updatedHistory);
      if (nextQ.investigation_complete) {
        setFollowUpState((prev) => ({ ...prev, loading: false, stage: "complete" }));
      } else {
        setFollowUpState((prev) => ({ ...prev, questions: nextQ, loading: false, stage: "questioning" }));
      }
    } catch (err) {
      console.error("Follow-up fetch failed:", err);
      setFollowUpState((prev) => ({ ...prev, loading: false, stage: "idle" }));
    }
  };

  const handleCustomAnswer = async (questionText, text) => {
    handleSelectOption(questionText, { id: "D", text });
  };

  const phase = report
    ? "report"
    : syncing
      ? "analyzing"
      : cameraFrames.length > 0
        ? "reviewing"
        : "idle";

  const colPct = `${col.ratio * 100}%`;
  const rowPct = `${row.ratio * 100}%`;

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
              <span className="text-gray-400 text-xs">{cameraFrames.length} frames</span>
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
              <span className="text-detective-warn font-medium text-xs">SYNCING</span>
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

      {/* 2-col × 2-row grid: left spans full height, right is split top/bottom */}
      <div
        ref={gridRef}
        className="flex-1 relative overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: `${colPct} 1fr`,
          gridTemplateRows: `${rowPct} 1fr`,
        }}
      >
        {/* TOP LEFT — FootageReview */}
        <div
          style={{ gridColumn: 1, gridRow: 1 }}
          className="min-w-0 min-h-0 overflow-hidden border-r border-b border-detective-600/30"
        >
          <FootageReview
            frames={cameraFrames}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            backendConnected={backendConnected}
            onVisionSync={handleVisionSync}
            syncing={syncing}
            onCaptureFrame={handleCaptureFrame}
          />
        </div>

        {/* TOP RIGHT — FrameAnnotator */}
        <div
          style={{ gridColumn: 2, gridRow: 1 }}
          className="min-w-0 min-h-0 overflow-hidden border-b border-detective-600/30"
        >
          <FrameAnnotator
            frame={capturedFrame}
            annotations={annotations}
            onAnnotationsChange={setAnnotations}
            onAnalyze={handleAnalyze}
            disabled={followUpState.loading}
          />
        </div>

        {/* BOTTOM LEFT — Analysis results placeholder */}
        <div
          style={{ gridColumn: 1, gridRow: 2 }}
          className="min-w-0 min-h-0 overflow-hidden border-r border-detective-600/30 flex items-center justify-center"
        >
          <p className="text-gray-500 text-sm italic">Analysis results will appear here</p>
        </div>

        {/* BOTTOM RIGHT — FollowUpQuestions */}
        <div
          style={{ gridColumn: 2, gridRow: 2 }}
          className="min-w-0 min-h-0 overflow-hidden"
        >
          <FollowUpQuestions
            followUpState={followUpState}
            onSelectOption={handleSelectOption}
            onCustomAnswer={handleCustomAnswer}
            onReset={() =>
              setFollowUpState({ questions: null, history: [], loading: false, stage: "idle" })
            }
          />
        </div>

        {/* Row resize handle — spans full width */}
        <div
          onPointerDown={row.onPointerDown}
          className="absolute h-1 cursor-row-resize z-30 bg-detective-600/20 hover:bg-detective-accent/30 transition-colors"
          style={{ left: 0, right: 0, top: rowPct, transform: "translateY(-50%)" }}
        />

        {/* Column resize handle */}
        <div
          onPointerDown={col.onPointerDown}
          className="absolute top-0 bottom-0 w-1 cursor-col-resize z-20 bg-detective-600/20 hover:bg-detective-accent/30 transition-colors"
          style={{ left: colPct, transform: "translateX(-50%)" }}
        />
      </div>
    </div>
  );
}

export default function App() {
  return <Dashboard />;
}
