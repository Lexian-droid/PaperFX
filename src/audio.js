const TWO_PI = Math.PI * 2;

// Number of frequency bins used for IDFT waveform synthesis.
// Covers the bass and mid frequency range that dominates waveform shape.
const WAVEFORM_BINS = 64;

// Bins below this amplitude are skipped in the IDFT to avoid spending CPU on
// inaudible content. Spectrum values are in [0, 1] (normalized WE output).
const MIN_AUDIBLE_AMPLITUDE = 0.001;

// Floor applied to the IDFT output peak before computing the normalization
// gain, preventing runaway amplification during near-silent passages.
const MIN_PEAK_THRESHOLD = 0.01;

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
    // Phase accumulators for continuous IDFT waveform synthesis.
    // Seeded randomly so consecutive instances start at different points.
    this.synthPhases = new Float32Array(config.frequencyBins);
    for (let k = 0; k < config.frequencyBins; k += 1) {
      this.synthPhases[k] = Math.random() * TWO_PI;
    }
    // Pre-allocated temporary buffer for the float waveform before clamping.
    this.tempWave = new Float32Array(config.frequencyBins);
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

    const N = this.smoothedSpectrum.length;
    const bins = Math.min(WAVEFORM_BINS, N);

    // Build frequency arrays from the smoothed spectrum.
    for (let i = 0; i < N; i += 1) {
      const freq = this.smoothedSpectrum[i] * this.config.frequencyGain;
      this.frequencyData[i] = freq;
      this.frequencyDataLeft[i] = freq;
      this.frequencyDataRight[i] = freq;
    }

    // Synthesize time-domain waveform via inverse DFT.
    // Each frequency bin k contributes a sinusoid at (k/N) cycles per window.
    // Phase accumulators advance continuously so the waveform evolves smoothly
    // across frames rather than restarting at a fixed phase each call.
    // k=0 (DC component) is intentionally skipped to prevent a DC offset in
    // the waveform output.
    // smoothedSpectrum values are in [0, 1] (normalized from Wallpaper Engine),
    // so the 0.001 threshold safely drops inaudible bins without skipping
    // meaningful content.
    this.tempWave.fill(0);
    for (let k = 1; k < bins; k += 1) {
      const amp = this.smoothedSpectrum[k];
      if (amp < MIN_AUDIBLE_AMPLITUDE) continue;
      const phaseInc = (TWO_PI * k) / N;
      let phi = this.synthPhases[k];
      for (let n = 0; n < N; n += 1) {
        this.tempWave[n] += amp * Math.cos(phi);
        phi += phaseInc;
      }
      // phi started positive and was only incremented, so it is always >= 0.
      // A plain modulo is therefore equivalent to the signed-safe form here.
      this.synthPhases[k] = phi % TWO_PI;
    }

    // Normalize the synthesized waveform so it fills the display at any
    // volume level. A small minimum peak prevents runaway gain during near-
    // silent passages while still producing a proportionally quiet waveform.
    let peak = 0;
    for (let n = 0; n < N; n += 1) {
      const abs = Math.abs(this.tempWave[n]);
      if (abs > peak) peak = abs;
    }
    const gain = this.config.waveformGain / Math.max(peak, MIN_PEAK_THRESHOLD);
    for (let n = 0; n < N; n += 1) {
      const v = clampInt8(this.tempWave[n] * gain);
      this.waveformLeft[n] = v;
      this.waveformRight[n] = v;
    }

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
