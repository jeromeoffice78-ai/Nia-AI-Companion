# Nia character integration status

The original Nia animated model was generated as a separate GLB artifact:
`Nia-character-animated.glb` (Idle and Dance animation clips).
The binary file is **not yet committed** to this GitHub repository.

1. Upload the GLB as `assets/nia-character-animated.glb`.
2. Update `src/niaModel.ts` to use `require('../assets/nia-character-animated.glb')`.
3. Integrate `mountNiaGLB` into the active GLView and handle its async disposal.
4. Test on Android hardware and verify clip playback.
5. Replace the prototype with a properly rigged likeness model before claiming realistic movement.

The model is stylized and its clips only animate root motion. It is not a photorealistic reconstruction, a skeletal rig, or a lip-synced talking head.
