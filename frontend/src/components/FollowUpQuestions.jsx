function StatusCard({ title, subtitle }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 text-center">
      <div>
        <p className="text-sm font-semibold text-gray-200">{title}</p>
        <p className="mt-1 text-[11px] text-gray-500 max-w-xs">{subtitle}</p>
      </div>
    </div>
  );
}

export default function FollowUpQuestions({
  workflow,
  onSelectChoice,
  onSkipQuestion,
  onResetQuestions,
}) {
  const status = workflow?.status || "idle";
  const questions = Array.isArray(workflow?.questions) ? workflow.questions : [];
  const answers = Array.isArray(workflow?.answers) ? workflow.answers : [];
  const currentIndex = Number.isInteger(workflow?.currentIndex)
    ? workflow.currentIndex
    : 0;

  const currentQuestion = questions[currentIndex] || null;

  return (
    <div className="h-full flex flex-col bg-detective-900 rounded-lg border border-detective-600/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-detective-800/50 border-b border-detective-600/20">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Follow-up Questions
        </h3>
        {questions.length > 0 && (
          <div className="text-[10px] text-gray-500 font-mono">
            {Math.min(currentIndex + 1, questions.length)}/{questions.length}
          </div>
        )}
      </div>

      {status === "idle" && (
        <StatusCard
          title="No Active Question Chain"
          subtitle="Capture a frame, annotate if needed, and run Analyze Frame to generate guided multiple-choice follow-ups."
        />
      )}

      {(status === "analyzing" || status === "finalizing") && (
        <StatusCard
          title={status === "analyzing" ? "Generating Questions" : "Compiling Final Report"}
          subtitle="Gemini is processing camera context, annotations, and investigation answers."
        />
      )}

      {status === "error" && (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-detective-danger">Analysis Failed</p>
            <p className="mt-1 text-[11px] text-gray-500 max-w-xs">
              {workflow?.error || "Unknown error while building follow-up questions."}
            </p>
            <button
              type="button"
              onClick={onResetQuestions}
              className="mt-3 h-7 px-3 rounded border border-detective-accent/35 bg-detective-accent/15 text-[10px] font-semibold text-detective-accent"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {status === "questions" && currentQuestion && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <div className="p-3 rounded-lg border border-detective-600/20 bg-detective-800/35">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
              Question {currentIndex + 1}
            </p>
            <p className="text-sm text-gray-200 leading-relaxed">
              {currentQuestion.question}
            </p>
          </div>

          <div className="space-y-2">
            {(currentQuestion.choices || []).map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onSelectChoice?.(choice)}
                className="w-full text-left p-2.5 rounded-lg border border-detective-accent/25 bg-detective-accent/10 text-[12px] text-gray-200 hover:bg-detective-accent/20"
              >
                {choice.text}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onSkipQuestion?.()}
            className="h-7 px-3 rounded border border-detective-600/30 bg-detective-800/50 text-[10px] text-gray-300"
          >
            Skip Question
          </button>
        </div>
      )}

      {status === "completed" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <div className="p-3 rounded-lg border border-detective-success/30 bg-detective-success/10 text-[11px] text-gray-200">
            Final report generated from video context, frame annotations, and follow-up answers.
          </div>
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
              Answer Log
            </p>
            <div className="space-y-2">
              {answers.length === 0 && (
                <div className="text-[11px] text-gray-500">No follow-up answers recorded.</div>
              )}
              {answers.map((entry, index) => (
                <div
                  key={`${entry.question_id || index}-${index}`}
                  className="p-2 rounded border border-detective-600/20 bg-detective-800/35"
                >
                  <p className="text-[10px] text-gray-500">Q{index + 1}</p>
                  <p className="text-[11px] text-gray-300">{entry.question}</p>
                  <p className="text-[11px] text-detective-accent mt-1">
                    {entry.answer || "Skipped"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
