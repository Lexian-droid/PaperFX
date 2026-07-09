const TWO_PI = Math.PI * 2;

function clampInt8(value) {
  return Math.max(-128, Math.min(127, Math.round(value)));
}

function resampleSpectrum(input, output) {
  if (!input?.length) {
    output.fill(0);
    return;
  }

  const inputLength = input.length;
  const outputLength = output.length;

  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor((i * inputLength) / outputLength);
    const end = Math.max(start + 1, Math.floor(((i + 1) * inputLength) / outputLength));
    let sum = 0;

    for (let j = start; j < end; j += 1) {
      sum += input[j];
    }

    output[i] = sum / (end - start);
  }
}

export class ButterchurnAudioBridge {
  constructor(config) {
    this.config = config;
    this.resampledSpectrum = new Float32Array(config.frequencyBins);
    this.smoothedSpectrum = new Float32Array(config.frequencyBins);
    this.frequencyData = new Float32Array(config.frequencyBins);
    this.frequencyDataLeft = new Float32Array(config.frequencyBins);
    this.frequencyDataRight = new Float32Array(config.frequencyBins);
    this.waveformLeft = new Int8Array(config.frequencyBins);
    this.waveformRight = new Int8Array(config.frequencyBins);
    this.phase = 0;
    this.lastUpdateTime = 0;
  }

  update(audioArray) {
    resampleSpectrum(audioArray, this.resampledSpectrum);

    for (let i = 0; i < this.smoothedSpectrum.length; i += 1) {
      const nextValue = Math.max(0, this.resampledSpectrum[i]);
      this.smoothedSpectrum[i] =
        (this.smoothedSpectrum[i] * this.config.smoothing) +
        (nextValue * (1 - this.config.smoothing));
    }

    this.lastUpdateTime = performance.now();
  }

  decayIfIdle(now) {
    if (now - this.lastUpdateTime < this.config.idleThresholdMs) {
      return;
    }

    for (let i = 0; i < this.smoothedSpectrum.length; i += 1) {
      this.smoothedSpectrum[i] *= this.config.idleDecayPerFrame;
    }
  }

  writeTo(audioProcessor, now = performance.now()) {
    this.decayIfIdle(now);

    let energy = 0;
    const lastIndex = this.smoothedSpectrum.length - 1;

    for (let i = 0; i < this.smoothedSpectrum.length; i += 1) {
      const amplitude = this.smoothedSpectrum[i];
      const previous = this.smoothedSpectrum[i === 0 ? 0 : i - 1];
      const next = this.smoothedSpectrum[i === lastIndex ? lastIndex : i + 1];
      const harmonic =
        Math.sin(((i / this.smoothedSpectrum.length) * this.config.waveformCycles * TWO_PI) + this.phase) *
        amplitude;
      const derivative = (next - previous) * 0.5;
      const waveformValue =
        (harmonic * this.config.waveformGain) +
        (derivative * this.config.waveformGain * 1.6);
      const frequencyValue = amplitude * this.config.frequencyGain;

      this.frequencyData[i] = frequencyValue;
      this.frequencyDataLeft[i] = frequencyValue;
      this.frequencyDataRight[i] = frequencyValue;
      this.waveformLeft[i] = clampInt8(waveformValue);
      this.waveformRight[i] = clampInt8((waveformValue * 0.8) - (harmonic * this.config.waveformGain * 0.15));
      energy += amplitude;
    }

    this.phase += 0.03 + (energy / this.smoothedSpectrum.length) * 0.35;

    audioProcessor.freqArray = this.frequencyData;
    audioProcessor.freqArrayL = this.frequencyDataLeft;
    audioProcessor.freqArrayR = this.frequencyDataRight;
    audioProcessor.timeArrayL = this.waveformLeft;
    audioProcessor.timeArrayR = this.waveformRight;
  }
}

export function createDemoAudioSource(onAudioFrame, config) {
  if (!config.enabled) {
    return null;
  }

  let frameId = 0;
  let animationFrame = 0;
  const spectrum = new Float32Array(config.bins);

  const tick = () => {
    for (let i = 0; i < spectrum.length; i += 1) {
      const band = i / spectrum.length;
      const sweep = Math.sin(frameId * 0.025 + band * 18);
      const pulse = Math.sin(frameId * 0.045 - band * 7);
      const bass = Math.exp(-band * 5) * (0.35 + 0.65 * ((Math.sin(frameId * 0.035) + 1) * 0.5));
      spectrum[i] = Math.max(0, Math.min(1, (sweep * 0.2) + (pulse * 0.15) + bass));
    }

    onAudioFrame(spectrum);
    frameId += 1;
    animationFrame = window.requestAnimationFrame(tick);
  };

  console.info("[PaperFX] Starting demo audio source for local preview.");
  animationFrame = window.requestAnimationFrame(tick);

  return {
    source: "demo",
    dispose() {
      window.cancelAnimationFrame(animationFrame);
    }
  };
}
