#!/usr/bin/env bash
# Runs the whole Maestro suite (.maestro/) on one Android emulator or phone,
# including the flows that need the device set up around them
# (docs/device-testing.md):
#
#   scripts/maestro-suite.sh --e2e-apk build/myshelf-e2e.apk \
#     [--production-apk build/myshelf-production.apk] [--device emulator-5554] \
#     [--out maestro-results]
#
# 1. Installs the E2E APK and puts the device in a known state: light mode,
#    100 % font size, online, automatic time, and the backup and Goodreads
#    test files in Downloads.
# 2. Runs every flow not tagged `manual`, `production` or `hooked`, then each
#    cover-scan/photo-<book>.yaml whose photo of the developer's own copy is
#    in .maestro/cover-scan/photos/ (never committed; .maestro/cover-scan/README.md).
# 3. Runs each `hooked` flow with its set-up and checks:
#      lookup-isbn-online  then checks the database holds a file:// cover
#      reminders           then checks the alarm is set, moves the clock to the
#                          due date, checks the notification is posted and taps
#                          it (hooks/reminder-open.yaml); needs `adb root`
#      dark-mode           in `cmd uimode night yes`
#      font-scale          at font_scale 2.0
#      offline-queue       in airplane mode, then hooks/offline-resume.yaml online
#      group-drag-reorder  then holds and drags a row with `input draganddrop`
#                          and runs hooks/group-drag-check.yaml
#      db-export           after db-export-setup.yaml and the E2E fault marker,
#                          then checks the shared copy is the library; needs
#                          `adb root`
# 4. With --production-apk, installs it and runs the `production` flows, then
#    puts the E2E APK back.
#
# Screenshots, logs and JUnit reports go to --out, one folder per step. The
# device's settings are put back however the run ends. Exits 1 if any step
# failed.
set -uo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
e2e_apk=''
production_apk=''
device=${ANDROID_SERIAL:-}
out="$root/maestro-results"
while [ $# -gt 0 ]; do
  case "$1" in
    --e2e-apk) e2e_apk=$2; shift 2 ;;
    --production-apk) production_apk=$2; shift 2 ;;
    --device) device=$2; shift 2 ;;
    --out) out=$2; shift 2 ;;
    *) echo "usage: $0 --e2e-apk <apk> [--production-apk <apk>] [--device <serial>] [--out <dir>]" >&2; exit 2 ;;
  esac
done
[ -n "$e2e_apk" ] || { echo "maestro-suite: --e2e-apk is required" >&2; exit 2; }
if [ -z "$device" ]; then
  device=$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')
fi
[ -n "$device" ] || { echo "maestro-suite: no device found (adb devices)" >&2; exit 2; }

APP=dev.asorichetti.myshelf
DB=/data/data/$APP/files/SQLite/myshelf.db
flows="$root/.maestro"
mkdir -p "$out"
failed=()
passed=()

a() { adb -s "$device" "$@"; }
say() { printf '\n== %s\n' "$*"; }

# `adb root` works on emulator images without Google Play (and userdebug
# builds); the checks that read the app's database or set the clock need it.
has_root=false
if a root > /dev/null 2>&1; then
  a wait-for-device
  [ "$(a shell id -u | tr -d '\r')" = 0 ] && has_root=true
fi

install() {
  a install -r "$1" > /dev/null 2>&1 || { a uninstall "$APP" > /dev/null 2>&1; a install "$1" > /dev/null; }
}

# The phone's settings as a normal user has them.
reset_device() {
  a shell cmd uimode night no > /dev/null
  a shell settings put system font_scale 1.0
  a shell cmd connectivity airplane-mode disable > /dev/null 2>&1
  a shell svc wifi enable > /dev/null 2>&1
  a shell svc data enable > /dev/null 2>&1
  if $has_root; then
    a shell settings put global auto_time 1
    # The emulator does not always take network time back at once: set it
    # from this machine's clock, in UTC so the time zones need not match.
    a shell date -u "$(date -u +%m%d%H%M%Y.%S)" > /dev/null 2>&1 || true
  fi
  a shell settings put system accelerometer_rotation 0 > /dev/null 2>&1
  a shell settings put system user_rotation 0 > /dev/null 2>&1
}
trap reset_device EXIT

# maestro test with a step name: its own output folder and JUnit report.
run() {
  local step=$1; shift
  say "$step"
  if maestro --device "$device" test --format junit --output "$out/$step.xml" --test-output-dir "$out/$step" "$@"; then
    passed+=("$step")
    return 0
  fi
  failed+=("$step")
  return 1
}

check() {
  local step=$1 ok=$2 detail=$3
  if [ "$ok" = true ]; then
    passed+=("$step"); echo "ok: $step ($detail)"
  else
    failed+=("$step"); echo "FAILED: $step ($detail)"
  fi
}

# The centre "x y" of the first on-screen element whose attributes match $1 (from uiautomator).
centre_of() {
  a shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  a shell cat /sdcard/ui.xml | tr '>' '\n' | grep -F "$1" | head -1 |
    sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/' |
    awk 'NF == 4 { print int(($1 + $3) / 2), int(($2 + $4) / 2) }'
}

wait_online() {
  for _ in $(seq 1 30); do
    a shell ping -c 1 -W 2 openlibrary.org > /dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

say "Device $device (root: $has_root)"
install "$e2e_apk"
reset_device
a shell mkdir -p /sdcard/Download
a push "$root/src/services/backup/__fixtures__/backup-phone-covers.json" /sdcard/Download/myshelf-backup-test.json > /dev/null
a push "$root/src/services/backup/__fixtures__/goodreads_library_export.csv" /sdcard/Download/goodreads_library_export.csv > /dev/null
# Let the media scanner index them, so the document picker lists them.
a shell content call --uri content://media/external/file --method scan_volume --arg external_primary > /dev/null 2>&1 || true

run flows "$flows" --exclude-tags manual,production,hooked

# Real covers: only where the developer's photo is there.
for flow in "$flows"/cover-scan/photo-*.yaml; do
  book=$(basename "$flow" .yaml); book=${book#photo-}
  if [ -f "$flows/cover-scan/photos/$book.jpg" ]; then
    run "cover-photo-$book" "$flow"
  else
    echo "No .maestro/cover-scan/photos/$book.jpg: skipping $(basename "$flow")"
  fi
done

# Online lookup, and the cover it saved is a file on the phone.
if run lookup-isbn-online "$flows/lookup-isbn-online.yaml" && $has_root; then
  covers=$(a shell "sqlite3 $DB \"select count(*) from books where cover_uri like 'file://%'\"" | tr -d '\r')
  files=$(a shell "ls /data/data/$APP/files/covers 2> /dev/null | wc -l" | tr -d '\r ')
  [ "${covers:-0}" -ge 1 ] && [ "${files:-0}" -ge 1 ] && ok=true || ok=false
  check lookup-cover-stored "$ok" "books with a file:// cover: ${covers:-?}, files in covers/: ${files:-?}"
fi

# Reminders: scheduled, delivered on the due date, and opened from the shade.
if run reminders "$flows/reminders.yaml"; then
  alarm=$(a shell dumpsys alarm | grep -A1 "$APP" | grep -c 'expo.modules.notifications' || true)
  [ "${alarm:-0}" -ge 1 ] && ok=true || ok=false
  check reminder-scheduled "$ok" "notification alarms: ${alarm:-0}"
  if $has_root && [ "$ok" = true ]; then
    # Dune is due 11 days after the fixture's today (the phone's date), at
    # 10:00 on the phone's clock; the alarm may be up to an hour late (an
    # inexact alarm), so jump to 11:00:30 that day.
    now=$(a shell date +%s | tr -d '\r')
    due=$(a shell date -d "@$((now + 11 * 86400))" +%m%d | tr -d '\r')
    year=$(a shell date -d "@$((now + 11 * 86400))" +%Y | tr -d '\r')
    a shell input keyevent KEYCODE_HOME
    sleep 1
    a shell am kill "$APP"
    a shell settings put global auto_time 0
    a shell date "${due}1100${year}.30"
    posted=0
    for _ in $(seq 1 30); do
      posted=$(a shell dumpsys notification --noredact | grep -c "pkg=$APP.*tag=loan-due:" || true)
      [ "$posted" -ge 1 ] && break
      sleep 2
    done
    [ "$posted" -ge 1 ] && ok=true || ok=false
    check reminder-delivered "$ok" "reminders posted on the due date: $posted"
    if [ "$ok" = true ]; then
      a shell cmd statusbar expand-notifications
      run reminder-open "$flows/hooks/reminder-open.yaml"
    fi
    reset_device
  fi
fi

# Drag to reorder: Maestro cannot hold and then drag, `input draganddrop` does
# (it waits the long-press timeout, 400 ms, longer than the app's 350 ms hold).
if run group-drag-reorder "$flows/group-drag-reorder.yaml"; then
  from=$(centre_of 'content-desc="3. Pride and Prejudice"')
  to=$(centre_of 'content-desc="1. Good Omens"')
  if [ -n "$from" ] && [ -n "$to" ]; then
    # Drop a little above the first row's middle.
    a shell input draganddrop $from "${to% *}" "$(( ${to#* } - 40 ))" 1500
    run group-drag-check "$flows/hooks/group-drag-check.yaml"
  else
    check group-drag "false" "could not find the rows on screen"
  fi
fi

# The recovery screen's database export: plant the migrate fault, save the file,
# and check the copy handed to the share sheet is the whole library.
if $has_root && run db-export-setup "$flows/db-export-setup.yaml"; then
  files=/data/data/$APP/files
  a shell "echo migrate > $files/e2e-db-fault && chown \$(stat -c %u:%g $files) $files/e2e-db-fault && chcon \$(stat -c %C $files) $files/e2e-db-fault"
  a shell "rm -f /data/data/$APP/cache/myshelf-library-*.db"
  if run db-export "$flows/db-export.yaml"; then
    copy=$(a shell "ls /data/data/$APP/cache/ | grep '^myshelf-library-.*\.db$'" | tr -d '\r' | head -1)
    books=$(a shell "sqlite3 /data/data/$APP/cache/$copy 'select count(*) from books'" 2> /dev/null | tr -d '\r')
    [ "${books:-0}" = 12 ] && ok=true || ok=false
    check db-export-copy "$ok" "shared copy ${copy:-none} holds ${books:-?} books"
  fi
fi

a shell cmd uimode night yes > /dev/null
run dark-mode "$flows/dark-mode.yaml"
a shell cmd uimode night no > /dev/null

a shell settings put system font_scale 2.0
run font-scale "$flows/font-scale.yaml"
a shell settings put system font_scale 1.0

a shell cmd connectivity airplane-mode enable > /dev/null
if run offline-queue "$flows/offline-queue.yaml"; then
  a shell cmd connectivity airplane-mode disable > /dev/null
  wait_online || echo "maestro-suite: the device did not come back online"
  run offline-resume "$flows/hooks/offline-resume.yaml"
fi
a shell cmd connectivity airplane-mode disable > /dev/null

if [ -n "$production_apk" ]; then
  a uninstall "$APP" > /dev/null 2>&1
  install "$production_apk"
  run production "$flows" --include-tags production
  a uninstall "$APP" > /dev/null 2>&1
  install "$e2e_apk"
fi

say "Summary"
echo "passed: ${passed[*]:-none}"
echo "failed: ${failed[*]:-none}"
echo "results: $out"
[ ${#failed[@]} -eq 0 ]
