# PaperFX

Fullscreen Wallpaper Engine HTML wallpaper powered by Butterchurn.

## Project layout

- `index.html` - wallpaper entrypoint
- `project.json` - Wallpaper Engine manifest
- `style.css` - fullscreen canvas styling
- `src/` - modular wallpaper source code
- `vendor/` - vendored browser bundles from `butterchurn` and `butterchurn-presets`

## Notes

- Uses Wallpaper Engine's `wallpaperRegisterAudioListener` API for desktop audio input.
- Falls back to synthetic demo audio when opened in a normal browser for local preview.
- Presets are sourced from `butterchurn-presets` and crossfaded automatically every 30-60 seconds.
