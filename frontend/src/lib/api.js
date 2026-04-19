import { getApiUrl } from "./urls";

/**
 * Shared helper to handle common fetch logic (error handling + JSON parsing)
 */
async function apiFetch(endpoint, options = {}) {
  const response = await fetch(getApiUrl(endpoint), options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown Error");
    throw new Error(`API Error ${response.status}: ${errorText.slice(0, 100)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response;
}

export async function fetchCaseData() {
  return apiFetch("/case/dummy");
}

export async function runAnalysis() {
  return apiFetch("/analysis/demo");
}

export async function sendInvestigateMessage(caseData, messages) {
  // We use standard fetch here because you might want to handle streaming (SSE)
  return fetch(getApiUrl("/investigate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      case_data: caseData,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });
}

/**
 * Simplified camera fetch.
 * If you need the timeout/fallback logic, it's best kept separate.
 */
export async function fetchCameraOutput() {
  try {
    return await apiFetch("/camera-output");
  } catch (err) {
    console.error("Camera fetch failed:", err);
    throw err;
  }
}

export async function runAgentAnalysis(annotations = []) {
  return fetch(getApiUrl("/agent/analyze"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ annotations }),
  });
}