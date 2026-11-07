"""Read one fresh Android UI dump. Exit 0=loaded, 1=waiting, 2=avatar error.

This verifies app diagnostics, not visual likeness or animation quality.
"""
import re
import sys
import xml.etree.ElementTree as ET


def verify(path):
    try:
        root = ET.parse(path).getroot()
    except (ET.ParseError, OSError):
        return 1
    texts = [node.get('text', '') for node in root.iter('node')
             if node.get('package') == 'com.nia.companion']
    if any('Model loading failed:' in text for text in texts):
        return 2
    for text in texts:
        if not text.startswith('Diagnostics: Rigged'):
            continue
        bones = re.search(r'\bbones:\s*(\d+)\b', text)
        skins = re.search(r'\bskinned meshes:\s*(\d+)\b', text)
        if bones and int(bones[1]) == 25 and skins and int(skins[1]) > 0:
            return 0
    return 1


if __name__ == '__main__':
    sys.exit(verify(sys.argv[1]))
