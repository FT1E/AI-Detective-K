import { useState, useRef, useEffect } from "react";

function MessageBubble({ message }) {
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] text-gray-500 bg-detective-800/60 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isAssistant ? "justify-start" : "justify-end"} mb-3`}
    >
      <div className={`max-w-[90%] ${isAssistant ? "" : "order-1"}`}>
        {isAssistant && (
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-detective-accent to-blue-600 flex items-center justify-center">
              <span className="text-[8px] font-bold">K</span>
            </div>
            <span className="text-[10px] text-detective-accent font-medium">
              Detective K
            </span>
          </div>
        )}
        <div
          className={`rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
            isAssistant
              ? "bg-detective-800/60 border border-detective-600/20 text-gray-300"
              : "bg-detective-accent/15 border border-detective-accent/20 text-gray-200"
          }`}
        >
          <FormattedContent content={message.content} />
        </div>
      </div>
    </div>
  );
}

function FormattedContent({ content }) {
  // Simple markdown-like rendering for the detective's messages
  const lines = content.split("\n");
  const elements = [];
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-gray-200 mt-3 mb-1">
          {line.slice(3)}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <p key={i} className="font-semibold text-gray-200 mt-2 mb-0.5">
          {line.slice(2, -2)}
        </p>,
      );
      continue;
    }

    // Table detection
    if (line.startsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      if (!line.match(/^\|[\s-|]+$/)) {
        // skip separator rows
        tableRows.push(
          line
            .split("|")
            .filter(Boolean)
            .map((c) => c.trim()),
        );
      }
      // Check if next line is not a table
      if (i + 1 >= lines.length || !lines[i + 1].startsWith("|")) {
        inTable = false;
        elements.push(
          <div key={i} className="my-2 overflow-x-auto">
            <table className="text-[10px] w-full">
              <tbody>
                {tableRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={
                      ri === 0 ? "border-b border-detective-600/20" : ""
                    }
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`px-2 py-1 ${ri === 0 ? "font-semibold text-gray-300" : "text-gray-400"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      elements.push(
        <p key={i} className="ml-2 my-0.5 text-gray-400">
          <span className="text-detective-accent font-mono mr-1">
            {line.match(/^\d+/)[0]}.
          </span>
          <FormattedInline text={line.replace(/^\d+\.\s/, "")} />
        </p>,
      );
      continue;
    }

    // Horizontal rules
    if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className="border-detective-600/20 my-2" />);
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // Regular paragraphs with inline formatting
    elements.push(
      <p key={i} className="text-gray-400 my-0.5">
        <FormattedInline text={line} />
      </p>,
    );
  }

  return <>{elements}</>;
}

function FormattedInline({ text }) {
  // Handle **bold** and *italic* inline
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="text-gray-200 font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={i} className="text-gray-300">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-detective-accent to-blue-600 flex items-center justify-center">
            <span className="text-[8px] font-bold">K</span>
          </div>
          <span className="text-[10px] text-detective-accent font-medium">
            Detective K
          </span>
          <span className="text-[10px] text-gray-600 ml-1">
            is analyzing...
          </span>
        </div>
        <div className="bg-detective-800/60 border border-detective-600/20 rounded-xl px-4 py-3">
          <div className="flex gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full bg-detective-accent/60 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-detective-accent/60 animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-detective-accent/60 animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function DetectiveChat({ caseData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [investigating, setInvestigating] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const sendToDetective = async (userMessage, isFirst = false) => {
    const newMessages = isFirst
      ? []
      : [...messages, { role: "user", content: userMessage }];

    if (!isFirst) {
      setMessages(newMessages);
    }

    setLoading(true);
    setStreamingContent("");

    try {
      const res = await fetch(`${API_BASE}/api/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_data: caseData,
          messages: newMessages
            .filter((m) => m.role !== "system")
            .map((m) => ({
              role: m.role,
              content: m.content,
            })),
        }),
      });

      const contentType = res.headers.get("content-type") || "";

      // Handle non-OK status quickly
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const short = text ? text.slice(0, 400) : "";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Connection error: ${res.status} ${res.statusText}. Response snippet:\n${short}`,
          },
        ]);
        setLoading(false);
        return;
      }

      // If server returned HTML (index.html, login page, 404 page, etc.)
      if (contentType.includes("text/html")) {
        const text = await res.text().catch(() => "");
        const short = text ? text.slice(0, 400) : "";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Connection error: expected JSON or stream but received HTML (content-type: ${contentType}). Response snippet:\n${short}`,
          },
        ]);
        setLoading(false);
        return;
      }

      if (contentType.includes("text/event-stream")) {
        // Streaming response from Gemini
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "chunk") {
                  accumulated += data.content;
                  setStreamingContent(accumulated);
                } else if (data.type === "done") {
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: accumulated },
                  ]);
                  setStreamingContent("");
                } else if (data.type === "error") {
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: `Error: ${data.content}` },
                  ]);
                  setStreamingContent("");
                }
              } catch {}
            }
          }
        }
      } else {
        // JSON response (fallback mode)
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.content },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Connection error: ${err.message}. Make sure the backend is running.`,
        },
      ]);
    }

    setLoading(false);
  };

  const handleInvestigate = () => {
    setInvestigating(true);
    setMessages([
      { role: "system", content: "Investigation started — case file loaded" },
    ]);
    sendToDetective("", true);
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendToDetective(input.trim());
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Not yet investigating — show the start screen
  if (!investigating) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            AI Detective
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-detective-accent/20 to-blue-600/20 border border-detective-accent/30 flex items-center justify-center mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-detective-accent to-blue-600 flex items-center justify-center">
              <span className="text-lg font-bold">K</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-200 mb-1">
            Detective K
          </h3>
          <p className="text-xs text-gray-500 mb-1">
            AI Investigation Assistant
          </p>
          <p className="text-[11px] text-gray-600 leading-relaxed mb-6 max-w-[280px]">
            Analyzes multi-modal sensor evidence, asks follow-up questions,
            builds hypotheses, and reconstructs incidents.
          </p>

          {/* Case summary card */}
          <div className="w-full bg-detective-800/40 rounded-xl p-3.5 border border-detective-600/15 mb-4 text-left">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Case File Ready
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span className="text-gray-400">
                  {caseData?.scene_data?.location || "Industrial warehouse"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date / Time</span>
                <span className="text-detective-accent font-mono">
                  {caseData?.scene_data?.date || "—"}{" "}
                  {caseData?.scene_data?.time || ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Evidence</span>
                <span className="text-gray-400 font-mono">
                  {caseData?.evidence?.length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Environment</span>
                <span className="text-gray-400">
                  {caseData?.scene_data?.environment || "—"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleInvestigate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-detective-accent to-blue-600 text-white hover:opacity-90 transition-opacity shadow-lg shadow-detective-accent/20"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Investigate
          </button>
        </div>
      </div>
    );
  }

  // Active investigation chat
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-detective-accent to-blue-600 flex items-center justify-center">
            <span className="text-[8px] font-bold">K</span>
          </div>
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Detective K
          </h2>
          {loading && (
            <span className="text-[9px] text-detective-accent animate-pulse">
              analyzing...
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setInvestigating(false);
            setMessages([]);
          }}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          New Case
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {streamingContent && (
          <MessageBubble
            message={{ role: "assistant", content: streamingContent }}
          />
        )}
        {loading && !streamingContent && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 bg-detective-800/50 border-t border-detective-600/20 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Answer the detective or ask a question..."
            rows={1}
            className="flex-1 bg-detective-900/60 border border-detective-600/20 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-detective-accent/40"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-3 py-2 bg-detective-accent/20 text-detective-accent border border-detective-accent/30 rounded-lg text-xs font-medium hover:bg-detective-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
