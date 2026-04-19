const RAW_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").trim();

function stripTrailingSlash(value) {
  if (!value || value === "/") {
    return "";
  }

  return value.replace(/\/+$/, "");
}

function normalizeHostLikeValue(value) {
  if (!value) {
    return "";
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith("//")) {
    return value;
  }

  if (
    /^(localhost|127(?:\.\d{1,3}){3}|[\w.-]+\.[A-Za-z]{2,})(?::\d+)?(?:\/|$)/.test(
      value,
    )
  ) {
    const protocol = value.startsWith("localhost") || value.startsWith("127.")
      ? "http://"
      : "https://";
    return `${protocol}${value}`;
  }

  return value;
}

function normalizePathSegment(value) {
  if (!value) {
    return "";
  }

  return value
    .split("/")
    .filter(Boolean)
    .join("/");
}

function joinPath(basePath, segment) {
  const base = stripTrailingSlash(basePath);
  const next = normalizePathSegment(segment);

  if (!base) {
    return next ? `/${next}` : "";
  }

  return next ? `${base}/${next}` : base;
}

function resolveBackendConfig() {
  const hasWindow = typeof window !== "undefined";
  const browserOrigin = hasWindow ? window.location.origin : "http://localhost";

  if (!RAW_BACKEND_URL) {
    return {
      apiBasePath: "/api",
      wsBasePath: "/ws",
      httpOrigin: "",
      wsOrigin: hasWindow
        ? window.location.protocol === "https:"
          ? "wss://" + window.location.host
          : "ws://" + window.location.host
        : "",
    };
  }

  const normalized = normalizeHostLikeValue(RAW_BACKEND_URL);
  const parsed = new URL(normalized, browserOrigin);
  const isAbsolute =
    normalized.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized);
  const pathname = stripTrailingSlash(parsed.pathname);
  const apiMatch = pathname.match(/^(.*?)(?:\/api)(?:\/.*)?$/);
  const appBasePath = apiMatch ? stripTrailingSlash(apiMatch[1]) : pathname;
  const httpOrigin = isAbsolute ? parsed.origin : "";
  const originForWs = httpOrigin || browserOrigin;
  const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";

  return {
    apiBasePath: joinPath(appBasePath, "api"),
    wsBasePath: joinPath(appBasePath, "ws"),
    httpOrigin,
    wsOrigin: `${wsProtocol}//${new URL(originForWs).host}`,
  };
}

const BACKEND_CONFIG = resolveBackendConfig();

export function getApiUrl(path = "") {
  const fullPath = joinPath("ai-detective-k-9gvw.onrender.com/api/camera-output", path);
  return BACKEND_CONFIG.httpOrigin
    ? `${BACKEND_CONFIG.httpOrigin}${fullPath}`
    : fullPath;
}

export function getWebSocketUrl(path = "") {
  const fullPath = joinPath(BACKEND_CONFIG.wsBasePath, path);
  return `${BACKEND_CONFIG.wsOrigin}${fullPath}`;
}
