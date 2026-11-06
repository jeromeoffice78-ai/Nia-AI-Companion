#!/usr/bin/env python3
"""Verify exact private Nia photo before any likeness modeling (fail-closed)."""
import argparse,hashlib,pathlib,sys
EXPECTED='e69aa53ae84f964f0e55202d711ad117d01f321f2eef3161382d1acb56532db5'
def verify(path:pathlib.Path):
 if not path.is_file():raise ValueError('Approved Nia source image not found')
 if path.suffix.lower()!='.png':raise ValueError('Approved Nia source must be a PNG')
 data=path.read_bytes()
 if len(data)>20*1024*1024:raise ValueError('Nia reference exceeds 20 MB')
 digest=hashlib.sha256(data).hexdigest()
 if digest!=EXPECTED:raise ValueError('WRONG NIA REFERENCE — file hash does not match the latest owner-approved image')
 if data[:8]!=b'\x89PNG\r\n\x1a\n':raise ValueError('Image file is not a PNG')
 return digest
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('source',type=pathlib.Path)
 args=parser.parse_args()
 try:
  digest=verify(args.source)
  print('APPROVED 2D NIA REFERENCE VERIFIED: '+digest)
  print('This does not approve a 3D model or authorize production release.')
 except (OSError,ValueError) as e:
  print('SOURCE REJECTED: '+str(e),file=sys.stderr)
  raise SystemExit(1)
