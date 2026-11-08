# Nia 0.1.13 shoulder repair candidate

A physical-device screenshot of 0.1.12 showed the raised sleeve separating from the torso. This confirms that the app opens and displays the rig on that phone, but it is failed visual-quality evidence, not production approval.

## Repair
The internal shirt now has real torso armholes with sleeve grafts. Their matching boundary vertices use identical bind positions and skin weights, preventing the joint from opening when the arm raises. Tests verify boundary edge incidence, matching skin data, finite triangles and closed seams across 243 real Wave/Dance/Walk poses.

The floating renderer now packages and executes the same continuous-body module as the main renderer; previously it loaded only the raw segmented GLB. Offline resource guards remain active, now allowing seven bundled assets.

The autonomy toggle is labeled “Automatic motion selection.” Manual Wave intentionally continues when automatic selection is off; the UI explains this instead of implying all motion is paused.

## Verification
Full tests, TypeScript, Android prebuild and Metro export must pass. The emulator captures Wave and Idle poses for visual review, as well as retaining installation, launch/resume, floating-window over Home and close checks. These screenshots cannot establish realistic resemblance or physical-device performance.

## Unchanged blockers
The current asset remains an unapproved test character. Its face, angular torso/hips, hands, hair, materials and overall realism are not solved by this shoulder repair. Production still requires an approved 3D likeness, live speech calibration, background speech, telephone-agent/offline-inference implementation, physical-device QA and production signing.
