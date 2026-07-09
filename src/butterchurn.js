function getButterchurnApi() {
  return window.butterchurn?.createVisualizer ? window.butterchurn : window.butterchurn?.default;
}

function getSupportCheck() {
  return typeof window.isSupported === "function" ? window.isSupported : window.isSupported?.default;
}

export function createButterchurnVisualizer(canvas, config) {
  const isSupported = getSupportCheck();

  if (typeof isSupported === "function" && !isSupported()) {
    throw new Error("Butterchurn requires WebGL 2 support.");
  }

  const butterchurn = getButterchurnApi();

  if (!butterchurn?.createVisualizer) {
    throw new Error("Butterchurn library was not loaded.");
  }

  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);

  canvas.width = width;
  canvas.height = height;

  const visualizer = butterchurn.createVisualizer(null, canvas, {
    width,
    height,
    meshWidth: config.meshWidth,
    meshHeight: config.meshHeight,
    pixelRatio: config.pixelRatio,
    textureRatio: config.textureRatio,
    outputFXAA: config.outputFXAA
  });

  visualizer.setRendererSize(width, height, config);
  return visualizer;
}

export function attachAudioBridge(visualizer, audioBridge) {
  visualizer.audio.sampleAudio = () => {
    audioBridge.writeTo(visualizer.audio);
  };
}
