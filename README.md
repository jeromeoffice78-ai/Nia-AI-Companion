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

The Android workflows run checks before generating a standalone test APK with embedded JavaScript and avatar assets. A successful bundle or structural rig check is not proof of a device-tested app.

## Connection

Use a separately deployed Nia gateway base URL and client token, or configure a trusted OpenAI-compatible endpoint. Tokens are kept in device secure storage. Conversation history and approved notes use device storage; they are not application-level encrypted. Direct Groq-compatible voice transcription requires a configured account and network access. Voice drafts are sent only after recording; review the text before sending chat.

## Remaining release blockers

No verified native floating 3D window, full duplex calls, unattended telephone agent, offline language model, or measured phoneme-aligned speech playback is included. Camera, microphone, notification delivery, GL rendering, and installation need Android hardware testing. The generated release variant uses the Expo debug signing key for internal testing. Do not treat this as production signing or a completed production release.
