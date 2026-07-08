export const CONFIG = Object.freeze({
  visualizer: Object.freeze({
    meshWidth: 40,
    meshHeight: 30,
    pixelRatio: 1,
    textureRatio: 1,
    outputFXAA: false
  }),
  presets: Object.freeze({
    blendSeconds: 6,
    minSwitchIntervalMs: 30_000,
    maxSwitchIntervalMs: 60_000
  }),
  audio: Object.freeze({
    frequencyBins: 512,
    smoothing: 0.68,
    frequencyGain: 256,
    waveformGain: 104,
    waveformCycles: 6,
    idleDecayPerFrame: 0.94,
    idleThresholdMs: 250
  }),
  demoAudio: Object.freeze({
    enabled: true,
    bins: 128
  })
});
