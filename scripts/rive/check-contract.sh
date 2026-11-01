#!/usr/bin/env bash
# Content checks for the Rive builds (finding M17). verify.sh runs it after
# the captures; it also runs alone:
#
#   scripts/rive/check-contract.sh                  # both checks
#   scripts/rive/check-contract.sh semantics        # semantics dumps only
#   scripts/rive/check-contract.sh paths            # path-name diff only
#   scripts/rive/check-contract.sh paths --data start-stop=/tmp/old.data.json
#
# semantics: over docs/evidence/rive/<project>/semantics*.semantics.json,
#   right-six has exactly one `button` per cap (6), left-stick has a
#   `slider`, every interactive node (button, slider, link, checkbox,
#   switchControl, textField, radioButton, tab) is at least 44 x 44, and no
#   `text` node has an empty label.
# paths: every View Model path the TS bindings write must exist in the
#   matching packages/ui/rive/<group>/<project>/build/<project>.data.json.
#   The arcade leg (packages/ui/game-controls/rive-binding.ts) is a hard
#   failure. The lobby leg (packages/ui/lobby/lobby-rive-binding.ts) is
#   report-only: its list rows are moving to listProperty with item-relative
#   paths, so a row path is compared by its item property name, and a miss
#   prints WARN without failing.
#
# Exit 1 on any hard failure. Needs jq.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EVIDENCE="${RIVE_EVIDENCE:-$ROOT/docs/evidence/rive}"
RIVE_ROOT="$ROOT/packages/ui/rive"
ARCADE_TS="$ROOT/packages/ui/game-controls/rive-binding.ts"
LOBBY_TS="$ROOT/packages/ui/lobby/lobby-rive-binding.ts"
BUTTON_IDS=(x y z a b c)
MIN_TARGET=44

if ! command -v jq >/dev/null 2>&1; then
  echo "FAIL: check-contract.sh needs jq on PATH" >&2
  exit 1
fi

failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
warn() { echo "WARN: $*" >&2; }

# data.json per project; --data <project>=<file> overrides one. Plain
# variables, not an associative array: macOS ships bash 3.2.
OVERRIDES=""
data_file() {
  local o
  for o in $OVERRIDES; do
    [ "${o%%=*}" = "$1" ] && { echo "${o#*=}"; return; }
  done
  case "$1" in
    left-stick|right-six|start-stop) echo "$RIVE_ROOT/arcade-controls/$1/build/$1.data.json" ;;
    *) echo "$RIVE_ROOT/lobby/$1/build/$1.data.json" ;;
  esac
}

mode="all"
while [ $# -gt 0 ]; do
  case "$1" in
    semantics|paths|all) mode="$1" ;;
    --data) shift; OVERRIDES="$OVERRIDES $1" ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

check_semantics() {
  echo "== semantics content"
  local f n
  for f in "$EVIDENCE"/*/semantics*.semantics.json; do
    [ -f "$f" ] || continue
    local rel="${f#$ROOT/}"
    local small
    small="$(jq -r --argjson min "$MIN_TARGET" '
      .. | objects | select(has("role") and has("bounds"))
      | select(.role | IN("button","slider","link","checkbox","switchControl","textField","radioButton","tab"))
      | select(.bounds.width < $min or .bounds.height < $min)
      | "\(.role) \"\(.label)\" \(.bounds.width)x\(.bounds.height)"' "$f")"
    [ -n "$small" ] && fail "$rel: interactive node under ${MIN_TARGET}x${MIN_TARGET}: $small"
    n="$(jq '[.. | objects | select(.role == "text" and (.label // "") == "")] | length' "$f")"
    [ "$n" -ne 0 ] && fail "$rel: $n text node(s) with an empty label"
  done
  for f in "$EVIDENCE"/right-six/semantics*.semantics.json; do
    [ -f "$f" ] || continue
    n="$(jq '[.. | objects | select(.role == "button")] | length' "$f")"
    [ "$n" -eq 6 ] || fail "${f#$ROOT/}: $n button node(s), want 6 (one per cap)"
  done
  for f in "$EVIDENCE"/left-stick/semantics*.semantics.json; do
    [ -f "$f" ] || continue
    n="$(jq '[.. | objects | select(.role == "slider")] | length' "$f")"
    [ "$n" -ge 1 ] || fail "${f#$ROOT/}: no slider node for the stick"
  done
}

# paths_in <data.json>: every "path" the dump declares, one per line
paths_in() { jq -r '.. | objects | select(has("path")) | .path' "$1"; }

# literal paths inside `export const <NAME> = { ... } as const;` of a TS file
ts_block() {
  sed -n "/export const $2 = {/,/} as const;/p" "$1"
}

arcade_paths() {
  local block id
  block="$(ts_block "$ARCADE_TS" ARCADE_VM_PATHS)"
  printf '%s\n' "$block" | grep -oE "'[a-z0-9]+(/[A-Za-z0-9]+)+'" | tr -d "'"
  for t in $(printf '%s\n' "$block" | grep -oE '`buttons/\$\{id\}/[A-Za-z]+`' | tr -d '`'); do
    for id in "${BUTTON_IDS[@]}"; do printf '%s\n' "${t/\$\{id\}/$id}"; done
  done
}

# arcade path -> project whose artboard owns it
arcade_owner() {
  case "$1" in
    stick/*) echo left-stick ;;
    buttons/*) echo right-six ;;
    pill/*) echo start-stop ;;
    a11y/*) echo "left-stick right-six start-stop" ;;
    *) echo "" ;;
  esac
}

lobby_owner() {
  case "$1" in
    lobby/*) echo start-angled ;;
    leaderboard/*) echo leaderboard ;;
    transition/*) echo game-transition ;;
    theme/*|layout/*|a11y/*) echo game-lobby ;;
    *) echo "" ;;
  esac
}

check_paths() {
  echo "== path names: arcade (hard)"
  local p owner proj file count=0
  [ -f "$ARCADE_TS" ] || { fail "missing $ARCADE_TS"; return; }
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    owner="$(arcade_owner "$p")"
    [ -n "$owner" ] || { fail "arcade path $p has no owning artboard in check-contract.sh"; continue; }
    for proj in $owner; do
      file="$(data_file "$proj")"
      if [ ! -f "$file" ]; then fail "$proj: no data dump at ${file#$ROOT/}"; continue; fi
      count=$((count + 1))
      paths_in "$file" | grep -qxF "$p" || fail "arcade path $p missing from ${file#$ROOT/}"
    done
  done < <(arcade_paths | sort -u)
  echo "arcade: $count path/artboard pair(s) checked"

  echo "== path names: lobby (report-only)"
  if [ ! -f "$LOBBY_TS" ]; then warn "missing $LOBBY_TS"; return; fi
  local block lit item rowprops misses=0 lcount=0
  block="$(ts_block "$LOBBY_TS" LOBBY_VM_PATHS)"
  [ -n "$block" ] || block="$(cat "$LOBBY_TS")"
  while IFS= read -r lit; do
    [ -n "$lit" ] || continue
    owner="$(lobby_owner "$lit")"
    [ -n "$owner" ] || continue
    file="$(data_file "$owner")"
    [ -f "$file" ] || { warn "$owner: no data dump at ${file#$ROOT/}"; continue; }
    lcount=$((lcount + 1))
    if [[ "$lit" == *'['* ]]; then
      # list row: compare the item property name with the list's item properties
      item="${lit##*/}"
      rowprops="$(paths_in "$file" | sed -nE 's#^leaderboard/rows\[[0-9]+\]/##p' | sort -u)"
      printf '%s\n' "$rowprops" | grep -qxF "$item" \
        || { warn "lobby row property $item missing from ${file#$ROOT/}"; misses=$((misses + 1)); }
    else
      paths_in "$file" | grep -qxF "$lit" \
        || { warn "lobby path $lit missing from ${file#$ROOT/}"; misses=$((misses + 1)); }
    fi
  done < <(printf '%s\n' "$block" \
            | grep -oE "['\`][a-z]+(/[]A-Za-z0-9\${}[]+)+['\`]" | tr -d "'\`" | sort -u)
  echo "lobby: $lcount path(s) checked, $misses miss(es) (report-only)"
}

case "$mode" in
  semantics) check_semantics ;;
  paths) check_paths ;;
  all) check_semantics; check_paths ;;
esac

if [ "$failures" -ne 0 ]; then
  echo "check-contract.sh: $failures failure(s)" >&2
  exit 1
fi
echo "check-contract.sh: ok ($mode)"
