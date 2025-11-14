#!/bin/bash
set -e

NEXT_TAG="$1"
NEXT_VERSION="$2"
LATEST_TAG="$3"

if [ -z "$NEXT_TAG" ] || [ -z "$NEXT_VERSION" ] || [ -z "$LATEST_TAG" ]; then
  echo "Usage: $0 <next_tag> <next_version> <latest_tag>"
  exit 1
fi

# Generate release notes using GitHub API
NOTES=$(gh api repos/{owner}/{repo}/releases/generate-notes \
  -f tag_name="$NEXT_TAG" \
  -f target_commitish="main" \
  -f previous_tag_name="$LATEST_TAG" \
  --jq '.body')

# Check if draft release already exists
EXISTING_DRAFT=$(gh release view ${NEXT_TAG} --json isDraft --jq '.isDraft' 2>/dev/null || echo "false")

if [ "$EXISTING_DRAFT" = "true" ]; then
  echo "Updating existing draft release for ${NEXT_TAG}..."
  gh release edit ${NEXT_TAG} \
    --draft \
    --title "Release ${NEXT_VERSION}" \
    --notes "$NOTES"
  echo "Draft release updated"
else
  echo "Creating new draft release for ${NEXT_TAG}..."
  # Delete if exists (in case there's a non-draft release)
  gh release delete ${NEXT_TAG} --yes 2>/dev/null || true
  git tag -d ${NEXT_TAG} 2>/dev/null || true
  git push origin :refs/tags/${NEXT_TAG} 2>/dev/null || true

  # Create draft with generated notes
  gh release create ${NEXT_TAG} \
    --draft \
    --title "Release ${NEXT_VERSION}" \
    --notes "$NOTES" \
    --target main
  echo "Draft release created"
fi

RELEASE_URL="https://github.com/${GITHUB_REPOSITORY}/releases/tag/${NEXT_TAG}"

echo "=================================="
echo "✓ Release Draft Updated"
echo "=================================="
echo "Next Version: ${NEXT_TAG}"
echo "Release URL: ${RELEASE_URL}"
echo "=================================="
