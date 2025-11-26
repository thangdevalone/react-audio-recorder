import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioRecorderOptions,
  AudioRecording,
  RecorderStatus,
  UseAudioRecorderResult
} from "../types";
import { detectRecorderSupport, formatToMime, isBrowser } from "../utils/mime";
import { PCMFrame, encodeWav } from "../utils/pcm";

const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true
};

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  audio: DEFAULT_AUDIO_CONSTRAINTS
};

const DEFAULT_SAMPLE_RATE = 48_000;

const PCM_WORKLET_PROCESSOR_NAME = "pcm-recorder-processor";
const PCM_WORKLET_PROCESSOR_SOURCE = `
class PCMRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const frame = input.map((channel) => channel.slice());
    this.port.postMessage(frame);
    return true;
  }
}
registerProcessor("${PCM_WORKLET_PROCESSOR_NAME}", PCMRecorderProcessor);
`;

const pcmWorkletLoadedContexts = new WeakSet<BaseAudioContext>();
let pcmWorkletModuleUrl: string | null = null;

type LegacyProcessorNode = AudioNode & {
  onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
};

type PCMProcessorNode = AudioWorkletNode | LegacyProcessorNode;

async function ensurePCMWorkletModule(audioContext: AudioContext): Promise<boolean> {
  if (!audioContext.audioWorklet) {
    return false;
  }

  if (pcmWorkletLoadedContexts.has(audioContext)) {
    return true;
  }

  if (!pcmWorkletModuleUrl) {
    pcmWorkletModuleUrl = URL.createObjectURL(
      new Blob([PCM_WORKLET_PROCESSOR_SOURCE], { type: "application/javascript" })
    );
  }

  await audioContext.audioWorklet.addModule(pcmWorkletModuleUrl);
  pcmWorkletLoadedContexts.add(audioContext);
  return true;
}

export function useAudioRecorder(options: AudioRecorderOptions = {}): UseAudioRecorderResult {
  const {
    format = "webm",
    channelCount = 1,
    sampleRate = DEFAULT_SAMPLE_RATE,
    timeSlice = 0,
    constraints,
    mediaRecorderOptions,
    autoStopMs,
    onChunk,
    onStop,
    onError
  } = options;

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const supports = useMemo(() => detectRecorderSupport(), []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pcmFramesRef = useRef<PCMFrame[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<PCMProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const elapsedBeforePauseRef = useRef(0);
  const activeStartRef = useRef<number | null>(null);
  const autoStopTimeoutRef = useRef<number | null>(null);

  const computedConstraints = useMemo<MediaStreamConstraints>(() => {
    if (constraints) {
      return constraints;
    }
    return {
      audio: {
        channelCount,
        sampleRate,
        ...DEFAULT_AUDIO_CONSTRAINTS
      }
    };
  }, [constraints, channelCount, sampleRate]);

  const resetDuration = useCallback(() => {
    elapsedBeforePauseRef.current = 0;
    activeStartRef.current = null;
    setDurationMs(0);
  }, []);

  const computeDuration = useCallback(() => {
    if (activeStartRef.current !== null) {
      return elapsedBeforePauseRef.current + (performance.now() - activeStartRef.current);
    }
    return elapsedBeforePauseRef.current;
  }, []);

  const clearAutoStop = useCallback(() => {
    if (autoStopTimeoutRef.current) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  }, []);

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      onError?.(err);
      setStatus("unsupported");
    },
    [onError]
  );

  const cleanupAudioGraph = useCallback(async () => {
    if (processorNodeRef.current) {
      if ("port" in processorNodeRef.current) {
        processorNodeRef.current.port.onmessage = null;
      }
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    gainNodeRef.current?.disconnect();
    gainNodeRef.current = null;
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    pcmFramesRef.current = [];
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const cleanupRecorder = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setBytes(0);
    await cleanupAudioGraph();
    cleanupStream();
    clearAutoStop();
  }, [cleanupAudioGraph, cleanupStream, clearAutoStop]);

  const finalizeRecording = useCallback(
    (blob: Blob | null): AudioRecording | null => {
      if (!blob) {
        return null;
      }
      const recordingResult: AudioRecording = {
        blob,
        url: URL.createObjectURL(blob),
        format,
        duration: computeDuration(),
        size: blob.size,
        createdAt: Date.now()
      };
      setRecording(recordingResult);
      onStop?.(recordingResult);
      return recordingResult;
    },
    [computeDuration, format, onStop]
  );

  const buildPCMGraph = useCallback(
    async (stream: MediaStream) => {
      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      gainNodeRef.current = gainNode;

      const hasWorklet = await ensurePCMWorkletModule(audioContext);
      if (hasWorklet) {
        const workletNode = new AudioWorkletNode(audioContext, PCM_WORKLET_PROCESSOR_NAME, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount
        });
        workletNode.port.onmessage = (event) => {
          const frameData = event.data as Float32Array[];
          if (!Array.isArray(frameData)) {
            return;
          }
          const frame: PCMFrame = frameData.map((channel) => new Float32Array(channel));
          pcmFramesRef.current.push(frame);
        };
        processorNodeRef.current = workletNode;
        sourceNode.connect(workletNode);
        workletNode.connect(gainNode);
      } else {
        const scriptNode = audioContext.createScriptProcessor(4096, channelCount, channelCount);
        const legacyNode = scriptNode as LegacyProcessorNode;
        processorNodeRef.current = legacyNode;

        legacyNode.onaudioprocess = (event) => {
          const frame: PCMFrame = [];
          for (let channel = 0; channel < channelCount; channel += 1) {
            const channelData = event.inputBuffer.getChannelData(channel);
            frame.push(new Float32Array(channelData));
          }
          pcmFramesRef.current.push(frame);
        };

        sourceNode.connect(legacyNode);
        legacyNode.connect(gainNode);
      }

      gainNode.connect(audioContext.destination);
    },
    [channelCount, sampleRate]
  );

  const stop = useCallback(async () => {
    if (status === "idle" || status === "unsupported") {
      return recording;
    }

    setStatus("stopped");
    activeStartRef.current = null;

    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      if (recorder.state === "inactive") {
        const blob = new Blob(chunksRef.current, { type: formatToMime(format) });
        const result = finalizeRecording(blob);
        await cleanupRecorder();
        return result;
      }

      const blob = await new Promise<Blob>((resolve) => {
        const handleStop = () => {
          recorder.removeEventListener("stop", handleStop);
          resolve(new Blob(chunksRef.current, { type: formatToMime(format) }));
        };
        recorder.addEventListener("stop", handleStop);
        recorder.stop();
      });

      const result = finalizeRecording(blob);
      await cleanupRecorder();
      return result;
    }

    if (pcmFramesRef.current.length) {
      const wavBlob = encodeWav(pcmFramesRef.current, sampleRate, channelCount);
      const result = finalizeRecording(wavBlob);
      await cleanupRecorder();
      return result;
    }

    await cleanupRecorder();
    return null;
  }, [
    channelCount,
    cleanupRecorder,
    finalizeRecording,
    format,
    recording,
    sampleRate,
    status
  ]);

  const start = useCallback(async () => {
    if (!isBrowser || !navigator.mediaDevices) {
      handleError(new Error("Audio recording is only available in the browser."));
      return;
    }

    if (status === "recording") {
      return;
    }

    try {
      const userStream = await navigator.mediaDevices.getUserMedia(computedConstraints);
      streamRef.current = userStream;
      setStream(userStream);
      chunksRef.current = [];
      pcmFramesRef.current = [];
      resetDuration();
      activeStartRef.current = performance.now();
      setStatus("recording");
      setError(null);

      const mimeType = formatToMime(format);
      const canUseMediaRecorder =
        typeof MediaRecorder !== "undefined" && mimeType && MediaRecorder.isTypeSupported(mimeType);

      if (canUseMediaRecorder) {
        const recorder = new MediaRecorder(userStream, {
          mimeType,
          ...mediaRecorderOptions
        });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size) {
            chunksRef.current.push(event.data);
            setBytes((prev) => prev + event.data.size);
            onChunk?.({
              chunk: event.data,
              chunkIndex: chunksRef.current.length - 1,
              format,
              duration: computeDuration()
            });
          }
        };

        recorder.onerror = (event) => {
          const recorderError = event.error ?? new Error("Unknown recorder error");
          handleError(recorderError);
        };

        recorder.start(timeSlice);
      } else if (format === "wav") {
        await buildPCMGraph(userStream);
      } else {
        throw new Error(`${format.toUpperCase()} recording is not supported in this browser.`);
      }

      if (autoStopMs) {
        clearAutoStop();
        autoStopTimeoutRef.current = window.setTimeout(() => {
          void stop();
        }, autoStopMs);
      }
    } catch (err) {
      handleError(err as Error);
      await cleanupRecorder();
      setStatus("idle");
    }
  }, [
    autoStopMs,
    buildPCMGraph,
    clearAutoStop,
    computedConstraints,
    format,
    handleError,
    mediaRecorderOptions,
    onChunk,
    resetDuration,
    status,
    timeSlice,
    cleanupRecorder,
    stop,
    computeDuration
  ]);

  const pause = useCallback(() => {
    if (status !== "recording") {
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      elapsedBeforePauseRef.current = computeDuration();
      activeStartRef.current = null;
      setStatus("paused");
      return;
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      elapsedBeforePauseRef.current = computeDuration();
      activeStartRef.current = null;
      setStatus("paused");
    }
  }, [computeDuration, status]);

  const resume = useCallback(() => {
    if (status !== "paused") {
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      activeStartRef.current = performance.now();
      setStatus("recording");
      return;
    }
    if (processorNodeRef.current && sourceNodeRef.current && gainNodeRef.current) {
      sourceNodeRef.current.connect(processorNodeRef.current);
      processorNodeRef.current.connect(gainNodeRef.current);
      activeStartRef.current = performance.now();
      setStatus("recording");
    }
  }, [status]);

  const reset = useCallback(async () => {
    await cleanupRecorder();
    resetDuration();
    setRecording(null);
    setError(null);
    setStatus("idle");
  }, [cleanupRecorder, resetDuration]);

  useEffect(() => {
    if (!isBrowser) return;

    let raf: number;
    const tick = () => {
      setDurationMs(computeDuration());
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [computeDuration]);

  useEffect(() => {
    return () => {
      void cleanupRecorder();
    };
  }, [cleanupRecorder]);

  const isBrowserSupported =
    isBrowser &&
    (supports.webm || supports.mp3 || supports.wav || typeof AudioContext !== "undefined");

  return {
    start,
    stop,
    pause,
    resume,
    reset,
    status,
    supports,
    recording,
    error,
    durationMs,
    bytes,
    stream,
    isBrowserSupported
  };
}

