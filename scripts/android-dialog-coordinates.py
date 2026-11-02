#!/usr/bin/env python3
"""Read the Android system dialog UI XML and print the center of its Wait button.

Never click "Close app"; the launcher ANR is an emulator infrastructure issue.
"""
import re
import sys
from pathlib import Path
from xml.etree import ElementTree

def wait_button_center(xml_source: str) -> tuple[int, int] | None:
    root = ElementTree.fromstring(xml_source)
    text = [node.attrib.get("text", "") for node in root.iter("node")]
    if not any("Pixel Launcher" in value and "responding" in value for value in text):
        return None
    for node in root.iter("node"):
        if node.attrib.get("text", "").strip() != "Wait":
            continue
        coords = re.fullmatch(
            r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",
            node.attrib.get("bounds", ""),
        )
        if not coords:
            return None
        left, top, right, bottom = (int(value) for value in coords.groups())
        if left >= right or top >= bottom:
            return None
        return (left + right) // 2, (top + bottom) // 2
    return None

if __name__ == "__main__":
    result = wait_button_center(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if result is None:
        sys.exit(1)
    print(f"{result[0]} {result[1]}")
