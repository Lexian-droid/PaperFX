import { attachAudioBridge, createButterchurnVisualizer } from "./butterchurn.js";

export class WallpaperRenderer {
  constructor({ canvas, audioBridge, presetManager, visualizerConfig }) {
    this.canvas = canvas;
    this.audioBridge = audioBridge;
    this.presetManager = presetManager;
    this.visualizerConfig = visualizerConfig;
    this.visualizer = null;
    this.animationFrame = 0;
    this.lastFrameTime = 0;
    this.resizeQueued = true;
    this.renderBound = this.render.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
  }

  initialize() {
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost, false);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored, false);
    window.addEventListener("resize", this.handleResize, { passive: true });
    this.rebuildVisualizer();
    this.presetManager.initialize();
    this.animationFrame = window.requestAnimationFrame(this.renderBound);
  }

  rebuildVisualizer() {
    this.visualizer = createButterchurnVisualizer(this.canvas, this.visualizerConfig);
    attachAudioBridge(this.visualizer, this.audioBridge);
    this.presetManager.bindVisualizer(this.visualizer);
    this.handleResize();
  }

  handleResize() {
    this.resizeQueued = true;
  }

  applyResize() {
    if (!this.visualizer) {
      return;
    }

    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.visualizer.setRendererSize(width, height, this.visualizerConfig);
    this.resizeQueued = false;
  }

  handleContextLost(event) {
    event.preventDefault();
    console.warn("[PaperFX] WebGL context lost. Waiting for restoration.");
    this.stopLoop();
  }

  handleContextRestored() {
    console.info("[PaperFX] WebGL context restored. Reinitializing visualizer.");
    this.rebuildVisualizer();
    this.presetManager.reloadCurrentPreset();
    this.animationFrame = window.requestAnimationFrame(this.renderBound);
  }

  render(timestamp) {
    if (!this.visualizer) {
      return;
    }

    if (this.resizeQueued) {
      this.applyResize();
    }

    this.presetManager.update(timestamp);

    try {
      const elapsedTime = this.lastFrameTime ? timestamp - this.lastFrameTime : 16.67;
      this.visualizer.render({ elapsedTime });
      this.lastFrameTime = timestamp;
    } catch (error) {
      console.error("[PaperFX] Render failure:", error);
    }

    this.animationFrame = window.requestAnimationFrame(this.renderBound);
  }

  stopLoop() {
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  dispose() {
    this.stopLoop();
    window.removeEventListener("resize", this.handleResize);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost, false);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored, false);
  }
}
