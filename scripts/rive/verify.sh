#!/usr/bin/env bash
# Rive verification for the seven arcade-control and lobby projects
# (Master Directive v2 §8). Runs from any directory, CI-ready: every command
# must exit 0, no `--data` path may report "no property", and `inspect`
# must report no problems. Evidence lands under docs/evidence/rive/<project>/.
# Each project's build/<project>.data.json is rewritten from the current
# scene, then scripts/rive/check-contract.sh checks content: semantics nodes
# (one button per right-six cap, a slider for the stick, interactive nodes
# at least 44 x 44, no empty-label text) and that every View Model path the
# TS bindings write exists in those dumps (arcade: hard; lobby: report-only).
#
#   scripts/rive/verify.sh            # all seven projects
#   scripts/rive/verify.sh left-stick # one project by name
#
# Needs the Rive CLI (`rive`, 1.5.0 or newer) and Node 24+ on PATH. No login
# is needed: --verify, --once, --screenshot, --semantics, --data-dump and
# --bench work offline (`rive --help`, "signing in").
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RIVE_ROOT="$ROOT/packages/ui/rive"
EVIDENCE="$ROOT/docs/evidence/rive"
PROJECTS=(
  arcade-controls/left-stick
  arcade-controls/right-six
  arcade-controls/start-stop
  lobby/leaderboard
  lobby/start-angled
  lobby/game-transition
  lobby/game-lobby
)

failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }

# run <log> <command...>: capture stdout and stderr, fail on a non-zero exit
# or on a --data path the scene does not have.
run() {
  local log="$1"; shift
  echo "+ $*" | sed "s#$ROOT/##g"
  local rc=0
  "$@" >"$log" 2>&1 || rc=$?
  if [ "$rc" -ne 0 ]; then
    fail "exit $rc from: $* (see $log)"
    tail -n 5 "$log" >&2
  fi
  if grep -q "no property" "$log"; then
    fail "--data path without a property in: $* (see $log)"
    grep "no property" "$log" >&2
  fi
}

# shot <name> <args...>: a screenshot case for the current project
shot() {
  local name="$1"; shift
  run "$ev/$name.log" rive "$dir" --screenshot="$ev/$name.png" "$@"
}

# semantics <name> <args...>: an accessibility-tree case
semantics() {
  local name="$1"; shift
  run "$ev/$name.log" rive "$dir" --semantics="$ev/$name.semantics.json" "$@"
}

# dump <name> <args...>: a bound-data dump
dump() {
  local name="$1"; shift
  run "$ev/$name.log" rive "$dir" --data-dump="$ev/$name.data.json" "$@"
}

project_cases() {
  case "$1" in
    left-stick)
      shot idle --advance=1
      shot press --pointer=down@72,72 --advance=6
      shot held --data=stick/engaged=true --data=stick/x=0.7 --data=stick/y=-0.7 --advance=10
      shot released --pointer=down@72,72 --advance=6 --pointer=up@72,72 --advance=4
      shot drag --pointer='drag@72,72>100,44:12' --advance=10
      shot dpad --data=stick/mode=dpad --data=stick/engaged=true --data=stick/x=0.8 --data=stick/y=0.8 --advance=10
      shot reduced --data=a11y/reducedMotion=true --data=stick/engaged=true --advance=10
      shot gamepad --gamepad=connect --gamepad=button@dpadLeft:down --advance=10
      shot gamepad-release --gamepad=connect --gamepad=button@dpadLeft:down --advance=10 --gamepad=button@dpadLeft:up --advance=10
      shot a11y-increase "--semantic-action=increase@Movement stick" --advance=10
      semantics semantics-engaged --data=stick/engaged=true --data=stick/x=1 --advance=10
      dump data-held --data=stick/engaged=true --data=stick/x=0.7 --data=stick/y=-0.7 --advance=60 "--data-dump-filter=stick/*"
      ;;
    right-six)
      shot idle --advance=1
      shot press --pointer=down@108,98 --advance=6
      shot held --data=buttons/a/state=held --advance=10
      shot released --pointer=down@108,98 --advance=6 --pointer=up@108,98 --advance=3
      shot released-reduced --data=a11y/reducedMotion=true --pointer=down@108,98 --advance=6 --pointer=up@108,98 --advance=3
      shot chord --data=buttons/a/state=held --data=buttons/x/state=pressed --advance=10
      shot disabled --data=buttons/c/state=disabled --advance=10
      shot cooldown --data=buttons/z/state=cooldown --advance=10
      shot reduced --data=a11y/reducedMotion=true --data=buttons/b/state=pressed --advance=10
      shot labels --data=buttons/x/label=L1 --data=buttons/y/label=L2 --advance=1
      shot gamepad --gamepad=connect --gamepad=button@south:down --advance=6
      shot gamepad-up --gamepad=connect --gamepad=button@south:down --advance=6 --gamepad=button@south:up --advance=6
      shot a11y-tap --semantic-action=tap@A --advance=3
      semantics semantics-held --data=buttons/a/state=held --advance=10
      semantics semantics-states --data=buttons/c/state=disabled --data=buttons/z/state=cooldown --data=buttons/a/state=held --advance=10
      dump data-held --data=buttons/a/state=held --advance=60 "--data-dump-filter=buttons/*/state"
      ;;
    start-stop)
      shot start --advance=1
      shot playing --data=pill/state=playing --advance=10
      shot paused --data=pill/state=paused --advance=10
      shot stopConfirm --data=pill/state=stopConfirm --advance=36
      shot stopConfirm-full --data=pill/state=stopConfirm --data=pill/holdProgress=1 --advance=10
      shot holdProgress-half --viewport=512x208 --fit=contain --data=pill/state=stopConfirm --data=pill/holdProgress=0.5 --advance=10
      shot holdProgress-reduced-0.6 --viewport=512x208 --fit=contain --data=a11y/reducedMotion=true --data=pill/state=stopConfirm --data=pill/holdProgress=0.6 --advance=10
      shot press --pointer=down@64,26 --advance=6
      shot release --pointer=down@64,26 --advance=6 --pointer=up@64,26 --advance=6
      shot press-reduced --data=a11y/reducedMotion=true --pointer=down@64,26 --advance=6
      shot stopConfirm-reduced --data=a11y/reducedMotion=true --data=pill/state=stopConfirm --advance=2
      shot keyboard --key=enter --advance=6
      shot gamepad --gamepad=connect --gamepad=button@start:down --advance=6
      shot a11y-tap --semantic-action=tap@Start --advance=3
      semantics semantics-paused --data=pill/state=paused --advance=10
      dump data-paused --data=pill/state=paused --advance=60 --data-dump-filter=pill/state
      dump data-holdProgress --data=pill/state=stopConfirm --data=pill/holdProgress=0.5 --advance=60 "--data-dump-filter=pill/*"
      ;;
    leaderboard)
      shot ready --advance=1s
      shot loading --data=leaderboard/status=loading --advance=20
      shot loading-late --data=leaderboard/status=loading --advance=56
      shot empty --data=leaderboard/status=empty --advance=20
      shot stale --data=leaderboard/status=stale --advance=20
      shot error --data=leaderboard/status=error --advance=20
      shot unavailable --data=leaderboard/status=unavailable --advance=20
      shot reduced-loading --data=a11y/reducedMotion=true --data=leaderboard/status=loading --advance=2
      shot reduced-ready --data=a11y/reducedMotion=true --advance=2
      semantics semantics-empty --data=leaderboard/status=empty --advance=20
      dump data-rows --advance=60 "--data-dump-filter=leaderboard/*"
      ;;
    start-angled)
      shot idle-new --advance=1
      shot idle-continue --advance=1 --data=lobby/resume/eligible=true --data=lobby/resume/district=Harlem
      shot pressed --advance=1 --pointer=down@171,96 --advance=8
      shot activate --advance=1 --pointer=click@171,96 --advance=6
      shot loading --data=lobby/start/state=loading --advance=40
      shot disabled --data=lobby/start/state=disabled --advance=10
      shot daylit --data=theme/variant=daylit --advance=1s
      shot reduced --data=a11y/reducedMotion=true --advance=1s
      shot reduced-press --data=a11y/reducedMotion=true --advance=1 --pointer=down@171,96 --advance=8
      shot keyboard --advance=1 --key=enter --advance=6
      shot gamepad --advance=1 --gamepad=connect --gamepad=button@south:down --advance=6
      shot a11y-tap --advance=1 "--semantic-action=tap@Start a new game" --advance=3
      semantics semantics-disabled --data=lobby/start/state=disabled --advance=10
      semantics semantics-district --data=lobby/resume/eligible=true --data=lobby/resume/district=Harlem --advance=1s
      dump data-continue --data=lobby/resume/eligible=true --data=lobby/resume/district=Harlem --advance=60 "--data-dump-filter=lobby/*"
      ;;
    game-transition)
      shot enter --advance=6
      shot hold --data=transition/phase=hold --advance=1s
      shot hold-late --data=transition/phase=hold --advance=2s
      shot reveal-mid --data=transition/phase=reveal --advance=12
      shot done --data=transition/phase=done --advance=30
      shot reduced-hold --data=a11y/reducedMotion=true --data=transition/phase=hold --advance=1s
      shot reduced-reveal-mid --data=a11y/reducedMotion=true --data=transition/phase=reveal --advance=6
      shot daylit --data=theme/variant=daylit --data=transition/phase=hold --advance=1s
      dump data-reveal --data=transition/phase=reveal --advance=60 --data-dump-filter=transition/phase
      ;;
    game-lobby)
      shot portrait --data=transition/phase=done --advance=1s
      shot portrait-continue --data=transition/phase=done --data=lobby/resume/eligible=true --data=lobby/resume/district=Harlem --advance=1s
      shot landscape --data=transition/phase=done --data=layout/profile=phone-landscape --viewport=844x390 --advance=1s
      shot fold-book --data=transition/phase=done --data=layout/profile=fold-book --viewport=884x844 --advance=1s
      shot tablet --data=transition/phase=done --data=layout/profile=tablet --viewport=1024x768 --advance=1s
      shot rank-loading --data=transition/phase=done --data=leaderboard/status=loading --advance=20
      shot rank-unavailable --data=transition/phase=done --data=leaderboard/status=unavailable --advance=20
      shot start-pressed --data=transition/phase=done --advance=1s "--semantic-action=tap@Start a new game" --advance=6
      shot start-loading --data=transition/phase=done --data=lobby/start/state=loading --advance=40
      shot covered-hold --data=transition/phase=hold --advance=1s
      shot reveal-mid --data=transition/phase=reveal --advance=12
      shot daylit --data=transition/phase=done --data=theme/variant=daylit --advance=1s
      shot reduced --data=transition/phase=done --data=a11y/reducedMotion=true --advance=1s
      shot theme-fade-mid --data=transition/phase=done --data=theme/variant=daylit --advance=6
      shot theme-reduced-mid --data=transition/phase=done --data=a11y/reducedMotion=true --data=theme/variant=daylit --advance=6
      shot keyboard --data=transition/phase=done --advance=1s --key=enter --advance=6
      semantics semantics-continue --data=transition/phase=done --data=lobby/resume/eligible=true --advance=1s
      dump data-contract --data=transition/phase=done --advance=60 "--data-dump-filter=lobby/*,leaderboard/*,transition/*,theme/*,layout/*,a11y/*"
      ;;
  esac
}

selected=("${PROJECTS[@]}")
if [ $# -gt 0 ]; then
  selected=()
  for want in "$@"; do
    for p in "${PROJECTS[@]}"; do
      [ "$(basename "$p")" = "$want" ] && selected+=("$p")
    done
  done
  [ ${#selected[@]} -eq 0 ] && { echo "no such project: $*" >&2; exit 2; }
fi

echo "rive $(rive --version 2>&1 | tail -n 1)"
for p in "${selected[@]}"; do
  name="$(basename "$p")"
  dir="$RIVE_ROOT/$p"
  ev="$EVIDENCE/$name"
  mkdir -p "$ev"
  echo "== $name"
  run "$ev/verify.json" rive "$dir" --verify --format=json
  run "$ev/once.json" rive "$dir" --once --format=json
  run "$ev/test.json" rive "$dir" --test --format=json
  run "$ev/inspect-summary.json" rive inspect "$dir" --summary
  if ! grep -q '"problems": \[\]' "$ev/inspect-summary.json"; then
    fail "$name: inspect reports problems (see $ev/inspect-summary.json)"
  fi
  shot phone --viewport=844x390 --advance=1s
  shot narrow --viewport=320x700 --advance=1s
  semantics semantics --advance=1s
  dump data --advance=60
  run "$ev/build-data.log" rive "$dir" --data-dump --advance=60
  run "$ev/trace.log" rive "$dir" --data-dump="$ev/trace.jsonl" --data-dump-every=10 --advance=2s
  run "$ev/bench.log" rive "$dir" --bench=600
  project_cases "$name"
done

echo "== check-colors"
if ! node "$ROOT/scripts/rive/check-colors.mjs" | tee "$EVIDENCE/check-colors.log"; then
  fail "check-colors found an off-token colour"
fi

echo "== check-contract"
if [ ${#selected[@]} -eq ${#PROJECTS[@]} ]; then
  if ! bash "$ROOT/scripts/rive/check-contract.sh" 2>&1 | tee "$EVIDENCE/check-contract.log"; then
    fail "check-contract found a content or path-name problem (see $EVIDENCE/check-contract.log)"
  fi
else
  echo "skipped: runs only with all seven projects"
fi

if [ "$failures" -ne 0 ]; then
  echo "verify.sh: $failures failure(s)" >&2
  exit 1
fi
echo "verify.sh: ok (${#selected[@]} project(s), evidence in docs/evidence/rive)"
