import { useEffect, useState } from "react";

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-detective-600/20 bg-detective-800/40 px-4 py-3 animate-pulse">
      <div className="h-3 bg-detective-600/30 rounded w-1/4 mb-2" />
      <div className="h-3 bg-detective-600/20 rounded w-3/4" />
    </div>
  );
}

function OptionCard({ option, selected, onSelect, disabled }) {
  return (
    <button
      onClick={() => !disabled && onSelect(option)}
      disabled={disabled}
      className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-all
        ${selected
          ? "border-detective-accent bg-detective-accent/15 text-detective-accent"
          : "border-detective-600/20 bg-detective-800/40 text-gray-300 hover:border-detective-accent/40 hover:bg-detective-800/70 hover:scale-[1.01]"
        }
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold border
          ${selected
            ? "bg-detective-accent/30 border-detective-accent/60 text-detective-accent"
            : "bg-detective-900/60 border-detective-600/30 text-gray-500"
          }`}
        >
          {selected ? "✓" : option.id}
        </span>
        <span className="flex-1 leading-relaxed">{option.text}</span>
      </div>
    </button>
  );
}

function CustomAnswerCard({ onSubmit, disabled }) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText("");
  };

  return (
    <div className="rounded-xl border border-detective-600/20 bg-detective-800/40 px-4 py-3 flex items-center gap-2">
      <span className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold border bg-detective-900/60 border-detective-600/30 text-gray-500">
        D
      </span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Type your own lead…"
        disabled={disabled}
        className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="shrink-0 w-7 h-7 rounded-lg bg-detective-accent/20 text-detective-accent border border-detective-accent/30 flex items-center justify-center hover:bg-detective-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        →
      </button>
    </div>
  );
}

function HistoryItem({ item, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-[11px] border border-detective-600/15 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-detective-800/30 text-gray-500 hover:text-gray-400 transition-colors"
      >
        <span>Q{index + 1}: {item.question.question?.slice(0, 50)}…</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 py-2 bg-detective-900/30 text-gray-500">
          <p className="mb-1 text-gray-400">{item.question.question}</p>
          <p>
            <span className="text-detective-accent/70">✓</span>{" "}
            {item.answer.id ? `${item.answer.id} — ` : ""}{item.answer.text || item.answer}
          </p>
        </div>
      )}
    </div>
  );
}

function DepthIndicator({ depth, maxDepth = 5 }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500">Investigation depth:</span>
      <div className="flex gap-1">
        {Array.from({ length: maxDepth }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border ${
              i < depth
                ? "bg-detective-accent border-detective-accent/60"
                : "bg-detective-900/60 border-detective-600/30"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-500">({depth}/{maxDepth})</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FollowUpQuestions({
  followUpState,
  onSelectOption,
  onCustomAnswer,
  onReset,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const { questions, history, loading, stage } = followUpState;

  // Reset selection when a new question arrives
  useEffect(() => {
    setSelectedId(null);
  }, [questions?.question]);

  const handleSelect = (option) => {
    setSelectedId(option.id);
    onSelectOption(questions?.question, option);
  };

  const handleCustom = (text) => {
    setSelectedId("D");
    onCustomAnswer(questions?.question, text);
  };

  // ── Idle ─────────────────────────────────────────────────────────────────
  if (stage === "idle" && !loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Investigation Follow-Up
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3 bg-detective-900/40">
          <div className="w-12 h-12 rounded-full border border-detective-accent/20 bg-detective-accent/10 flex items-center justify-center text-xl">
            🔍
          </div>
          <p className="text-sm font-medium text-gray-300">No Investigation Active</p>
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-xs">
            Annotate a frame and run analysis to begin the investigation
          </p>
        </div>
      </div>
    );
  }

  // ── Loading/Analyzing ────────────────────────────────────────────────────
  if (loading && !questions) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Investigation Follow-Up
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-detective-accent animate-pulse" />
            <span className="text-[10px] text-detective-accent">
              {stage === "analyzing" ? "Analyzing…" : "Loading…"}
            </span>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-2">
          <div className="h-12 bg-detective-800/30 rounded-xl animate-pulse mb-4" />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // ── Complete ─────────────────────────────────────────────────────────────
  if (stage === "complete") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Investigation Complete
          </h2>
          <span className="text-[9px] bg-detective-success/15 text-detective-success px-1.5 py-0.5 rounded border border-detective-success/20">
            DONE
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-gray-400">Investigation summary:</p>
          <div className="space-y-2">
            {history.map((item, i) => (
              <div key={i} className="rounded-xl border border-detective-600/20 bg-detective-800/40 px-4 py-3">
                <p className="text-[11px] text-gray-500 mb-1">Q{i + 1}: {item.question.question}</p>
                <p className="text-[11px] text-detective-accent/80">
                  ✓ {item.answer.id ? `${item.answer.id} — ` : ""}{item.answer.text || item.answer}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={onReset}
            className="w-full py-2 rounded-xl font-medium text-sm border border-detective-accent/30 text-detective-accent hover:bg-detective-accent/10 transition-colors"
          >
            Start New Investigation
          </button>
        </div>
      </div>
    );
  }

  // ── Active questioning ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
        <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Investigation Follow-Up
        </h2>
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-detective-accent animate-pulse" />
            <span className="text-[10px] text-detective-accent">Loading…</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* History */}
        {history.length > 0 && (
          <div className="space-y-1">
            {history.map((item, i) => (
              <HistoryItem key={i} item={item} index={i} />
            ))}
          </div>
        )}

        {/* Current question */}
        {questions && (
          <div className="space-y-3">
            {questions.context_summary && (
              <p className="text-[11px] text-gray-500 italic leading-relaxed">
                {questions.context_summary}
              </p>
            )}
            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {questions.question}
            </p>
            <div className="space-y-2">
              {(questions.options || []).map((opt) => (
                <OptionCard
                  key={opt.id}
                  option={opt}
                  selected={selectedId === opt.id}
                  onSelect={handleSelect}
                  disabled={loading || selectedId !== null}
                />
              ))}
              {questions.allows_custom !== false && (
                <CustomAnswerCard
                  onSubmit={handleCustom}
                  disabled={loading || selectedId !== null}
                />
              )}
            </div>
          </div>
        )}

        {/* Depth indicator */}
        {history.length > 0 && (
          <DepthIndicator depth={history.length} />
        )}
      </div>
    </div>
  );
}
