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
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
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
  local phase="$1" i ui="$OUT/$phase-ui.xml"
  # Slow software GL / cold Android initialization can take substantially
  # longer than the old 5-second pidof check. Poll for visible diagnostics.
  for i in $(seq 1 24); do
    adb shell uiautomator dump /sdcard/nia-smoke-ui.xml >"$OUT/$phase-dump.txt" 2>&1 || true
    adb exec-out cat /sdcard/nia-smoke-ui.xml >"$ui" 2>/dev/null || true
    if grep -q 'Model loading failed:' "$ui"; then
      capture "$phase-glb-error"
      echo "::error::Nia showed a GLB load failure during $phase"
      grep -o 'text="Model loading failed:[^"]*"' "$ui" | head -1 || true
      return 1
    fi
    if grep -q 'Diagnostics: Rigged' "$ui" && grep -q 'bones: 25' "$ui"; then
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
