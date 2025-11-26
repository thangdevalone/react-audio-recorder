import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioRecording, RecorderFormat } from "react-ts-audio-recorder";
import { useAudioRecorder } from "react-ts-audio-recorder";
import "./App.css";

const formatLabels: Record<RecorderFormat, string> = {
  webm: "WebM / Opus",
  mp3: "MP3",
  wav: "WAV (PCM)"
};

const formatOptions: RecorderFormat[] = ["webm", "mp3", "wav"];

const maxTakes = 5;

export default function App() {
  const [format, setFormat] = useState<RecorderFormat>("webm");
  const [takes, setTakes] = useState<AudioRecording[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const mp3Unsupported =
    format === "mp3" && (!recorder.supports.mp3 || !recorder.isBrowserSupported);

  const canStart = recorder.isBrowserSupported && recorder.status !== "recording";
  const canStop = recorder.status === "recording" || recorder.status === "paused";
  const durationSeconds = (recorder.durationMs / 1000).toFixed(1);
  const bytesKb = (recorder.bytes / 1024).toFixed(1);

  useEffect(() => {
    if (!recorder.recording) {
      return;
    }
    const nextTake = recorder.recording;
    setTakes((prev) => {
      const next = [nextTake, ...prev.filter((take) => take.createdAt !== nextTake.createdAt)];
      return next.slice(0, maxTakes);
    });
    setActiveTakeId(nextTake.createdAt);
  }, [recorder.recording]);

  const activeTake =
    takes.find((take) => take.createdAt === activeTakeId) ?? (takes.length ? takes[0] : null);

  useEffect(() => {
    if (!audioRef.current || !activeTake) {
      return;
    }
    audioRef.current.load();
  }, [activeTake]);

  const handleReplay = () => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.currentTime = 0;
    void audioRef.current.play();
  };

  return (
    <main className="demo">
      <section className="panel">
        <header>
          <p className="eyebrow">Example</p>
          <h1>React TS Audio Recorder</h1>
          <p className="lede">
            Hooks-first audio capture with WAV/WebM/MP3 support. Change the format, start recording,
            and instantly preview or download the result.
          </p>
        </header>

        <div className="layout">
          <section className="card card--controls">
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
              <div className="chips" aria-live="polite">
                {supportBadges}
              </div>
            </div>

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

            {mp3Unsupported && (
              <p className="note" role="status">
                MP3 capture depends on the browser exposing MediaRecorder support for{" "}
                <code>audio/mpeg</code>. Try the latest Chromium-based browser or select WAV/WebM.
              </p>
            )}
          </section>

          <section className="card card--metrics">
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

            {!recorder.isBrowserSupported && (
              <p className="note">
                Your browser does not expose MediaRecorder or AudioContext APIs required for recording.
              </p>
            )}
          </section>
        </div>

        {takes.length > 0 && (
          <section className="card card--takes">
            <div className="preview-headline">
              <div>
                <strong>Latest take</strong>
                {activeTake && (
                  <>
                    <span>{(activeTake.duration / 1000).toFixed(1)}s</span>
                    <span>{(activeTake.size / 1024).toFixed(1)} KB</span>
                  </>
                )}
              </div>
              <div className="preview-actions">
                <button className="ghost" onClick={handleReplay} disabled={!activeTake}>
                  Replay
                </button>
                {activeTake && (
                  <a href={activeTake.url} download={`recording.${activeTake.format}`}>
                    Download
                  </a>
                )}
              </div>
            </div>

            <audio controls ref={audioRef} src={activeTake?.url ?? ""} />

            <ul className="takes-list">
              {takes.map((take) => (
                <li key={take.createdAt}>
                  <button
                    className={`take ${activeTakeId === take.createdAt ? "take--active" : ""}`}
                    onClick={() => setActiveTakeId(take.createdAt)}
                  >
                    <span className="take__name">
                      {new Date(take.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </span>
                    <span>{formatLabels[take.format]}</span>
                    <span>{(take.duration / 1000).toFixed(1)}s</span>
                    <span>{(take.size / 1024).toFixed(1)} KB</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}
