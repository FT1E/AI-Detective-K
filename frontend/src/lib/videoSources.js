export const EMPTY_VIDEO_SOURCES = {
  rgb: null,
  thermal: null,
  depth: null,
};

/**
 * Revoke the object URL held by a video source entry.
 */
export function revokeVideoSource(entry) {
  if (entry?.url) {
    URL.revokeObjectURL(entry.url);
  }
}

/**
 * Build a new video source entry from a File object.
 */
export function createVideoSource(file) {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    url: URL.createObjectURL(file),
  };
}

/**
 * Replace one mode's video source in the sources map.
 * Revokes the previous URL if it exists.
 * Returns a new sources object (immutable update).
 */
export function replaceVideoSource(sources, mode, file) {
  const next = { ...sources };
  revokeVideoSource(next[mode]);
  next[mode] = createVideoSource(file);
  return next;
}

/**
 * Revoke all video sources and return the empty state.
 */
export function clearAllVideoSources(sources) {
  Object.values(sources).forEach(revokeVideoSource);
  return { ...EMPTY_VIDEO_SOURCES };
}
