/**
 * Get the URL for the vmsg.wasm file
 * This can be used with Vite's ?url import or as a fallback path
 */
export const VMSG_WASM_URL = "/vmsg.wasm";

/**
 * Get the URL for the PCM worklet file
 * This can be used with Vite's ?url import or as a fallback path
 * 
 * Usage with Vite:
 * ```ts
 * import pcmWorklet from "react-ts-audio-recorder/assets/pcm-worklet.js?url";
 * ```
 * 
 * Or use the constant:
 * ```ts
 * import { PCM_WORKLET_URL } from "react-ts-audio-recorder";
 * ```
 */
export const PCM_WORKLET_URL = "/pcm-worklet.js";

/**
 * Default WASM URL for vmsg encoder
 * Can be overridden in MultiRecorderOptions
 * 
 * Usage with Vite:
 * ```ts
 * import vmsgWasm from "react-ts-audio-recorder/assets/vmsg.wasm?url";
 * ```
 * 
 * Or use the constant:
 * ```ts
 * import { DEFAULT_VMSG_WASM_URL } from "react-ts-audio-recorder";
 * ```
 */
export const DEFAULT_VMSG_WASM_URL = VMSG_WASM_URL;

/**
 * Load PCM worklet into AudioContext
 * 
 * @param audioContext - The AudioContext to add the worklet to
 * @param workletURL - Optional worklet URL. If not provided, uses PCM_WORKLET_URL
 * @returns Promise that resolves when worklet is loaded
 * 
 * @example
 * ```ts
 * import { loadPCMWorklet } from "react-ts-audio-recorder";
 * import pcmWorklet from "react-ts-audio-recorder/assets/pcm-worklet.js?url";
 * 
 * const audioContext = new AudioContext();
 * await loadPCMWorklet(audioContext, pcmWorklet);
 * const processor = new AudioWorkletNode(audioContext, "pcm-processor");
 * ```
 */
export async function loadPCMWorklet(
  audioContext: AudioContext,
  workletURL?: string
): Promise<void> {
  const url = workletURL || PCM_WORKLET_URL;
  await audioContext.audioWorklet.addModule(url);
}

