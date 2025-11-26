import { RecorderCapabilities, RecorderFormat } from "../types";

const MIME_MAP: Record<RecorderFormat, string> = {
  wav: "audio/wav",
  webm: "audio/webm;codecs=opus",
  mp3: "audio/mpeg"
};

export const isBrowser = typeof window !== "undefined" && typeof navigator !== "undefined";

export function formatToMime(format: RecorderFormat): string {
  return MIME_MAP[format];
}

export function detectRecorderSupport(): RecorderCapabilities {
  if (!isBrowser || typeof MediaRecorder === "undefined") {
    return { wav: false, webm: false, mp3: false };
  }

  const entries = Object.entries(MIME_MAP).map(([format, mime]) => {
    try {
      return [format, MediaRecorder.isTypeSupported(mime)];
    } catch {
      return [format, false];
    }
  });

  return Object.fromEntries(entries) as RecorderCapabilities;
}

