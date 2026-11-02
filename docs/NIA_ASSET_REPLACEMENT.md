# Nia replacement asset integration

**Realistic Nia appearance remains unapproved.** The standalone connected starter
GLB created in chat is static and unrigged. Do not put it in the Android animation slot.

From the repository root:

- Stage the connected starter for appearance tests only:
  `python3 scripts/prepare_nia_asset.py Nia-Starter-Connected-Asset.glb --mode static-preview`
- Once a creator supplies a **real rigged GLB**, stage it for Android builds:
  `python3 scripts/prepare_nia_asset.py /path/to/nia-rigged.glb --mode animated-test`

The animated command validates required skeletal names, skin, four animation
clips and facial morphs before replacing `assets/nia-character-animated.glb`.
The Android workflows have been repaired so they **do not overwrite** the staged
replacement with the old segmented model.

A static preview can be inspected using a 3D GLB viewer, but is not currently
an animated app character. No script creates owner approval or removes the
production release gate. Complete likeness approval, real timed speech, signed
release build, and physical Android verification are still required.
