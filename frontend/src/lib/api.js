import { getApiUrl } from "./urls";

async function apiFetch(endpoint, options = {}) {
  const response = await fetch(getApiUrl(endpoint), options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown Error");
    throw new Error(`API Error ${response.status}: ${errorText.slice(0, 100)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response;
}

export async function sendInvestigateMessage(cameraContext, messages) {
  return fetch(getApiUrl("/investigate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      camera_context: cameraContext,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });
}

export async function fetchCameraOutput() {
  return apiFetch("/camera-output");
}
