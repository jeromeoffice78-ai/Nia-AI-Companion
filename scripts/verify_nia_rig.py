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
clips = {a.get('name') for a in data.get('animations', [])}
assert {'Idle', 'Walk', 'Dance', 'Wave'} <= clips, 'Missing animation clips'
targets = set()
for mesh in data.get('meshes', []):
    targets.update(mesh.get('extras', {}).get('targetNames', []))
assert {'viseme_AA', 'viseme_EE', 'viseme_OH', 'viseme_FV',
        'viseme_MBP', 'viseme_L', 'blinkLeft', 'blinkRight'} <= targets, 'Missing facial morphs'
print(f'PASS: {path.name} / {len(data["skins"][0]["joints"])} bones / '
      f'{len(data["meshes"])} meshes / {len(clips)} clips / {len(targets)} facial targets')
