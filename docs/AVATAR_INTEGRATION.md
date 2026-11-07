# Nia avatar integration

The saved candidate skeletal rig is now bundled at both required asset paths. It has 25 joints, Idle/Walk/Dance/Wave clips, and eight facial targets. Structural validation and actual Three.js loading/hand motion tests pass. This does not establish photorealistic likeness or device rendering quality.

The renderer reads self-contained GLB files with the current Expo File API, disposes failed loaders, pauses rendering when backgrounded, and supports opt-in autonomous animation changes. Device speech does not provide an aligned audio clock: mouth timing remains unverified and is not fabricated from unrelated provider cues.

Native overlay and unattended telephone conversations remain unimplemented. The old native overlay is excluded from production configuration.


## 0.1.11 floating-window update
The native overlay now has an offline Three.js/WebGL renderer and a foreground service, enabled through the Expo plugin. It replaces the older text-only window. Native compilation, emulator launch/persistence/close and physical-device verification must be evaluated for this candidate. Its current character is still an unapproved test asset; floating-window audio/viseme synchronization is not connected. Production approval remains blocked.
