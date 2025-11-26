import type { PCMFrame } from "./pcm";

type LameModule = typeof import("lamejs");

let lameModulePromise: Promise<LameModule> | null = null;

async function loadLameModule(): Promise<LameModule> {
  if (!lameModulePromise) {
    lameModulePromise = import("lamejs").then((mod) => mod as LameModule);
  }
  return lameModulePromise;
}

function float32ToInt16(buffer: Float32Array): Int16Array {
  const output = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, buffer[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

export interface EncodeMp3Options {
  bitrateKbps?: number;
}

function toBlobPart(view: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(view.byteLength);
  const copy = new Uint8Array(buffer);
  copy.set(view);
  return buffer;
}

export async function encodeMp3(
  frames: PCMFrame[],
  sampleRate: number,
  channelCount: number,
  options: EncodeMp3Options = {}
): Promise<Blob> {
  if (!frames.length) {
    throw new Error("Cannot encode MP3 without PCM frames.");
  }

  if (channelCount < 1 || channelCount > 2) {
    throw new Error("MP3 fallback currently supports mono or stereo sources.");
  }

  const bitrate = options.bitrateKbps ?? 128;
  const { Mp3Encoder } = await loadLameModule();
  const encoder = new Mp3Encoder(channelCount, sampleRate, bitrate);
  const mp3Chunks: BlobPart[] = [];

  frames.forEach((frame) => {
    const left = float32ToInt16(frame[0]);
    if (channelCount === 2) {
      const right = float32ToInt16(frame[1] ?? frame[0]);
      const chunk = encoder.encodeBuffer(left, right);
      if (chunk.length) {
        mp3Chunks.push(toBlobPart(chunk));
      }
      return;
    }
    const chunk = encoder.encodeBuffer(left);
    if (chunk.length) {
      mp3Chunks.push(toBlobPart(chunk));
    }
  });

  const flushChunk = encoder.flush();
  if (flushChunk.length) {
    mp3Chunks.push(toBlobPart(flushChunk));
  }

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

