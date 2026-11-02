#!/usr/bin/env python3
"""Stage Nia GLBs safely. A static preview cannot replace the animated rig."""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MAX_BYTES=25*1024*1024

def stage(source:Path,mode:str):
    if not source.is_file():
        raise ValueError("Source GLB file does not exist")
    blob=source.read_bytes()
    if not 20<=len(blob)<=MAX_BYTES or blob[:4]!=b"glTF":
        raise ValueError("Expected a self-contained GLB smaller than 25 MB")
    if mode=="animated-test":
        check=subprocess.run([sys.executable,str(ROOT/"scripts/verify_nia_rig.py"),str(source)],
                             capture_output=True,text=True)
        if check.returncode:
            raise ValueError("Rig rejected; static models cannot replace the animated Nia character. "+check.stderr.strip())
        target=ROOT/"assets/nia-character-animated.glb"
    elif mode=="static-preview":
        target=ROOT/"assets/nia-static-preview.glb"
    else:
        raise ValueError("Unsupported staging mode")
    if source.resolve()!=target.resolve():
        shutil.copyfile(source,target)
    digest=hashlib.sha256(blob).hexdigest()
    manifest={"asset":str(target.relative_to(ROOT)),"sha256":digest,"mode":mode,
              "production_approved":False,
              "notice":"Appearance and physical Android verification pending. No production release authorization."}
    (ROOT/"docs/nia-staged-asset.json").write_text(json.dumps(manifest,indent=2)+"\n")
    return target,digest

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("source",type=Path)
    parser.add_argument("--mode",choices=["static-preview","animated-test"],required=True)
    args=parser.parse_args()
    try:
        path,digest=stage(args.source,args.mode)
        print(f"STAGED {path} SHA-256={digest}")
        if args.mode=="static-preview":
            print("Static preview only; bundled animated character unchanged.")
        else:
            print("Animated candidate staged for internal Android CI; production approval remains blocked.")
    except (ValueError,OSError) as exc:
        parser.exit(1,f"ASSET BLOCKED: {exc}\n")
