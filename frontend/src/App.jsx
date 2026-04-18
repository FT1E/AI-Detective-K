import { useState, useEffect, useRef, useCallback } from 'react'
import { DepthAIContext, useDaiConnection } from '@luxonis/depthai-viewer-common'
import '@luxonis/depthai-viewer-common/styles'
import FootageReview from './components/FootageReview'
import IncidentReport from './components/IncidentReport'
import EventTimeline from './components/EventTimeline'

function Dashboard() {
  const oakConnection = useDaiConnection()

  const [recording, setRecording] = useState(false)
  const [events, setEvents] = useState([])
  const [report, setReport] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [viewMode, setViewMode] = useState('rgb')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const wsRef = useRef(null)
  const [backendConnected, setBackendConnected] = useState(false)

  const connectWs = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/events`)

    ws.onopen = () => {
      setBackendConnected(true)
      wsRef.current = ws
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'status') {
        setRecording(msg.recording)
        if (!msg.recording && events.length > 0) {
          setAnalyzing(true)
        }
      } else if (msg.type === 'event') {
        setEvents((prev) => [...prev, msg.data])
      } else if (msg.type === 'report') {
        setReport(msg.data)
        setAnalyzing(false)
      }
    }

    ws.onclose = () => {
      setBackendConnected(false)
      wsRef.current = null
      setTimeout(connectWs, 2000)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connectWs()
    return () => wsRef.current?.close()
  }, [connectWs])

  const toggleRecording = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (!recording) {
        setEvents([])
        setReport(null)
        setSelectedEvent(null)
      }
      wsRef.current.send(JSON.stringify({ action: recording ? 'stop' : 'start' }))
    }
  }

  const phase = report ? 'report' : recording ? 'recording' : analyzing ? 'analyzing' : 'idle'

  return (
    <div className="h-screen flex flex-col bg-detective-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-2.5 bg-detective-800 border-b border-detective-600/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-detective-accent to-blue-600 flex items-center justify-center font-bold text-sm">
            K
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            AI Detective <span className="text-detective-accent">K</span>
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-gray-600 ml-2">Post-Crime Analysis System</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {report && (
            <span className="text-xs font-mono text-detective-accent bg-detective-accent/10 px-2 py-0.5 rounded border border-detective-accent/20">
              Case {report.case_id}
            </span>
          )}
          {/* OAK Camera status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${oakConnection.connected ? 'bg-detective-success' : 'bg-yellow-500'}`} />
            <span className="text-gray-400 text-xs">
              {oakConnection.connected ? 'OAK Connected' : 'OAK Disconnected'}
            </span>
          </div>
          {/* Backend status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-detective-success' : 'bg-detective-danger'}`} />
            <span className="text-gray-400 text-xs">{backendConnected ? 'Backend Online' : 'Connecting...'}</span>
          </div>
          {recording && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-detective-danger recording-pulse" />
              <span className="text-detective-danger font-medium text-xs">RECORDING</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — Footage Review + Timeline (compact) */}
        <div className="w-[38%] flex flex-col border-r border-detective-600/30 shrink-0">
          {/* Footage */}
          <div className="h-[45%] flex flex-col border-b border-detective-600/20">
            <FootageReview
              recording={recording}
              onToggleRecording={toggleRecording}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              connected={backendConnected}
              oakConnection={oakConnection}
              phase={phase}
              eventCount={events.length}
              selectedEvent={selectedEvent}
            />
          </div>
          {/* Event Timeline */}
          <div className="flex-1 overflow-hidden">
            <EventTimeline
              events={events}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
              phase={phase}
            />
          </div>
        </div>

        {/* Right — Investigation Report (dominant) */}
        <div className="flex-1 overflow-hidden">
          <IncidentReport
            report={report}
            phase={phase}
            analyzing={analyzing}
            eventCount={events.length}
          />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <DepthAIContext
      connectionConfig={{ type: 'ws', wsUrl: 'ws://localhost:8765' }}
      activeServices={[]}
    >
      <Dashboard />
    </DepthAIContext>
  )
}
