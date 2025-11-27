import { PCM_WORKLET_URL } from "./assets";
import { Recorder } from "./vmsg";

export type AudioFormat = "mp3" | "wav";

export interface MultiRecorderOptions {
  format: AudioFormat;
  sampleRate?: number;
  wasmURL?: string;
  shimURL?: string;
  pitch?: number;
  workletURL?: string;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function mergeFloat32Arrays(arrays: Float32Array[]): Float32Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, 1, true); // num channels (mono)
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true); // data size
  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: "audio/wav" });
}

export class MultiRecorder {
  private format: AudioFormat;
  private sampleRate: number;
  private wasmURL?: string;
  private shimURL?: string;
  private pitch?: number;

  // MP3 recorder (vmsg)
  private mp3Recorder: Recorder | null = null;

  // WAV recorder
  private wavStream: MediaStream | null = null;
  private wavAudioCtx: AudioContext | null = null;
  private wavProcessor: AudioWorkletNode | null = null;
  private wavPcmData: Float32Array[] = [];
  private workletURL?: string;

  constructor(options: MultiRecorderOptions) {
    this.format = options.format;
    this.sampleRate = options.sampleRate || 48000;
    this.wasmURL = options.wasmURL;
    this.shimURL = options.shimURL;
    this.pitch = options.pitch || 0;
    this.workletURL = options.workletURL;
  }

  async init(): Promise<void> {
    if (this.format === "mp3") {
      this.mp3Recorder = new Recorder({
        wasmURL: this.wasmURL || "/static/js/vmsg.wasm",
        shimURL: this.shimURL,
        pitch: this.pitch,
      });
      // MP3 recorder needs initAudio() and initWorker() which are called in init()
      await this.mp3Recorder.init();
    } else if (this.format === "wav") {
      // WAV needs worklet to be loaded
      this.wavPcmData = [];
      // Worklet will be loaded when AudioContext is created in startRecording
    }
  }

  async startRecording(): Promise<void> {
    if (this.format === "mp3") {
      if (!this.mp3Recorder) {
        throw new Error("MP3 recorder not initialized. Call init() first.");
      }
      // MP3 recorder already has the stream from initAudio() in init()
      this.mp3Recorder.startRecording();
    } else if (this.format === "wav") {
      // WAV needs to get the stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.wavStream = stream;
      const audioCtx = new AudioContext({ sampleRate: this.sampleRate });
      this.wavAudioCtx = audioCtx;

      // Load worklet module
      const workletUrl = this.workletURL || PCM_WORKLET_URL;
      await audioCtx.audioWorklet.addModule(workletUrl);

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(audioCtx, "pcm-processor");

      // Listen to messages from worklet
      processor.port.onmessage = (e) => {
        const channelData = e.data as Float32Array;
        if (channelData && channelData.length > 0) {
          this.wavPcmData.push(new Float32Array(channelData));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      this.wavProcessor = processor;
    }
  }

  async stopRecording(): Promise<Blob> {
    if (this.format === "mp3") {
      if (!this.mp3Recorder) {
        throw new Error("MP3 recorder not initialized.");
      }
      const blob = (await this.mp3Recorder.stopRecording()) as Blob;
      this.mp3Recorder.close();
      this.mp3Recorder = null;
      return blob;
    } else if (this.format === "wav") {
      if (!this.wavProcessor || !this.wavAudioCtx || !this.wavStream) {
        throw new Error("WAV recorder not initialized.");
      }

      // Stop processing first
      if (this.wavProcessor) {
        this.wavProcessor.disconnect();
      }

      // Stop tracks
      if (this.wavStream && this.wavStream.getTracks) {
        this.wavStream.getTracks().forEach((track) => track.stop());
      }

      // Encode WAV from collected data
      const mergedSamples = mergeFloat32Arrays(this.wavPcmData);
      const blob = encodeWav(mergedSamples, this.sampleRate);

      // Clear data but keep references for close() to handle cleanup
      this.wavPcmData = [];

      return blob;
    }

    throw new Error(`Unknown format: ${this.format}`);
  }

  close(): void {
    if (this.format === "mp3" && this.mp3Recorder) {
      this.mp3Recorder.close();
      this.mp3Recorder = null;
    } else if (this.format === "wav") {
      // Disconnect processor first
      if (this.wavProcessor) {
        try {
          this.wavProcessor.port.close();
          this.wavProcessor.disconnect();
        } catch (e) {
          // Ignore errors if already disconnected
        }
        this.wavProcessor = null;
      }

      // Stop tracks
      if (this.wavStream && this.wavStream.getTracks) {
        this.wavStream.getTracks().forEach((track) => track.stop());
        this.wavStream = null;
      }

      // Close AudioContext last, check state first
      if (this.wavAudioCtx && this.wavAudioCtx.state !== "closed") {
        this.wavAudioCtx.close().catch(() => {
          // Ignore errors when closing
        });
      }
      this.wavAudioCtx = null;

      // Clear data
      this.wavPcmData = [];
    }
  }
}
