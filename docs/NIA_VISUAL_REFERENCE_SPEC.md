# Nia appearance target — reference-driven production modeling

Source: the existing **Nia AI Companion Character Portrait** in the owner's private file library. Do not publish or commit the reference pixels or assume it is a distributable real person's photo.

## Visible appearance to reproduce
- **Character:** a clearly adult, human-proportioned slim woman. Avoid stylized mannequin segmentation, floating pieces, bulging ellipsoid knees, or rigid cut joints.
- **Face:** warm natural facial anatomy, brown eyes, shaped brows, delicate nose and lips, realistic eyelids and mouth interior; facial appearance must be visually compared against the user's approved portrait from front and three-quarter views. Do not declare likeness without their review.
- **Hair:** dark brunette, loosely gathered high bun/updo with face-framing strands, not the current blocky braided ponytail.
- **Clothing:** matching dusty-pink/mauve fitted crop camisole with narrow straps and buttoned front, matching short lounge shorts with drawstring and trim; avoid the mannequin's white T-shirt and gray shorts.
- **Accessories:** delicate heart-shaped pendant necklace. Keep geometry anchored to the chest rig.
- **Body:** continuous high-quality mesh with believable shoulders, elbows, waist, hips, knees and ankles; mild fabric drape and wrinkle detail, natural skin shading and smooth surface normals.
- **Materials:** physically-based skin and fabric textures, detailed eyes and hair, embedded in a portable GLB. Verify PBR textures and lighting from multiple angles.
- **Rig:** preserve or correctly retarget 25+ humanoid joints and Idle/Walk/Dance/Wave; require bone weight painting across flex joints and the eight existing face blendshapes. Add jaw/teeth, tongue and phoneme controls as appropriate.
- **Android:** benchmark frame rate and memory on the owner's Android phone, verify animation appearance and mouth sync against the actual synthesized audio, maintain correct orientation and scale.
- **Approval:** separate source asset and owner-reviewed final GLB, linked by SHA-256. No approval flag may be invented.

## Production limitation
The current 0.1.x test assets do not match this reference. Changing shirt and shorts colors alone will not create the approved likeness. A new sculpted/textured humanoid model, facial rig and actual on-device review are necessary.
