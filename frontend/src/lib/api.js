import { getApiUrl } from "./urls";

const CAMERA_OUTPUT_FALLBACK_URL =
  (import.meta.env.VITE_CAMERA_OUTPUT_URL || "https://ai-detective-k-9gvw.onrender.com/api/camera-output").trim();

async function fetchWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
 * GET all camera output entries posted by the OAK camera script.
 * Each entry contains { detections, rgb_base64, depth_base64, timestamp, received_at }.
 * @returns {Promise<object[]>}
 */
export async function fetchCameraOutput() {
  const localUrl = getApiUrl("/api/camera-output");
  const candidates = [localUrl];

  if (CAMERA_OUTPUT_FALLBACK_URL && CAMERA_OUTPUT_FALLBACK_URL !== localUrl) {
    candidates.push(CAMERA_OUTPUT_FALLBACK_URL);
  }

  let lastError = null;

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Camera output GET failed at ${url}: ${res.status} ${text.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      console.warn("Camera output fetch attempt failed:", url, err?.message || err);
    }
  }

  throw lastError || new Error("Camera output GET failed for all endpoints");
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
