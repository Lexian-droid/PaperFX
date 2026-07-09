export function registerWallpaperEngineAudioListener(onAudioFrame) {
  if (typeof window.wallpaperRegisterAudioListener !== "function") {
    console.warn("[PaperFX] Wallpaper Engine audio API not detected.");
    return null;
  }

  window.wallpaperRegisterAudioListener((audioArray) => {
    if (!audioArray || typeof audioArray.length !== "number") {
      console.warn("[PaperFX] Ignored invalid audio payload from Wallpaper Engine.");
      return;
    }

    onAudioFrame(audioArray);
  });

  console.info("[PaperFX] Listening for Wallpaper Engine desktop audio.");
  return {
    source: "wallpaper-engine",
    dispose() {}
  };
}
