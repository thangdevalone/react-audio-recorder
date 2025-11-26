export type PCMFrame = Float32Array[];

export function mergePCMFrames(frames: PCMFrame[], channelCount: number): Float32Array[] {
  if (!frames.length) {
    return Array.from({ length: channelCount }, () => new Float32Array(0));
  }

  const frameLength = frames.reduce((total, frame) => total + (frame[0]?.length ?? 0), 0);
  const merged = Array.from({ length: channelCount }, () => new Float32Array(frameLength));

  let offset = 0;
  frames.forEach((frame) => {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const input = frame[channel] ?? new Float32Array(frame[0]?.length ?? 0);
      merged[channel].set(input, offset);
    }
    offset += frame[0]?.length ?? 0;
  });

  return merged;
}

export function floatTo16BitPCM(buffer: Float32Array, view: DataView, offset: number) {
  for (let i = 0; i < buffer.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
}

function writeWavHeader(view: DataView, sampleRate: number, channelCount: number, bytesLength: number) {
  const blockAlign = channelCount * 2;
  const byteRate = sampleRate * blockAlign;

  let offset = 0;

  // RIFF identifier
  view.setUint32(offset, 0x46464952, false);
  offset += 4;
  // RIFF chunk length
  view.setUint32(offset, 36 + bytesLength, true);
  offset += 4;
  // WAVE identifier
  view.setUint32(offset, 0x45564157, false);
  offset += 4;
  // fmt chunk identifier
  view.setUint32(offset, 0x20746d66, false);
  offset += 4;
  // fmt chunk length
  view.setUint32(offset, 16, true);
  offset += 4;
  // sample format (raw)
  view.setUint16(offset, 1, true);
  offset += 2;
  // channel count
  view.setUint16(offset, channelCount, true);
  offset += 2;
  // sample rate
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  // byte rate (sample rate * block align)
  view.setUint32(offset, byteRate, true);
  offset += 4;
  // block align (channel count * bytes per sample)
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  // bits per sample
  view.setUint16(offset, 16, true);
  offset += 2;
  // data chunk identifier
  view.setUint32(offset, 0x61746164, false);
  offset += 4;
  // data chunk length
  view.setUint32(offset, bytesLength, true);
}

export function encodeWav(frames: PCMFrame[], sampleRate: number, channelCount: number): Blob {
  const merged = mergePCMFrames(frames, channelCount);
  const bytesLength = merged[0]?.length * 2 * channelCount;
  const buffer = new ArrayBuffer(44 + bytesLength);
  const view = new DataView(buffer);

  writeWavHeader(view, sampleRate, channelCount, bytesLength);

  let offset = 44;
  for (let i = 0; i < merged[0].length; i += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = merged[channel][i];
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

