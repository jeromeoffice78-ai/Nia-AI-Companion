"""Blender headless scene builder for the Nia engineering rig.
No approved Nia image is stored in this public repository.
This is NOT the final likeness-matched face/body.
"""
import bpy
import json
from pathlib import Path

rig=Path('dist/Nia-blender-compatible.glb').resolve()
out=Path('dist/Nia-Engineering-Rig.blend').resolve()
report=Path('dist/Nia-Blender-Inspection.json').resolve()
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(rig))
models=[o for o in bpy.data.objects if o not in before]
armatures=[o for o in models if o.type=='ARMATURE']
meshes=[o for o in models if o.type=='MESH']
if not armatures or max(len(a.data.bones) for a in armatures)<20:
    raise RuntimeError('Nia skeleton missing')
if len(meshes)<20:
    raise RuntimeError('Nia rigged mesh is incomplete')
for ob in meshes:
    for polygon in ob.data.polygons:
        polygon.use_smooth=True
bpy.context.scene['NIA_STATE']='Engineering skeleton and prototype mesh, NOT approved realistic likeness'
bpy.context.scene['NIA_FINAL_LIKENESS_APPROVED']=False
bpy.context.scene['NIA_NO_PURSE']=True
bpy.context.scene['NIA_REFERENCE_NOT_IN_PUBLIC_REPOSITORY']=True
bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
report.write_text(json.dumps({
 'blender_version':bpy.app.version_string,
 'rig_file':rig.name,
 'bone_counts':[len(a.data.bones) for a in armatures],
 'mesh_count':len(meshes),
 'shape_keys':sorted({key.name for mesh in meshes if mesh.data.shape_keys for key in mesh.data.shape_keys.key_blocks}),
 'actions':sorted(a.name for a in bpy.data.actions),
 'reference_photo_included':False,
 'production_approved':False
},indent=2)+'\n')
print('NIA_BLENDER_SCENE_SAVED',out)
