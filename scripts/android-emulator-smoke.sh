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

# Query only Nia-owned accessibility nodes, including its system overlay WebView.
uia_query() {
  python3 - "$@" <<'PY_OVERLAY_QUERY'
import re,sys,xml.etree.ElementTree as ET
try:
    all_nodes=list(ET.parse(sys.argv[1]).getroot().iter('node'))
    nodes=[n for n in all_nodes if n.get('package')=='com.nia.companion']
except (ET.ParseError,OSError):
    sys.exit(1)
mode=sys.argv[2]
texts=[n.get('text','') for n in nodes]
handles={'Nia • drag to move','3D rig ready • drag to move'}
if mode=='ready':
    if any('3D overlay could not start:' in text for text in texts): sys.exit(2)
    # Both labels are set by the offline renderer only after a geometry draw.
    ready=any(re.search(r'(?:3D rig ready|Internal 3D test rig).*\b25 bones\b',text,re.I) for text in texts)
    sys.exit(0 if ready and any(text in handles for text in texts) else 1)
if mode=='closed':
    valid_screen=any(n.get('package') for n in all_nodes)
    sys.exit(0 if valid_screen and not any(text in handles for text in texts) else 1)
if mode=='tap':
    wanted=sys.argv[3].casefold()
    for node in nodes:
        if node.get('text','').casefold()!=wanted or node.get('enabled')=='false': continue
        bounds=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
        if len(bounds)==4 and bounds[2]>bounds[0] and bounds[3]>bounds[1]:
            print((bounds[0]+bounds[2])//2,(bounds[1]+bounds[3])//2)
            sys.exit(0)
sys.exit(1)
PY_OVERLAY_QUERY
}

fresh_overlay_ui() {
  local ui="$1"
  adb shell rm -f /sdcard/nia-overlay-smoke.xml
  rm -f "$ui"
  adb shell uiautomator dump /sdcard/nia-overlay-smoke.xml >"$OUT/overlay-dump.txt" 2>&1 || true
  adb exec-out cat /sdcard/nia-overlay-smoke.xml >"$ui" 2>/dev/null || true
}

tap_label() {
  local label="$1" scroll="${2:-false}" coords i
  local ui="$OUT/overlay-control-ui.xml"
  for i in $(seq 1 12); do
    fresh_overlay_ui "$ui"
    coords="$(uia_query "$ui" tap "$label" || true)"
    if [ -n "$coords" ]; then adb shell input tap $coords; return 0; fi
    if [ "$scroll" = true ]; then
      # Pixel sizes vary with emulator profile. Scroll within its current display.
      read -r sw sh < <(adb shell wm size | python3 -c 'import re,sys; values=re.findall(r"(\d+)x(\d+)",sys.stdin.read()); print(*values[-1])')
      adb shell input swipe "$((sw/2))" "$((sh*3/4))" "$((sw/2))" "$((sh/3))" 350
    fi
    sleep 2
  done
  capture overlay-control-missing
  echo "::error::Could not find Nia control: $label"
  return 1
}

verify_overlay() {
  local phase="$1" i state
  local ui="$OUT/$phase-ui.xml"
  for i in $(seq 1 24); do
    fresh_overlay_ui "$ui"
    state=0
    uia_query "$ui" ready || state=$?
    if [ "$state" -eq 0 ]; then capture "$phase-success"; return 0; fi
    if [ "$state" -eq 2 ]; then
      capture "$phase-render-error"
      echo "::error::Floating Nia renderer reported an error during $phase"
      return 1
    fi
    sleep 3
  done
  capture "$phase-timeout"
  echo "::error::Floating Nia did not show rendered 3D rig diagnostics during $phase"
  return 1
}

# Grant only the overlay app-op under test; no microphone/camera permissions.
adb shell appops set "$APP" SYSTEM_ALERT_WINDOW allow
adb shell appops get "$APP" SYSTEM_ALERT_WINDOW | tee "$OUT/overlay-appops.txt"
tap_label "Show floating Nia" true
verify_overlay overlay-start
adb shell input keyevent KEYCODE_HOME
sleep 5
verify_overlay overlay-home
tap_label "Close"
overlay_closed=false
for i in $(seq 1 12); do
  fresh_overlay_ui "$OUT/overlay-closed-ui.xml"
  # Require a real UI dump: an empty/malformed dump cannot prove closure.
  if uia_query "$OUT/overlay-closed-ui.xml" closed; then overlay_closed=true; break; fi
  sleep 2
done
if [ "$overlay_closed" != true ]; then capture overlay-close-failed; echo "::error::Floating Nia did not close"; exit 1; fi
capture overlay-closed
adb shell am start -W -n "$APP/.MainActivity" | tee "$OUT/overlay-return.txt"
echo "PASS: APK install, Android UI rig, floating 3D over Home, close, background and resume verified"
