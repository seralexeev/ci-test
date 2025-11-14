#!/bin/bash
set -e

NEXT_TAG="$1"
NEXT_VERSION="$2"
LATEST_TAG="$3"

if [ -z "$NEXT_TAG" ] || [ -z "$NEXT_VERSION" ]; then
  echo "Usage: $0 <next_tag> <next_version> <latest_tag>"
  exit 1
fi

# Delete existing draft release and tag if they exist
echo "Checking for existing draft release for ${NEXT_TAG}..."
gh release delete ${NEXT_TAG} --yes 2>/dev/null || true
git tag -d ${NEXT_TAG} 2>/dev/null || true
git push origin :refs/tags/${NEXT_TAG} 2>/dev/null || true

# Create new draft with auto-generated notes
echo "Creating draft release for ${NEXT_TAG}..."

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

RELEASE_URL="https://github.com/${GITHUB_REPOSITORY}/releases/tag/${NEXT_TAG}"

echo "=================================="
echo "✓ Release Draft Updated"
echo "=================================="
echo "Next Version: ${NEXT_TAG}"
echo "Release URL: ${RELEASE_URL}"
echo "=================================="
