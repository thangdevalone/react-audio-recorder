# react-ts-audio-recorder

🎙️ Framework-agnostic multi-format audio recorder with MP3 and WAV support. Built on top of [Kagami/vmsg](https://github.com/Kagami/vmsg) for MP3 encoding, with custom PCM→WAV encoder.

## ✨ Features

- 🎯 **Multi-format support**: MP3 (vmsg WASM), WAV (PCM→WAV)
- 📦 **Zero dependencies**: No runtime deps, just Web Audio API
- 🚀 **Modern APIs**: Uses AudioWorklet (not deprecated ScriptProcessorNode)
- 🎛️ **Pitch shift**: Built-in pitch adjustment for MP3 format
- 🌐 **Browser support**: Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- 📱 **TypeScript**: Full TypeScript support with type definitions
- ⚡ **Lightweight**: MP3 encoder ~73 KB gzipped, WAV no WASM needed

## 📦 Install

```bash
npm install react-ts-audio-recorder
```

## 🚀 Quick Start

### Basic Usage with MultiRecorder

```typescript
import { MultiRecorder } from "react-ts-audio-recorder";
import vmsgWasm from "react-ts-audio-recorder/assets/vmsg.wasm?url";

const recorder = new MultiRecorder({
  format: "mp3", // "mp3" | "wav"
  sampleRate: 48000,
  wasmURL: vmsgWasm, // Only needed for MP3
});

await recorder.init();
await recorder.startRecording();
// ... recording ...
const blob = await recorder.stopRecording();
recorder.close();
```

### React Example

```tsx
import { useState, useRef } from "react";
import { MultiRecorder, type AudioFormat } from "react-ts-audio-recorder";
import vmsgWasm from "react-ts-audio-recorder/assets/vmsg.wasm?url";

function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MultiRecorder | null>(null);

  const startRecording = async () => {
    const recorder = new MultiRecorder({
      format: "wav", // or "mp3"
      sampleRate: 48000,
      wasmURL: vmsgWasm,
    });
    
    recorderRef.current = recorder;
    await recorder.init();
    await recorder.startRecording();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;
    
    const blob = await recorderRef.current.stopRecording();
    recorderRef.current.close();
    recorderRef.current = null;
    setIsRecording(false);
    
    // Use the blob (e.g., create audio URL)
    const url = URL.createObjectURL(blob);
    console.log("Recorded audio:", url);
  };

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? "Stop" : "Start"} Recording
      </button>
    </div>
  );
}
```

## 📚 API Reference

### `MultiRecorder`

Main class for recording audio in multiple formats.

#### Constructor

```typescript
new MultiRecorder(options: MultiRecorderOptions)
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `"mp3" \| "wav"` | **Required** | Output audio format |
| `sampleRate` | `number` | `48000` | Sample rate in Hz |
| `wasmURL` | `string` | `"/vmsg.wasm"` | URL to vmsg.wasm (MP3 only) |
| `shimURL` | `string` | `undefined` | WebAssembly polyfill URL (MP3 only) |
| `pitch` | `number` | `0` | Pitch shift [-1, 1] (MP3 only) |
| `workletURL` | `string` | `"/pcm-worklet.js"` | PCM worklet URL (WAV only) |

#### Methods

##### `init(): Promise<void>`

Initialize the recorder. Must be called before `startRecording()`.

```typescript
await recorder.init();
```

##### `startRecording(): Promise<void>`

Start recording audio from the microphone.

```typescript
await recorder.startRecording();
```

##### `stopRecording(): Promise<Blob>`

Stop recording and return the audio blob.

```typescript
const blob = await recorder.stopRecording();
// blob.type will be:
// - "audio/mpeg" for MP3
// - "audio/wav" for WAV
```

##### `close(): void`

Clean up resources. Always call this when done.

```typescript
recorder.close();
```

### Format Comparison

| Format | Encoder | WASM Required | File Size | Quality | Browser Support |
|--------|---------|---------------|-----------|---------|-----------------|
| **MP3** | vmsg (LAME) | ✅ Yes | Small | Good | All modern browsers |
| **WAV** | Custom PCM→WAV | ❌ No | Large | Lossless | All modern browsers |
| **OGG/Opus** | MediaRecorder API | ❌ No | Small | Excellent | Chrome, Firefox, Edge |

### Legacy API: `Recorder` and `record()`

The original `Recorder` class and `record()` helper are still available for MP3-only use cases:

```typescript
import { Recorder, record } from "react-ts-audio-recorder";

// High-level helper with UI
const blob = await record({
  wasmURL: "/vmsg.wasm",
  pitch: 0
});

// Low-level control
const recorder = new Recorder({ wasmURL: "/vmsg.wasm" });
await recorder.init();
recorder.startRecording();
const blob = await recorder.stopRecording();
recorder.close();
```

## 📁 Assets

### Importing Assets with Vite

```typescript
// Import WASM file
import vmsgWasm from "react-ts-audio-recorder/assets/vmsg.wasm?url";

// Import PCM worklet
import pcmWorklet from "react-ts-audio-recorder/assets/pcm-worklet.js?url";

const recorder = new MultiRecorder({
  format: "wav",
  wasmURL: vmsgWasm,
  workletURL: pcmWorklet,
});
```

### Using Constants

```typescript
import { DEFAULT_VMSG_WASM_URL, PCM_WORKLET_URL, loadPCMWorklet } from "react-ts-audio-recorder";

// Use default URLs
const recorder = new MultiRecorder({
  format: "mp3",
  wasmURL: DEFAULT_VMSG_WASM_URL,
});

// Load worklet manually
const audioContext = new AudioContext();
await loadPCMWorklet(audioContext, PCM_WORKLET_URL);
```

### Static Assets

If not using a bundler, copy assets to your public directory:

```
public/
  vmsg.wasm
  pcm-worklet.js
```

Then reference them:

```typescript
const recorder = new MultiRecorder({
  format: "mp3",
  wasmURL: "/vmsg.wasm",
  workletURL: "/pcm-worklet.js",
});
```

## 🎨 Examples

### Example: Format Selector

See the full React example in `example/vite-demo/`:

```bash
cd example/vite-demo
npm install
npm run dev
```

The demo includes:
- Format selector (MP3/WAV)
- Real-time recording timer
- Audio preview and download
- Error handling

## 🔧 Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck
```

## 📝 Notes

### Browser Compatibility

- **MP3**: Requires WebAssembly support (all modern browsers)
- **WAV**: Works everywhere (no WASM needed)
- **OGG/Opus**: Requires `MediaRecorder` with Opus codec support
  - ✅ Chrome/Edge: Full support
  - ✅ Firefox: Full support
  - ⚠️ Safari: Limited support (use MP3 or WAV instead)

### Performance

- **MP3**: Best compression, universal support, requires WASM
- **WAV**: No compression, largest files, fastest encoding, no WASM needed

### AudioWorklet vs ScriptProcessorNode

This library uses `AudioWorklet` (modern API) instead of deprecated `ScriptProcessorNode` for better performance and future compatibility.

## 📄 License

MIT © 2025 ThangDevAlone

The MP3 encoder and CSS originate from [Kagami/vmsg](https://github.com/Kagami/vmsg) (CC0). Please keep attribution when redistributing.

## 🙏 Credits

- [Kagami/vmsg](https://github.com/Kagami/vmsg) - Original MP3 encoder implementation
- Web Audio API - Modern audio processing
