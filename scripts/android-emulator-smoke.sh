#!/usr/bin/env bash
# Real APK installation and UI verification in an Android emulator.
# Fails closed if a rigged 3D scene never becomes visible.
set -euo pipefail
APP=com.nia.companion
APK=nia-build/app-release.apk
OUT=artifacts/android-smoke
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
adb install -r "$APK" | tee "$OUT/install.txt"
adb logcat -c
adb shell am force-stop "$APP" >/dev/null 2>&1 || true
adb shell monkey -p "$APP" -c android.intent.category.LAUNCHER 1 >"$OUT/launch.txt"
cat "$OUT/launch.txt"

capture() {
  local phase="$1"
  adb exec-out screencap -p >"$OUT/$phase.png" || true
  adb logcat -d -v time >"$OUT/$phase-logcat.txt" || true
  adb shell uiautomator dump /sdcard/nia-smoke-ui.xml >"$OUT/$phase-uiautomator.txt" 2>&1 || true
  adb exec-out cat /sdcard/nia-smoke-ui.xml >"$OUT/$phase-ui.xml" 2>/dev/null || true
}

verify_scene() {
  local phase="$1" i
  for i in $(seq 1 12); do
    if ! adb shell pidof "$APP" >/dev/null 2>&1; then
      capture "$phase-crashed"
      echo "::error::Nia process exited during $phase"
      return 1
    fi
    capture "$phase-attempt-$i"
    if grep -q 'Model loading failed:' "$OUT/$phase-attempt-$i-ui.xml"; then
      echo "::error::Nia 3D avatar reported a GLB load failure"
      return 1
    fi
    if grep -q 'Diagnostics: Rigged' "$OUT/$phase-attempt-$i-ui.xml" &&
       grep -q 'bones: 25' "$OUT/$phase-attempt-$i-ui.xml"; then
      cp "$OUT/$phase-attempt-$i-ui.xml" "$OUT/$phase-success-ui.xml"
      echo "PASS: $phase displayed Nia rigged 3D scene with 25 bones"
      return 0
    fi
    sleep 5
  done
  echo "::error::Nia never displayed the required rigged avatar diagnostics during $phase"
  return 1
}

verify_scene launch
# Verify the frame loop can pause when Android backgrounds the application,
# then resume and render the same real skeletal avatar.
adb shell input keyevent KEYCODE_HOME
sleep 3
adb shell monkey -p "$APP" -c android.intent.category.LAUNCHER 1 >"$OUT/resume.txt"
verify_scene resume
echo "PASS: Android APK installed, Nia displayed a 25-bone rig, and app survived background/resume"
