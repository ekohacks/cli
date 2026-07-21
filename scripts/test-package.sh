#!/usr/bin/env bash
# The consumer smoke: pack the tarball, install it into a project outside the repo, and
# prove the packed bin runs. The usage path loads every emitted module, so answering
# usage from the packed artefact is the whole-package proof.
set -euo pipefail

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

tarball=$(npm pack --pack-destination "$work" --silent | tail -n 1)

cd "$work"
npm init -y >/dev/null 2>&1
npm install --no-audit --no-fund --silent "./$tarball" >/dev/null

set +e
output=$(./node_modules/.bin/ekohacks 2>&1)
status=$?
set -e

if [ "$status" -ne 2 ]; then
  echo "expected the usage exit code 2, got $status:"
  echo "$output"
  exit 1
fi
case "$output" in
  *"usage: ekohacks release"*) ;;
  *)
    echo "unexpected usage output:"
    echo "$output"
    exit 1
    ;;
esac

echo "ok: the packed ekohacks bin answers its usage from an outside project"
