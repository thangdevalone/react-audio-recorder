class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0]; // mono channel
      // Send PCM float32 data to main thread
      this.port.postMessage(channelData);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);

