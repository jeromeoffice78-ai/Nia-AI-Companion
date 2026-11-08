# Nia 0.1.11 internal repair candidate

Adds a real Android system overlay containing an offline Three.js/WebGL character renderer, foreground notification and close control, movement/resize controls, body animation, fixed-origin bundled resources, and native readiness reported after geometry is drawn. The service requires the user's display-over-apps permission. It renders the existing internal test character, not a production-approved likeness.

Memory notes now use byte-bounded, serialized SecureStore storage with migration from the legacy plaintext key. Gateway chat now honors the flirtation preference in companion mode, while business/research remain non-flirtatious.

## Verification required
Local unit/integration tests, TypeScript, native Expo prebuild/asset packaging and Android bundling must pass before publication. Remote APK compilation and emulator overlay checks remain separate required evidence. The new emulator test opens the overlay, checks renderer diagnostics, presses Home, verifies persistence, closes it, then returns to Nia.

## Remaining blockers
- Physical Android permission, GPU/WebView, memory, frame-rate, battery and background behavior tests.
- An approved connected, textured, likeness-matched 3D character and owner-reviewed hash. Saved private photo-texture studies remain private and not production-approved.
- Live deployed gateway/provider credentials and measured audio/viseme timing.
- Floating-window speech and viseme synchronization: current overlay renders body motion independently of the main app's speech player.
- Telephone-agent provider/audio/state integration, offline language model runtime and production signing.

The production gate is unchanged and remains closed. This is an internal candidate, not a finished production release.
