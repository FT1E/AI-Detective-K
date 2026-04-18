import { getApiUrl } from "./backend";

/**
 * Fetch the initial case data from the backend.
 * Returns the case data object or null on failure.
 */
export async function fetchCaseData() {
  const res = await fetch(getApiUrl("/case/dummy"));
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to load case: ${res.status} ${res.statusText}\n${text.slice(0, 200)}`,
    );
  }
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Expected JSON from /api/case/dummy but got ${ct}. ${text.slice(0, 200)}`,
    );
  }

  return res.json();
}

/**
 * Run the demo analysis pipeline.
 * Returns { events, report, case_data } from the backend.
 */
export async function runAnalysis() {
  const res = await fetch(getApiUrl("/analysis/demo"));
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed: ${res.status} ${text.slice(0, 200)}`);
  }
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Expected JSON but got ${ct}. ${text.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Vision Sync Trigger — sends video/sensor data to the backend for processing.
 *
 * This will eventually POST the video file (or a reference / metadata) to
 * a dedicated backend endpoint that ingests the footage and kicks off the
 * detection + analysis pipeline.
 *
 * @param {File}   file     The video file selected by the user.
 * @param {string} mode     The sensor mode — "rgb" | "thermal" | "depth".
 * @param {object} [meta]   Optional extra metadata to attach.
 * @returns {Promise<object>} Backend acknowledgement (shape TBD).
 */
export async function triggerVisionSync(file, mode, meta = {}) {
  // TODO: implement when backend endpoint is ready
  //
  // Planned flow:
  //   1. Build a FormData with the file + mode + meta
  //   2. POST to getApiUrl("/vision-sync")
  //   3. Backend stores the file, starts the processing pipeline,
  //      and returns an ack with a job/session ID
  //
  // const form = new FormData();
  // form.append("file", file);
  // form.append("mode", mode);
  // form.append("meta", JSON.stringify(meta));
  //
  // const res = await fetch(getApiUrl("/vision-sync"), {
  //   method: "POST",
  //   body: form,
  // });
  // if (!res.ok) throw new Error(`Vision sync failed: ${res.status}`);
  // return res.json();

  return { status: "pending", mode, fileName: file.name };
}

/**
 * Send a chat message to the Detective K investigation endpoint.
 * Returns a Response object (may be SSE stream or JSON).
 */
export async function sendInvestigateMessage(caseData, messages) {
  const res = await fetch(getApiUrl("/investigate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      case_data: caseData,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  return res;
}
