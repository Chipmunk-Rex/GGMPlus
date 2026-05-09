# Project Instructions

## Source Layout

- `src/` is the only shared extension source directory. Edit HTML, CSS, JavaScript, assets, and icons here.
- `manifests/` contains browser-specific manifest files only.
  - `manifests/chrome.json` is copied to `dist/chrome/manifest.json`.
  - `manifests/firefox.json` is copied to `dist/firefox/manifest.json`.
- `dist/` is generated output. Do not edit files in `dist/` by hand.

## Browser Changes

- Keep browser-specific code out of feature files when possible.
- Prefer small compatibility helpers inside `src/` over duplicating entire files per browser.
- If a browser really needs different source code, add the smallest browser-specific file or build step needed and document it here.
- When adding a new browser target:
  1. Add `manifests/<browser>.json`.
  2. Verify it with `build-target.bat <browser>`.
  3. Add `build-<browser>.bat` only if the target needs a convenience wrapper.
  4. Update `build.bat` if the new browser should be part of the default full build.
  5. Update README.md with install and build instructions.
  6. Keep generated output ignored by Git.

## Ownership

- Chrome development should normally touch `src/`, `manifests/chrome.json`, and Chrome build docs/scripts.
- Firefox-specific changes should normally touch `manifests/firefox.json` and Firefox build docs/scripts.
- Do not modify another browser target just because shared source changed, unless the requested task is explicitly cross-browser.
