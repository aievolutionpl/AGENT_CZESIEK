#!/usr/bin/env bash
set -euo pipefail

if state=$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json isDraft --jq .isDraft); then
  if [[ "$state" != true ]]; then
    echo "Refusing to change published release $TAG" >&2
    exit 1
  fi

  gh release edit "$TAG" --repo "$GITHUB_REPOSITORY" --notes-file notes.md
  gh release upload "$TAG" staging/* --repo "$GITHUB_REPOSITORY" --clobber
else
  gh release create "$TAG" \
    --repo "$GITHUB_REPOSITORY" \
    --target "$GITHUB_SHA" \
    --title "Agent Czesiek v${VERSION}" \
    --notes-file notes.md \
    --draft
  gh release upload "$TAG" staging/* --repo "$GITHUB_REPOSITORY"
fi
