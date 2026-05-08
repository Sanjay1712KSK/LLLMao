export class PCMStreamPlayer {
  private audioContext: AudioContext;
  private nextTime: number;
  private isPlaying: boolean = false;
  private sampleRate: number;

  constructor(sampleRate: number = 22050) {
    this.audioContext = new AudioContext({ sampleRate });
    this.nextTime = 0;
    this.sampleRate = sampleRate;
  }

  public async playChunk(base64Pcm: string) {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.isPlaying = true;

    // Decode base64 to Int16Array
    const binaryStr = window.atob(base64Pcm);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);

    // Convert Int16 to Float32 [-1, 1] for AudioContext
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Create AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    // Schedule playback
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    // ensure gapless playback by maintaining nextTime
    if (this.nextTime < currentTime) {
      this.nextTime = currentTime;
    }

    source.start(this.nextTime);
    this.nextTime += audioBuffer.duration;
  }

  public stop() {
    this.isPlaying = false;
    this.audioContext.close();
    this.nextTime = 0;
  }
}
