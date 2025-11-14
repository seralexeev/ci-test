#!/bin/bash
set -e

# Get the latest tag matching web-api/*
LATEST_TAG=$(git tag -l "web-api/*" | sort -V | tail -n 1)

if [ -z "$LATEST_TAG" ]; then
  echo "Error: No previous tag found matching web-api/*"
  echo "Please create the first tag manually (e.g., web-api/0.0.1)"
  exit 1
fi

# Extract version number and increment patch
VERSION=${LATEST_TAG#web-api/}
IFS='.' read -r -a VERSION_PARTS <<< "$VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Increment patch version
PATCH=$((PATCH + 1))
NEXT_VERSION="${MAJOR}.${MINOR}.${PATCH}"
NEXT_TAG="web-api/${NEXT_VERSION}"

# Output to GitHub Actions
echo "latest_tag=${LATEST_TAG}" >> $GITHUB_OUTPUT
echo "next_version=${NEXT_VERSION}" >> $GITHUB_OUTPUT
echo "next_tag=${NEXT_TAG}" >> $GITHUB_OUTPUT

echo "Latest tag: ${LATEST_TAG}"
echo "Next version: ${NEXT_VERSION}"
echo "Next tag: ${NEXT_TAG}"
