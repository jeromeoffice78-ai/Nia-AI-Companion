# Nia avatar integration

The saved candidate skeletal rig is now bundled at both required asset paths. It has 25 joints, Idle/Walk/Dance/Wave clips, and eight facial targets. Structural validation and actual Three.js loading/hand motion tests pass. This does not establish photorealistic likeness or device rendering quality.

The renderer reads self-contained GLB files with the current Expo File API, disposes failed loaders, pauses rendering when backgrounded, and supports opt-in autonomous animation changes. Device speech does not provide an aligned audio clock: mouth timing remains unverified and is not fabricated from unrelated provider cues.

Native overlay and unattended telephone conversations remain unimplemented. The old native overlay is excluded from production configuration.
