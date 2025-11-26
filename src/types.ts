export type RecorderFormat = "wav" | "webm" | "mp3";

export type RecorderStatus = "idle" | "recording" | "paused" | "stopped" | "unsupported";

export interface RecorderCapabilities {
  wav: boolean;
  webm: boolean;
  mp3: boolean;
}

export interface AudioRecording {
  blob: Blob;
  url: string;
  format: RecorderFormat;
  duration: number;
  size: number;
  createdAt: number;
}

export interface RecorderLifecycleCallbacks {
  onChunk?: (payload: {
    chunk: Blob;
    chunkIndex: number;
    format: RecorderFormat;
    duration: number;
  }) => void;
  onStop?: (recording: AudioRecording) => void;
  onError?: (error: Error) => void;
}

export interface AudioRecorderOptions extends RecorderLifecycleCallbacks {
  format?: RecorderFormat;
  channelCount?: number;
  sampleRate?: number;
  timeSlice?: number;
  constraints?: MediaStreamConstraints;
  mediaRecorderOptions?: MediaRecorderOptions;
  autoStopMs?: number;
}

export interface UseAudioRecorderResult {
  start: () => Promise<void>;
  stop: () => Promise<AudioRecording | null>;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  status: RecorderStatus;
  supports: RecorderCapabilities;
  recording: AudioRecording | null;
  error: Error | null;
  durationMs: number;
  bytes: number;
  stream: MediaStream | null;
  isBrowserSupported: boolean;
}

