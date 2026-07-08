function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

export function getPresetLibrary() {
  const pack = window.butterchurnPresetsMinimal;

  if (!pack?.getPresets) {
    throw new Error("Butterchurn preset pack was not loaded.");
  }

  const presets = pack.getPresets();
  const names = Object.keys(presets);

  if (names.length === 0) {
    throw new Error("No Butterchurn presets were found.");
  }

  return { presets, names };
}

export class PresetManager {
  constructor({ presets, names }, config) {
    this.presets = presets;
    this.names = names;
    this.config = config;
    this.currentPresetName = null;
    this.availableNames = [];
    this.nextSwitchAt = 0;
    this.visualizer = null;
  }

  bindVisualizer(visualizer) {
    this.visualizer = visualizer;
  }

  refillPresetPool() {
    const nextPool = this.names.filter((name) => name !== this.currentPresetName);
    this.availableNames = shuffle(nextPool);
  }

  getNextPresetName() {
    if (this.availableNames.length === 0) {
      this.refillPresetPool();
    }

    return this.availableNames.pop() ?? this.names[0];
  }

  loadPreset(name, blendSeconds = this.config.blendSeconds) {
    if (!this.visualizer) {
      throw new Error("Cannot load a preset before the visualizer is ready.");
    }

    this.visualizer.loadPreset(this.presets[name], blendSeconds);
    this.currentPresetName = name;
    console.info(`[PaperFX] Loaded preset: ${name}`);
  }

  initialize(now = performance.now()) {
    const initialPreset = this.getNextPresetName();
    this.loadPreset(initialPreset, 0);
    this.scheduleNextSwitch(now);
  }

  reloadCurrentPreset() {
    if (this.currentPresetName) {
      this.loadPreset(this.currentPresetName, 0);
    }
  }

  scheduleNextSwitch(now) {
    const spread = this.config.maxSwitchIntervalMs - this.config.minSwitchIntervalMs;
    this.nextSwitchAt = now + this.config.minSwitchIntervalMs + (Math.random() * spread);
  }

  update(now) {
    if (!this.visualizer || now < this.nextSwitchAt) {
      return;
    }

    const nextPreset = this.getNextPresetName();
    this.loadPreset(nextPreset);
    this.scheduleNextSwitch(now);
  }
}
