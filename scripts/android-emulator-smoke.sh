#!/usr/bin/env bash
# Black-box emulator verification of an installed, bundled Nia APK.
# A cold-start splash screen is NOT an app crash. Wait for the actual UI.
set -euo pipefail
APP=com.nia.companion
APK=nia-build/app-release.apk
OUT=artifacts/android-smoke
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
booted=false
for i in $(seq 1 90); do
  if [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; then booted=true; break; fi
  sleep 2
done
if [ "$booted" != true ]; then echo "::error::Android did not finish booting within 180 seconds"; exit 1; fi
adb install -r "$APK" | tee "$OUT/install.txt"
adb shell pm path "$APP" | grep -q package: || { echo "::error::Nia APK is not installed"; exit 1; }
adb logcat -c
adb shell am force-stop "$APP" || true
adb shell am start -W -n "$APP/.MainActivity" | tee "$OUT/launch.txt"

capture() {
  local phase="$1"
  adb exec-out screencap -p >"$OUT/$phase.png" || true
  adb logcat -d -v time >"$OUT/$phase-logcat.txt" || true
  adb shell dumpsys activity activities >"$OUT/$phase-activity.txt" || true
}

verify_scene() {
  local phase="$1" i
  local ui="$OUT/$phase-ui.xml"
  # Slow software GL / cold Android initialization can take substantially
  # longer than the old 5-second pidof check. Poll for visible diagnostics.
  for i in $(seq 1 24); do
    # A failed dump must never reuse a previous successful UI hierarchy.
    adb shell rm -f /sdcard/nia-smoke-ui.xml
    rm -f "$ui"
    adb shell uiautomator dump /sdcard/nia-smoke-ui.xml >"$OUT/$phase-dump.txt" 2>&1 || true
    adb exec-out cat /sdcard/nia-smoke-ui.xml >"$ui" 2>/dev/null || true
    # The emulator's Pixel Launcher sometimes reports ANR over a running app.
    # Only dismiss the explicit system Wait dialog; never dismiss Nia errors.
    if grep -q 'Pixel Launcher isn' "$ui" && grep -q 'android:id/aerr_wait' "$ui"; then
      echo "Emulator launcher ANR overlay detected; choosing Wait to inspect Nia"
      coords="$(python3 - "$ui" <<'PY'
import re,sys,xml.etree.ElementTree as ET
try:
    root=ET.parse(sys.argv[1]).getroot()
    for node in root.iter('node'):
        if node.get('resource-id')=='android:id/aerr_wait':
            nums=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(nums)==4:
                print((nums[0]+nums[2])//2,(nums[1]+nums[3])//2)
                break
except (ET.ParseError, OSError, ValueError):
    pass
PY
)"
      if [ -n "$coords" ]; then adb shell input tap $coords; fi
      sleep 2
      continue
    fi
    # The Pixel Launcher may show an Android OS "isn't responding" dialog
    # on resource-constrained headless emulators. This obscures Nia's UI even
    # when Nia is alive and rendering underneath it. Choose Wait, not Close.
    if grep -Eq 'Pixel Launcher.*responding|Pixel Launcher.*not responding' "$ui"; then
      echo "Android system launcher ANR dialog obscured Nia; selecting Wait"
      coords=$(python3 scripts/android-dialog-coordinates.py "$ui" || true)
      if [[ -n "$coords" ]]; then
        adb shell input tap $coords
        sleep 3
        continue
      fi
      capture "$phase-system-anr"
      echo "::error::Emulator infrastructure problem: system ANR dialog could not be dismissed"
      return 1
    fi
    scene_status=0
    python3 scripts/verify-android-scene.py "$ui" || scene_status=$?
    if [ "$scene_status" -eq 2 ]; then
      capture "$phase-glb-error"
      echo "::error::Nia showed a GLB load failure during $phase"
      grep -o 'text="Model loading failed:[^"]*"' "$ui" | head -1 || true
      return 1
    fi
    # Diagnostics: Rigged with bones: 25 must belong to Nia and report
    # nonzero skinned geometry; unrelated or static-preview text cannot pass.
    if [ "$scene_status" -eq 0 ] && adb shell pidof "$APP" >/dev/null; then
      capture "$phase-success"
      cp "$ui" "$OUT/$phase-success-ui.xml"
      echo "PASS: $phase displayed the real Nia 25-bone rig in the Android UI"
      return 0
    fi
    if (( i % 4 == 0 )); then
      echo "Waiting for $phase 3D scene: poll $i/24; process: $(adb shell pidof "$APP" 2>/dev/null || echo not-yet-running)"
    fi
    sleep 6
  done
  capture "$phase-timeout"
  echo "::error::Nia did not display the 25-bone GLB rig during $phase"
  # Preserve diagnostic UI and native logs; do not misclassify a splash-screen
  # timeout as a confirmed app crash.
  return 1
}

verify_scene launch
adb shell input keyevent KEYCODE_HOME
sleep 5
adb shell am start -W -n "$APP/.MainActivity" | tee "$OUT/resume.txt"
verify_scene resume
echo "PASS: APK install, Android UI rig rendering, background and resume verified"
