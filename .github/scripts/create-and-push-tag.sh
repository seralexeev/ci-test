#!/bin/bash
set -e

RELEASE_TAG="$1"

if [ -z "$RELEASE_TAG" ]; then
  echo "Usage: $0 <release_tag>"
  exit 1
fi

# Create the tag if it doesn't exist
if ! git rev-parse $RELEASE_TAG >/dev/null 2>&1; then
  echo "Creating tag ${RELEASE_TAG}..."
  git tag $RELEASE_TAG
  git push origin $RELEASE_TAG
  echo "Tag created and pushed"
else
  echo "Tag ${RELEASE_TAG} already exists"
fi
