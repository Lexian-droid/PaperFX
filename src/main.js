import { ButterchurnAudioBridge, createDemoAudioSource } from "./audio.js";
import { CONFIG } from "./config.js";
import { getPresetLibrary, PresetManager } from "./presets.js";
import { WallpaperRenderer } from "./renderer.js";
import { registerWallpaperEngineAudioListener } from "./wallpaper-engine.js";

function main() {
  const canvas = document.getElementById("visualizer");

  if (!canvas) {
    throw new Error("Visualizer canvas element is missing.");
  }

  const audioBridge = new ButterchurnAudioBridge(CONFIG.audio);
  const audioRegistration =
    registerWallpaperEngineAudioListener((audioArray) => audioBridge.update(audioArray)) ??
    createDemoAudioSource((audioArray) => audioBridge.update(audioArray), CONFIG.demoAudio);
  const presetManager = new PresetManager(getPresetLibrary(), CONFIG.presets);
  const renderer = new WallpaperRenderer({
    canvas,
    audioBridge,
    presetManager,
    visualizerConfig: CONFIG.visualizer
  });

  renderer.initialize();

  window.addEventListener(
    "beforeunload",
    () => {
      audioRegistration?.dispose?.();
      renderer.dispose();
    },
    { once: true }
  );
}

try {
  main();
} catch (error) {
  console.error("[PaperFX] Failed to start wallpaper:", error);
}
