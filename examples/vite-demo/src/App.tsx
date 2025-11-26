import { useMemo } from "react";
import { useAudioRecorder } from "react-audio-recorder-lite";

const formatLabel: Record<string, string> = {
  wav: "WAV (lossless)",
  webm: "WebM (Opus)",
  mp3: "MP3"
};

export function App() {
  const recorder = useAudioRecorder({
    format: "webm",
    autoStopMs: 60_000,
    onStop: (recording) => {
      console.info("Recording finished", recording);
    }
  });

  const supportBadges = useMemo(() => {
    return Object.entries(recorder.supports).map(([key, value]) => (
      <span key={key} className={`chip ${value ? "chip--ok" : "chip--nope"}`}>
        {formatLabel[key] ?? key}: {value ? "Yes" : "No"}
      </span>
    ));
  }, [recorder.supports]);

  const canRecord = recorder.isBrowserSupported && recorder.status !== "recording";

  return (
    <main className="page">
      <header>
        <h1>React Audio Recorder Lite</h1>
        <p>Hooks-first recorder with WAV/WebM/MP3 formats.</p>
      </header>

      <section className="card">
        <div className="metrics">
          <div>
            <span className="metric-label">Status</span>
            <strong>{recorder.status}</strong>
          </div>
          <div>
            <span className="metric-label">Duration</span>
            <strong>{(recorder.durationMs / 1000).toFixed(1)}s</strong>
          </div>
          <div>
            <span className="metric-label">Bytes</span>
            <strong>{(recorder.bytes / 1024).toFixed(1)} KB</strong>
          </div>
        </div>

        <div className="controls">
          <button onClick={recorder.start} disabled={!canRecord}>
            Start
          </button>
          <button onClick={recorder.pause} disabled={recorder.status !== "recording"}>
            Pause
          </button>
          <button onClick={recorder.resume} disabled={recorder.status !== "paused"}>
            Resume
          </button>
          <button onClick={() => void recorder.stop()} disabled={recorder.status === "idle"}>
            Stop
          </button>
          <button className="ghost" onClick={recorder.reset}>
            Reset
          </button>
        </div>

        <div className="support-grid">
          <span className="metric-label">Browser support</span>
          <div className="chips">{supportBadges}</div>
        </div>

        {recorder.recording && (
          <div className="preview">
            <p>
              <strong>Last recording</strong>
              <span>{(recorder.recording.duration / 1000).toFixed(1)}s</span>
              <span>{(recorder.recording.size / 1024).toFixed(1)} KB</span>
            </p>
            <audio controls src={recorder.recording.url} />
            <a href={recorder.recording.url} download={`recording.${recorder.recording.format}`}>
              Download
            </a>
          </div>
        )}
      </section>
    </main>
  );
}

