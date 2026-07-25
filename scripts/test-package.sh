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

# Both installed names are the same CLI: the long ekohacks and the short eko. Each must be
# linked and answer usage from an outside project.
for bin in ekohacks eko; do
  if [ ! -x "./node_modules/.bin/$bin" ]; then
    echo "the packed package did not install a '$bin' bin"
    exit 1
  fi

  set +e
  output=$("./node_modules/.bin/$bin" 2>&1)
  status=$?
  set -e

  if [ "$status" -ne 2 ]; then
    echo "expected the usage exit code 2 from '$bin', got $status:"
    echo "$output"
    exit 1
  fi
  case "$output" in
    *"usage: ekohacks release"*) ;;
    *)
      echo "unexpected usage output from '$bin':"
      echo "$output"
      exit 1
      ;;
  esac

  echo "ok: the packed '$bin' bin answers its usage from an outside project"
done
