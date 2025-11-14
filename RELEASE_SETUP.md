# Release Workflow Setup

This repository now has an automated release process using GitHub Actions.

## How It Works

1. Developers create PRs
2. CI runs checks (via `main_ci.yml`)
3. When CI is green, PRs can be merged to `main`
4. After several PRs are merged, a maintainer can manually trigger the release workflow
5. The workflow will:
   - Find the latest `web-api/*` tag
   - Automatically increment the patch version (e.g., `web-api/0.1.1` → `web-api/0.1.2`)
   - Collect all PRs merged since the last release
   - Create a release draft with all included PRs
   - Send a Slack notification with a spinner/pending status
   - Run the bundle creation script (currently simulated with `sleep 10s`)
   - Update Slack with success (green check) or failure (red X) status
   - Create the tag and release draft on GitHub

## Setup Instructions

### 1. Configure Slack Webhook

1. Go to your Slack workspace
2. Create an Incoming Webhook:
   - Visit https://api.slack.com/messaging/webhooks
   - Click "Create New App" → "From scratch"
   - Name it (e.g., "Release Bot") and select your workspace
   - Go to "Incoming Webhooks" and activate it
   - Click "Add New Webhook to Workspace"
   - Select the channel where you want notifications
   - Copy the webhook URL

3. Add the webhook URL to GitHub Secrets:
   - Go to your repository on GitHub
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SLACK_WEBHOOK_URL`
   - Value: Paste your webhook URL
   - Click "Add secret"

### 2. Trigger a Release

1. Go to your repository on GitHub
2. Click on the "Actions" tab
3. Select "Create Release" from the left sidebar
4. Click "Run workflow" button
5. Select the `main` branch
6. Click "Run workflow"

The workflow will:
- Automatically determine the next version number
- Create a draft release
- Send Slack notifications with build status
- You can then edit and publish the release draft when ready

## Release Tag Format

All releases use the format: `web-api/X.Y.Z`

Example progression:
- `web-api/0.0.1`
- `web-api/0.0.2`
- `web-api/0.1.0`
- `web-api/0.1.1`

The workflow automatically increments the patch version (Z) by default.

## Customizing the Bundle Script

Currently, the bundle creation step uses `sleep 10s` for testing. To use your actual bundle script:

1. Edit `.github/workflows/release.yml`
2. Find the "Create bundle" step
3. Replace the `sleep 10` command with your actual build/bundle commands

Example:
```yaml
- name: Create bundle
  id: bundle
  run: |
    echo "Creating bundle..."
    npm run build
    npm run package
    echo "Bundle created successfully!"
```

## Slack Notification Format

The Slack notifications include:
- Release version
- Build status (building/success/failed)
- List of all PRs included in the release
- Link to the release draft (on success) or workflow run (on failure)

## Troubleshooting

### No PRs found in release notes
- The workflow looks for merge commits with the pattern "Merge pull request #X from..."
- Ensure your PRs are being merged (not squashed) or adjust the PR detection logic

### Slack notifications not working
- Verify the `SLACK_WEBHOOK_URL` secret is set correctly
- Check that the webhook is active in your Slack workspace
- Look at the workflow logs for any error messages

### Version increment issues
- The workflow finds the latest tag matching `web-api/*` pattern
- Tags are sorted using version sort (`sort -V`)
- If no tags exist, it starts with `web-api/0.0.1`
