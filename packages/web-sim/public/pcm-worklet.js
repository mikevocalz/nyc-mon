// Mic to 16-bit PCM for /api/asr (src/client/liveMic.ts). Runs in the audio
// thread of an AudioContext created at 16 kHz, so no resampling here: it
// converts float samples to s16 and posts one 100 ms chunk at a time.
const CHUNK = 1600;

class Pcm16 extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Int16Array(CHUNK);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]));
        this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.n === CHUNK) {
          this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
          this.buf = new Int16Array(CHUNK);
          this.n = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm16', Pcm16);
