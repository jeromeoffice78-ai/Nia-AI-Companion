# Nia 0.1.12 internal candidate

## Added
- Floating renderer receives measured aligned-audio viseme frames through a validated one-way native bridge.
- Actual GLB mouth morphs and optional jaw follow those scalar frames; malformed input and silence reset them. Blink/expression controls are preserved.
- The main player closes the mouth during loading, buffering, pause and stop. Expo device speech without aligned cues does not fabricate mouth motion.
- Native speech updates cannot start an overlay or send credentials/text/audio into the WebView. Hide, destroy, unmount and background transitions reset speech state.
- Android internal builds target ARM64 phones/tablets and the x86_64 emulator; 32-bit devices are excluded from this candidate. Build caches are enabled with PR read-only access.

## Evidence
110 local tests, strict TypeScript and Android Metro/Hermes export passed before publication. Tests include measured-clock seeking/gaps, actual GLB AA/PP/sil vertex deformation and execution of Java scalar validation/payload methods in a host JVM. Native APK compilation and emulator evidence remain separate required checks.

The 0.1.11 APK already passed Android installation, main rig launch/resume, rendered floating window over Home and native close. Its initial accessibility-only test had a false negative because a nonfocusable overlay is omitted by UIAutomator; checksum-pinned rechecking using fresh native render readiness, WindowManager surfaces and reviewed screenshots passed. The new 0.1.12 native bridge must also pass the full build and emulator workflow.

## Remaining blockers
Production still needs an approved realistic 3D likeness, live configured speech-provider/gateway tests and measured audio/face alignment, background speech continuation, telephone-agent integration, offline model/runtime, physical Android performance/permissions/update QA and production signing. This candidate does not claim these are complete. The production gate is unchanged.
