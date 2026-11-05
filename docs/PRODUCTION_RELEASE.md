# Nia production release prerequisites

**Current status: BLOCKED.** Internal APK tests can pass while the production asset is missing.

1. **Approved 3D likeness** — produce a realistic, textured, connected GLB matching the Nia visual reference. This repo only contains a segmented prototype. Keep the original reference images private until the owner authorizes publishing them.
2. **Full-body and face rig** — humanoid skin weights, Idle/Walk/Dance/Wave, at least the eight facial morphs tested by the renderer, and natural movement on actual Android hardware.
3. **Owner approval** — visually inspect the final asset on-device and record its SHA-256 in `docs/nia-production-approval.json`. Do not fabricate these approvals.
4. **Measured speech synchronization** — integrate a TTS engine with real audio timing and test synchronization with the facial mesh. The existing silent demo and Android Expo Speech are not phoneme-aligned.
5. **Native overlay and telephone functions** — test only supported, consented functionality, including Android permissions and lifecycle; do not advertise unimplemented features.
6. **Production delivery** — replace internal debug signing, verify Android install/update, security, secrets, background behavior, and release artifacts.

A plausible production asset pipeline is image-to-3D modeling, review of geometry, auto-rigging, facial blendshape creation, export to self-contained GLB, integration and on-device inspection. Some 3D services require an account and paid compute. No paid generation has been started.


**Reference correction:** [NIA_VISUAL_REFERENCE_SPEC.md](NIA_VISUAL_REFERENCE_SPEC.md) explicitly rejects the incorrectly selected portrait. The approved edited 2D source has been identified and hash-verified in conversation, but the source image remains private and no production 3D GLB likeness is approved. The aligned speech gateway has been implemented in source, but is not deployed or configured. See [ALIGNED_SPEECH_GATEWAY.md](ALIGNED_SPEECH_GATEWAY.md).
