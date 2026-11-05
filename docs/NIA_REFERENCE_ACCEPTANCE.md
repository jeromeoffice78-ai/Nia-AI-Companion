# Nia reference acceptance checklist

**No current likeness reference is approved for use in this GitHub repository.**

The mistakenly selected `Nia AI Companion Character Portrait.png` and all image crops in `Nia_Private_3D_Modeling_References.zip` were explicitly rejected by the owner. Neither can be treated as Nia's official character, even if they look similar to another design. Do not copy or recolor them into a new production model.

Before modeling resumes:

1. The owner supplies or identifies the **exact** image of the approved Nia. Do not infer approval from a similar character portrait, a sprite, a previous assistant-generated picture, a filename, or a design description.
2. Store the original image **privately**, not in the public GitHub repository. Record its SHA-256, date, and explicit owner approval without claiming an unverified historical approval.
3. Generate a face/body modeling target and preview only from that approved image. Verify face, hair, body shape, and outfit with the owner before investing in 3D retopology.
4. Build textured, contiguous skinned geometry; rig and animate; validate facial morphs and synchronized mouth movement.
5. Require owner approval of the final model and record its exact GLB SHA-256. Run the existing `scripts/verify_nia_production.py` and physical Android visual acceptance.

Until step 1, development may proceed on rig functionality, import safety, and animation tests, but **not** on likeness-specific appearance.

The current bundled character is an internal animation test rig and not the approved visual Nia. This policy does not remove or weaken the production release gate.
