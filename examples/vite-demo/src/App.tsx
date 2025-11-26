import { useMemo, useState } from "react";
import type { RecorderFormat } from "react-ts-audio-recorder";
import { useAudioRecorder } from "react-ts-audio-recorder";
import "./App.css";

const formatLabels: Record<RecorderFormat, string> = {
  webm: "WebM / Opus",
  mp3: "MP3",
  wav: "WAV (PCM)"
};

const formatOptions: RecorderFormat[] = ["webm", "mp3", "wav"];

export default function App() {
  const [format, setFormat] = useState<RecorderFormat>("webm");

  const recorder = useAudioRecorder({
    format,
    autoStopMs: 60_000,
    onStop: (recording) => {
      console.info("Recording finished", recording);
    },
    onError: (error) => {
      console.error("Recorder error", error);
    }
  });

  const supportBadges = useMemo(() => {
    return (Object.entries(recorder.supports) as Array<[RecorderFormat, boolean]>).map(
      ([key, value]) => (
        <span key={key} className={`chip ${value ? "chip--ok" : "chip--nope"}`}>
          {formatLabels[key]}: {value ? "Yes" : "No"}
        </span>
      )
    );
  }, [recorder.supports]);

  const canStart = recorder.isBrowserSupported && recorder.status !== "recording";
  const canStop = recorder.status === "recording" || recorder.status === "paused";
  const durationSeconds = (recorder.durationMs / 1000).toFixed(1);
  const bytesKb = (recorder.bytes / 1024).toFixed(1);

  return (
    <main className="demo">
      <section className="panel">
        <header>
          <p className="eyebrow">Example</p>
          <h1>React Audio Recorder Lite</h1>
          <p className="lede">
            Hooks-first audio capture with WAV/WebM/MP3 support. Change the format, start recording,
            and instantly preview or download the result.
          </p>
        </header>

        <div className="selectors">
          <label className="select-group">
            <span>Output format</span>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as RecorderFormat)}
            >
              {formatOptions.map((option) => (
                <option key={option} value={option}>
                  {formatLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <div className="chips">{supportBadges}</div>
        </div>

        <div className="metrics">
          <div>
            <span>Status</span>
            <strong className={`status status--${recorder.status}`}>{recorder.status}</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>{durationSeconds}s</strong>
          </div>
          <div>
            <span>Bytes</span>
            <strong>{bytesKb} KB</strong>
          </div>
        </div>

        {recorder.error && (
          <p className="error" role="status">
            {recorder.error.message}
          </p>
        )}

        <div className="controls">
          <button onClick={() => void recorder.start()} disabled={!canStart}>
            Start
          </button>
          <button onClick={recorder.pause} disabled={recorder.status !== "recording"}>
            Pause
          </button>
          <button onClick={recorder.resume} disabled={recorder.status !== "paused"}>
            Resume
          </button>
          <button onClick={() => void recorder.stop()} disabled={!canStop}>
            Stop
          </button>
          <button className="ghost" onClick={recorder.reset}>
            Reset
          </button>
        </div>

        {!recorder.isBrowserSupported && (
          <p className="note">
            Your browser does not expose MediaRecorder or AudioContext APIs required for recording.
          </p>
        )}

        {recorder.recording && (
          <div className="preview">
            <div>
              <strong>Latest take</strong>
              <span>{(recorder.recording.duration / 1000).toFixed(1)}s</span>
              <span>{(recorder.recording.size / 1024).toFixed(1)} KB</span>
            </div>
            <audio controls src={recorder.recording.url} />
            <div className="preview-actions">
              <a href={recorder.recording.url} download={`recording.${recorder.recording.format}`}>
                Download
              </a>
              <button
                className="ghost"
                onClick={() => void navigator.clipboard?.writeText(recorder.recording?.url ?? "")}
              >
                Copy URL
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
