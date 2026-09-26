#!/bin/sh
# Runs .githooks/commit-msg against every commit message in base..head, so a
# commit made without the hook enabled is still caught (CI job "Commit
# messages"). Needs full history (actions/checkout with fetch-depth: 0).
#
#   scripts/check-commit-messages.sh <base> <head>
#
# base is the pull request's base commit, or the commit a push replaced
# (github.event.before). It may be empty or all zeros (the first push of a
# branch), or no longer an ancestor of head (a force push); then the check
# falls back to the commits since the merge base with the old tip, or with the
# default branch, or failing both to the whole history of head.
set -eu

base=${1:-}
head=${2:-HEAD}
hook=$(dirname "$0")/../.githooks/commit-msg
default_branch=${DEFAULT_BRANCH:-main}

is_commit() {
  [ -n "$1" ] && git cat-file -e "$1^{commit}" 2>/dev/null
}

case "$base" in
  '' | *[!0]*) ;;
  *) base= ;; # 0000... : a branch pushed for the first time
esac

# A force push leaves the old tip unreferenced; try to fetch it by id.
if [ -n "$base" ] && ! is_commit "$base"; then
  git fetch --quiet --no-tags origin "$base" 2>/dev/null || true
fi

range=
if is_commit "$base"; then
  if git merge-base --is-ancestor "$base" "$head"; then
    range="$base..$head"
  elif mb=$(git merge-base "$base" "$head"); then
    echo "note: $base is not an ancestor of $head (force push); checking commits since their merge base"
    range="$mb..$head"
  fi
fi
if [ -z "$range" ] && is_commit "origin/$default_branch" && [ "$(git rev-parse "$head")" != "$(git rev-parse "origin/$default_branch")" ]; then
  mb=$(git merge-base "origin/$default_branch" "$head" || true)
  if [ -n "$mb" ] && [ "$mb" != "$(git rev-parse "$head")" ]; then
    echo "note: no usable base; checking commits since origin/$default_branch"
    range="$mb..$head"
  fi
fi
if [ -z "$range" ]; then
  echo "note: no usable base; checking the whole history of $head"
  range=$head
fi

msg=$(mktemp)
trap 'rm -f "$msg"' EXIT
checked=0
failed=0
for c in $(git rev-list "$range"); do
  checked=$((checked + 1))
  git log -1 --format=%B "$c" > "$msg"
  if ! sh "$hook" "$msg" 2>/dev/null; then
    failed=$((failed + 1))
    subject=$(git log -1 --format=%s "$c")
    echo "::error title=Commit message rejected::$(git rev-parse --short "$c") \"$subject\" is rejected by .githooks/commit-msg (AI/tool attribution); reword it (git rebase -i) and push again"
  fi
done

echo "checked $checked commit message(s) in $range: $failed rejected"
[ "$failed" -eq 0 ]
