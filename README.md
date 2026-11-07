# Nia AI Companion

Android companion app with chat, user-approved memory notes, a skeletal 3D avatar, opt-in photo interpretation, and recorded speech transcription to a reviewable draft.

## Validate

```
npm ci
npm test
npm run typecheck
npx expo install --check
python3 scripts/verify_nia_rig.py assets/nia-character-animated.glb
CI=1 npx expo export --platform android
```

The Android workflows run checks before generating a standalone test APK with embedded JavaScript and avatar assets. A successful bundle or structural rig check is not proof of a device-tested app. The currently bundled GLB is explicitly a **segmented prototype**, not the approved photorealistic Nia likeness. Full-body procedural motion is in development and must be validated on Android hardware.

## Connection

Use a separately deployed Nia gateway base URL and client token, or configure a trusted OpenAI-compatible endpoint. Tokens are kept in device secure storage. Conversation history and user-approved memory notes use chunked SecureStore storage. Legacy plaintext notes migrate only after encrypted storage succeeds. Direct Groq-compatible voice transcription requires a configured account and network access. Recorded voice works with the direct connection or the authenticated gateway transcription endpoint. Review the resulting draft before sending chat.

## Automated Android emulator smoke test

The `Build Android Standalone Test APK` workflow now installs the resulting APK on a Google APIs Android 35 emulator. Its second job asserts that the launched application shows real GLB rig diagnostics (25 bones), survives Android background/resume, and retains the loaded character. It uploads screenshots, UI hierarchies, and logcat output for debugging. **Passing this test does not establish correct resemblance, device hardware performance, speech timing, or successful voice/camera permissions.**

## Remaining release blockers

A native floating WebGL window is implemented as an internal candidate; its aligned speech/viseme bridge now follows the main app audio clock, while live audiovisual and physical-device validation remain required. Background speech continuation is not implemented. Full duplex calls, an unattended telephone agent, an offline language model, and measured phoneme-aligned speech playback are not verified. Camera, microphone, notification delivery, GL rendering, and installation need Android hardware testing. The generated release variant uses the Expo debug signing key for internal testing. Do not treat this as production signing or a completed production release.

## Production release control

The existing GLB in `assets/nia-appearance-facial-rig-v2.glb` identifies itself
as a **facial-rig prototype** and has no embedded texture images. It is appropriate
only for testing the renderer. Do not call it an approved realistic likeness.

The separate, manually triggered `Nia Production Readiness` workflow now
requires a distinct `assets/nia-production-approved.glb`, an approval manifest
(`docs/nia-production-approval.json` with the SHA-256, likeness review, and
physical Android visual-test flags), as well as verified audio/overlay behavior.
It currently **fails closed**: the production asset and end-to-end verification
are not present. Internal test APK builds remain permitted.

Replacing the character correctly requires a textured, connected humanoid
mesh with actual skinning weights and face morph targets, reviewed against
Nia's existing visual reference. An image or a structurally valid 25-bone
mannequin cannot substitute for that requirement.
