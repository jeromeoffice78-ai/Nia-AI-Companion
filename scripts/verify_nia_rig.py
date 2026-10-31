#!/usr/bin/env python3
"""Validate the approved Nia rig before Android packaging."""
import json
import struct
import sys
from pathlib import Path

path = Path(sys.argv[1])
blob = path.read_bytes()
assert len(blob) >= 20 and blob[:4] == b'glTF', 'Not a binary glTF file'
assert struct.unpack_from('<I', blob, 4)[0] == 2, 'Unsupported glTF version'
assert struct.unpack_from('<I', blob, 8)[0] == len(blob), 'Incorrect GLB byte length'
json_length, chunk_type = struct.unpack_from('<I4s', blob, 12)
assert chunk_type == b'JSON', 'Missing JSON chunk'
data = json.loads(blob[20:20 + json_length])
nodes = data['nodes']
names = {node.get('name') for node in nodes}
assert {'Hips', 'Head', 'Jaw', 'LeftEye', 'RightEye'} <= names, 'Missing skeletal bones'
assert data.get('skins') and len(data['skins'][0]['joints']) >= 25, 'Missing skin'
assert any('skin' in node and 'mesh' in node for node in nodes), 'No skinned mesh node'
assert all(0 <= joint < len(nodes) for skin in data['skins'] for joint in skin['joints']), 'Invalid joint index'
clips = {a.get('name') for a in data.get('animations', [])}
assert {'Idle', 'Walk', 'Dance', 'Wave'} <= clips, 'Missing animation clips'
for animation in data['animations']:
    assert animation.get('channels') and animation.get('samplers'), 'Empty animation'
    for channel in animation['channels']:
        assert channel['sampler'] < len(animation['samplers']), 'Invalid animation sampler'
        assert channel['target'].get('node', -1) < len(nodes) and channel['target'].get('node', -1) >= 0, 'Invalid animation node'
targets = set()
for mesh in data.get('meshes', []):
    names = mesh.get('extras', {}).get('targetNames', [])
    if names:
        assert all(len(primitive.get('targets', [])) == len(names) for primitive in mesh.get('primitives', [])), 'Morph target count mismatch'
    targets.update(names)
assert {'viseme_AA', 'viseme_EE', 'viseme_OH', 'viseme_FV',
        'viseme_MBP', 'viseme_L', 'blinkLeft', 'blinkRight'} <= targets, 'Missing facial morphs'
print(f'PASS: {path.name} / {len(data["skins"][0]["joints"])} bones / '
      f'{len(data["meshes"])} meshes / {len(clips)} clips / {len(targets)} facial targets')
