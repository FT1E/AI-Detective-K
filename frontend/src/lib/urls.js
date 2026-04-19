// Change your base URL here
const BASE_URL = "https://ai-detective-k-9gvw.onrender.com";

/**
 * Constructs a full API URL. 
 * Ensures the path starts with /api
 */
export function getApiUrl(path = "") {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}/api${cleanPath}`;
}

/**
 * Constructs a WebSocket URL by swapping http for ws
 */
export function getWebSocketUrl(path = "") {
  const wsBase = BASE_URL.replace(/^http/, "ws");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${wsBase}/ws${cleanPath}`;
}