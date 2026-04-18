export default function SceneCanvas3D() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 bg-detective-800/50 border-b border-detective-600/20 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            3D Scene
          </h2>
          <span className="text-[9px] bg-detective-accent/10 text-detective-accent/60 px-1.5 py-0.5 rounded border border-detective-accent/15">
            Coming Soon
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-detective-900/60 px-6 text-center">
        <div className="mb-4 w-16 h-16 rounded-xl border border-detective-600/20 bg-detective-800/40 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-detective-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-400 mb-1">
          3D Scene Reconstruction
        </h3>
        <p className="text-[11px] text-gray-600 leading-relaxed max-w-[260px]">
          Interactive 3D representation of the crime scene will appear here.
          Navigate, rotate, and inspect spatial relationships between subjects
          and evidence.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "Rotate", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
            { label: "Zoom", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" },
            { label: "Measure", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-9 h-9 rounded-lg bg-detective-800/60 border border-detective-600/15 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-detective-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d={item.icon}
                  />
                </svg>
              </div>
              <span className="text-[9px] text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
