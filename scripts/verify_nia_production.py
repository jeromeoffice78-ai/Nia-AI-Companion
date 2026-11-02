#!/usr/bin/env python3
"""Fail-closed preflight for a genuinely approved Nia production GLB.
This is intentionally distinct from the permissive internal test-rig check.
"""
import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

REQUIRED_MORPHS={"viseme_AA","viseme_EE","viseme_OH","viseme_FV",
                 "viseme_MBP","viseme_L","blinkLeft","blinkRight"}
REQUIRED_CLIPS={"Idle","Walk","Dance","Wave"}

def inspect(path:Path, approval:Path):
    errors=[]
    if not path.is_file():
        return ["A separate production avatar GLB has not been supplied"]
    blob=path.read_bytes()
    if len(blob)<20 or blob[:4]!=b"glTF":
        return ["Production avatar is not a GLB"]
    try:
        version,length=struct.unpack_from("<II",blob,4)
        json_length,chunk_type=struct.unpack_from("<I4s",blob,12)
        if version!=2 or length!=len(blob) or chunk_type!=b"JSON":
            return ["Malformed GLB header"]
        data=json.loads(blob[20:20+json_length])
    except (ValueError,KeyError,struct.error,json.JSONDecodeError):
        return ["Malformed GLB metadata"]
    asset=data.get("asset",{})
    description=(str(asset.get("generator",""))+" "+
                 str(data.get("extras",{}).get("notice",""))).lower()
    if "prototype" in description or "not a photogrammetric likeness" in description:
        errors.append("Prototype/mannequin source is not the approved Nia appearance")
    nodes=data.get("nodes",[])
    skins=data.get("skins",[])
    if not skins or len(skins[0].get("joints",[]))<20:
        errors.append("Full-body humanoid skeletal skin is missing")
    if not any("skin" in n and "mesh" in n for n in nodes):
        errors.append("No skinned body mesh")
    meshes=data.get("meshes",[])
    targets=set()
    for mesh in meshes: targets.update(mesh.get("extras",{}).get("targetNames",[]))
    if not REQUIRED_MORPHS.issubset(targets):
        errors.append("Required facial viseme and blink morphs are missing")
    clips={clip.get("name") for clip in data.get("animations",[])}
    if not REQUIRED_CLIPS.issubset(clips):
        errors.append("Idle/Walk/Dance/Wave animation clips are missing")
    if not data.get("images"):
        errors.append("No embedded appearance texture images; cannot verify a textured production avatar")
    if not approval.is_file():
        errors.append("Owner-approved model hash manifest is missing")
    else:
        try:
            manifest=json.loads(approval.read_text())
            digest=hashlib.sha256(blob).hexdigest()
            if manifest.get("approved_glb_sha256")!=digest:
                errors.append("Model does not match the owner-approved SHA-256 hash")
            if manifest.get("likeness_reviewed") is not True:
                errors.append("Explicit likeness review has not been recorded")
            if manifest.get("android_device_visual_test") is not True:
                errors.append("Physical Android visual verification has not been recorded")
        except (OSError,ValueError,TypeError):
            errors.append("Invalid owner approval manifest")
    return errors

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("glb",type=Path)
    p.add_argument("--approval",type=Path,default=Path("docs/nia-production-approval.json"))
    args=p.parse_args()
    failures=inspect(args.glb,args.approval)
    if failures:
        for failure in failures:
            print("RELEASE BLOCKED: "+failure,file=sys.stderr)
        sys.exit(1)
    print("PASS: production 3D asset passed model integrity and owner approval preflight")
