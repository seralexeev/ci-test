#!/bin/bash
set -e

NEXT_TAG="$1"
NEXT_VERSION="$2"
LATEST_TAG="$3"

if [ -z "$NEXT_TAG" ] || [ -z "$NEXT_VERSION" ]; then
  echo "Usage: $0 <next_tag> <next_version> <latest_tag>"
  exit 1
fi

# Check if draft release already exists
EXISTING_DRAFT=$(gh release view ${NEXT_TAG} --json isDraft --jq '.isDraft' 2>/dev/null || echo "false")

if [ "$EXISTING_DRAFT" = "true" ]; then
  echo "Updating existing draft release for ${NEXT_TAG}..."

  # Generate notes and update the draft
  if [ -z "$LATEST_TAG" ]; then
    # No previous tag, generate notes from the beginning
    gh release edit ${NEXT_TAG} \
      --draft \
      --title "Release ${NEXT_VERSION}" \
      --generate-notes
  else
    # Generate notes since the last tag
    gh release edit ${NEXT_TAG} \
      --draft \
      --title "Release ${NEXT_VERSION}" \
      --notes-start-tag "${LATEST_TAG}" \
      --generate-notes
  fi
  echo "Draft release updated with auto-generated notes"
else
  echo "Creating new draft release for ${NEXT_TAG}..."
  # Delete the tag if it exists (in case there's a non-draft release)
  gh release delete ${NEXT_TAG} --yes 2>/dev/null || true
  git tag -d ${NEXT_TAG} 2>/dev/null || true
  git push origin :refs/tags/${NEXT_TAG} 2>/dev/null || true

  # Create draft with auto-generated notes
  if [ -z "$LATEST_TAG" ]; then
    gh release create ${NEXT_TAG} \
      --draft \
      --title "Release ${NEXT_VERSION}" \
      --generate-notes \
      --target main
  else
    gh release create ${NEXT_TAG} \
      --draft \
      --title "Release ${NEXT_VERSION}" \
      --notes-start-tag "${LATEST_TAG}" \
      --generate-notes \
      --target main
  fi
  echo "Draft release created with auto-generated notes"
fi

RELEASE_URL="https://github.com/${GITHUB_REPOSITORY}/releases/tag/${NEXT_TAG}"

echo "=================================="
echo "✓ Release Draft Updated"
echo "=================================="
echo "Next Version: ${NEXT_TAG}"
echo "Release URL: ${RELEASE_URL}"
echo "=================================="
