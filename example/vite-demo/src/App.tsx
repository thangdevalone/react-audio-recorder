import { useEffect, useRef, useState } from "react";
import {
    DEFAULT_VMSG_WASM_URL,
    MultiRecorder,
    type AudioFormat,
} from "react-ts-audio-recorder";
import vmsgWasm from "react-ts-audio-recorder/assets/vmsg.wasm?url";
import pcmWorklet from "react-ts-audio-recorder/assets/pcm-worklet.js?url";
import "./style.css";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

const FORMATS: AudioFormat[] = ["mp3", "wav"];

const FORMAT_INFO: Record<
  AudioFormat,
  { name: string; description: string; extension: string; mimeType: string }
> = {
  mp3: {
    name: "MP3",
    description: "Best compression, universal support (vmsg)",
    extension: "mp3",
    mimeType: "audio/mpeg",
  },
  wav: {
    name: "WAV",
    description: "Lossless quality, no WASM needed",
    extension: "wav",
    mimeType: "audio/wav",
  },
};

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<AudioFormat>("mp3");

  const recorderRef = useRef<MultiRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError(null);
      setIsInitializing(true);

      const recorder = new MultiRecorder({
        format: selectedFormat,
        sampleRate: 48000,
        wasmURL: vmsgWasm || DEFAULT_VMSG_WASM_URL,
        workletURL: pcmWorklet,
      });

      recorderRef.current = recorder;

      await recorder.init();
      await recorder.startRecording();

      setIsRecording(true);
      setIsInitializing(false);
      startTimeRef.current = Date.now();
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(Date.now() - startTimeRef.current);
      }, 100);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
      setIsInitializing(false);
      if (recorderRef.current) {
        recorderRef.current.close();
        recorderRef.current = null;
      }
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const blob = await recorderRef.current.stopRecording();

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setIsRecording(false);

      // Close and cleanup resources
      if (recorderRef.current) {
        recorderRef.current.close();
        recorderRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop recording");
      setIsRecording(false);
      if (recorderRef.current) {
        recorderRef.current.close();
        recorderRef.current = null;
      }
    }
  };

  const handleButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatInfo = FORMAT_INFO[selectedFormat];

  return (
    <main className="demo">
      <h1>🎙️ Multi-Format Audio Recorder</h1>
      <p className="subtitle">Record audio in MP3 or WAV format</p>

      {error && <div className="error-message">⚠️ {error}</div>}

      <div className="format-selector">
        <label>Output Format:</label>
        <div className="format-buttons">
          {FORMATS.map((format) => {
            const info = FORMAT_INFO[format];
            return (
              <button
                key={format}
                className={`format-button ${
                  selectedFormat === format ? "active" : ""
                }`}
                onClick={() => setSelectedFormat(format)}
                disabled={isRecording || isInitializing}
                title={info.description}
              >
                {info.name}
              </button>
            );
          })}
        </div>
        <div className="format-info">
          <span className="format-name">{formatInfo.name}</span>
          <span className="format-desc">{formatInfo.description}</span>
        </div>
      </div>

      <div className="recorder-controls">
        <button
          className={`record-button ${isRecording ? "recording" : ""} ${
            isInitializing ? "initializing" : ""
          }`}
          onClick={handleButtonClick}
          disabled={isInitializing}
        >
          {isInitializing ? (
            <>
              <span className="spinner"></span>
              Initializing...
            </>
          ) : isRecording ? (
            <>
              <span className="recording-indicator"></span>
              Stop Recording
            </>
          ) : (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              Start Recording
            </>
          )}
        </button>

        {isRecording && (
          <div className="timer">
            <span className="timer-icon">⏱</span>
            {formatTime(recordingTime)}
          </div>
        )}
      </div>

      {audioUrl && (
        <div className="audio-preview">
          <h3>Preview</h3>
          <audio controls src={audioUrl} />
          <div className="audio-actions">
            <a
              href={audioUrl}
              download={`recording-${new Date()
                .toISOString()
                .slice(0, 19)
                .replace(/:/g, "-")}.${formatInfo.extension}`}
              className="download-button"
            >
              Download {formatInfo.name}
            </a>
            <button
              className="clear-button"
              onClick={() => {
                if (audioUrl) {
                  URL.revokeObjectURL(audioUrl);
                  setAudioUrl(null);
                }
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
