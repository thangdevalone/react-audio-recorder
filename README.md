# react-ts-audio-recorder

Lightweight and modern audio recording hooks for React. Built on top of the Web Audio API with friendly APIs, WAV fallback, MediaRecorder support for WebM/MP3, and an optional LameJS-powered MP3 encoder when the browser cannot emit MP3 natively.

## Features

- 🎧 Hooks-first API (`useAudioRecorder`)
- 🌐 WAV/WebM/MP3 formats with runtime capability detection
- ⚙️ Web Audio API fallback for lossless WAV or LameJS fallback for MP3 anywhere
- ⏱️ Duration, byte size, and chunk callbacks for streaming use-cases
- 🧼 Minimal dependencies with lazy-loaded MP3 encoder
- 📦 Ready for npm or GitHub Packages publishing

## Installation

Pick the package manager you already use. This repo uses **npm**:

```bash
npm install react-ts-audio-recorder
```

## Quick start

```tsx
import { useAudioRecorder } from "react-ts-audio-recorder";

export function RecorderDemo() {
  const recorder = useAudioRecorder({
    format: "wav",
    onStop: (recording) => {
      console.log("Recording saved", recording);
    }
  });

  return (
    <div>
      <p>Status: {recorder.status}</p>
      <p>Duration: {(recorder.durationMs / 1000).toFixed(1)}s</p>
      <button onClick={recorder.start} disabled={!recorder.isBrowserSupported}>
        Start
      </button>
      <button onClick={() => void recorder.stop()} disabled={recorder.status === "idle"}>
        Stop
      </button>
      {recorder.recording && <audio src={recorder.recording.url} controls />}
    </div>
  );
}
```

## API

### `useAudioRecorder(options?: AudioRecorderOptions)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | `"wav" | "webm" | "mp3"` | `"webm"` | Target container/codec. WAV falls back to Web Audio API if needed. |
| `channelCount` | `number` | `1` | Number of channels to capture. |
| `sampleRate` | `number` | `48000` | Target sample rate. |
| `timeSlice` | `number` | `0` | Time slice (ms) for chunked `MediaRecorder` data. |
| `constraints` | `MediaStreamConstraints` | smart defaults | Pass custom `getUserMedia` constraints. |
| `mediaRecorderOptions` | `MediaRecorderOptions` | - | Extend native recorder options (bitrate, etc.). |
| `autoStopMs` | `number` | - | Automatically stop after the provided duration. |
| `mp3` | `{ fallbackBitrateKbps?: number; preferFallback?: boolean; }` | `{ fallbackBitrateKbps: 128 }` | Configure the LameJS MP3 fallback (bitrate + whether to skip native MediaRecorder when available). |
| `onChunk` | `(ctx) => void` | - | Receive every chunk as it's recorded. |
| `onStop` | `(recording) => void` | - | Get the final blob metadata. |
| `onError` | `(error) => void` | - | Error hook. |

### Returned fields

- `start()`, `stop()`, `pause()`, `resume()`, `reset()` helpers
- `status`: `"idle" | "recording" | "paused" | "stopped" | "unsupported"`
- `recording`: latest `AudioRecording` blob metadata
- `durationMs`, `bytes`: live metrics
- `stream`: underlying `MediaStream`
- `supports`: capability flags per format
- `isBrowserSupported`: guards SSR or unsupported clients

## Example UI (Vite + React)

A ready-to-run Vite playground lives in `examples/vite-demo`.

```bash
cd examples/vite-demo
npm install
npm run dev
```

The demo imports the hook straight from the root package (`react-ts-audio-recorder`) via a `file:` dependency so you can iterate on the library and the UI simultaneously.

## MP3 fallback encoding

Most stable browsers still cannot emit MP3 blobs through `MediaRecorder`. When you request `format: "mp3"`, the hook will:

1. Prefer the native `MediaRecorder` pipeline when `MediaRecorder.isTypeSupported("audio/mpeg")` returns `true`.
2. Automatically fall back to recording raw PCM frames and lazily loading **LameJS** to encode them into MP3 entirely in JavaScript whenever the native API is missing.

You can tweak the fallback through the `mp3` option:

```ts
const recorder = useAudioRecorder({
  format: "mp3",
  mp3: {
    fallbackBitrateKbps: 192,
    preferFallback: false // set true to always use the LameJS path
  }
});
```

The fallback kicks in as long as `AudioContext` is available, so MP3 becomes a reliable target even on Safari or Chromium builds without native encoder support.

## License

MIT © Thang Dev

