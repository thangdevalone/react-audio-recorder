# react-audio-recorder-lite

Lightweight and modern audio recording hooks for React. Built on top of the Web Audio API with friendly APIs, WAV fallback, and MediaRecorder support for WebM and MP3.

## Features

- 🎧 Hooks-first API (`useAudioRecorder`)
- 🌐 WAV/WebM/MP3 formats with runtime capability detection
- ⚙️ Web Audio API fallback for lossless WAV in browsers without `MediaRecorder`
- ⏱️ Duration, byte size, and chunk callbacks for streaming use-cases
- 🧼 Zero dependencies at runtime and tree-shakeable by default
- 📦 Ready for npm or GitHub Packages publishing

## Installation

Pick the package manager you already use. This repo uses **npm**:

```bash
npm install react-audio-recorder-lite
```

## Quick start

```tsx
import { useAudioRecorder } from "react-audio-recorder-lite";

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

The demo imports the hook straight from the root package (`react-audio-recorder-lite`) via a `file:` dependency so you can iterate on the library and the UI simultaneously.

## License

MIT © Thang Dev

