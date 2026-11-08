# Nia 0.1.10 internal repair candidate

## Implemented changes
- Gateway microphone transcription: authenticated, bounded multipart upload; fixed server-side provider/model; transcript returned as a reviewable draft. Connection settings are captured before recording; backgrounding cancels late results, and existing draft text is preserved.
- Upload deadline, byte limits, provider response stream limit, and provider timeout. No live recognition accuracy or credential validation is claimed by automated tests.
- Encrypted history uses UTF-8 byte-bounded SecureStore chunks and serialized storage operations, preventing overlapping save/delete/migration races.
- Animation timeline survives Android background/resume without resetting to zero.
- Pull-request APK builds and bounded emulator startup; UI diagnostics must belong to Nia and show a rigged character with nonzero skinned geometry.

## Validation
85 automated tests pass. Strict TypeScript passes. Android Metro/Hermes export is checked before committing this repair. Remote APK build and emulator results must be reviewed for the candidate commit separately.

## Production blockers
- Missing owner-approved textured, connected likeness-matched production GLB and approval manifest.
- Live HTTPS gateway and Groq/Azure configuration; real Android recording and measured speech/face synchronization.
- A real native floating 3D overlay; the old text-only overlay is excluded.
- A telephone agent with provider/media/call-state integration. Existing UI opens the phone dialer only.
- Offline inference runtime and device-compatible local model; current chat requires a network.
- Physical Android permissions, rendering, memory, frame rate, thermal behavior and update tests.
- Production signing and final owner approval. Internal test APKs use development signing.

The existing production gate remains blocked. Do not label this internal candidate production-ready.
