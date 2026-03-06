# OpenClaw Version Control

The template now supports flexible OpenClaw version control via the `OPENCLAW_VERSION` environment variable.

## How It Works

The Dockerfile reads the `OPENCLAW_VERSION` variable to determine which OpenClaw version to build:

- **If `OPENCLAW_VERSION` is set**: Uses that specific tag/branch (e.g., `v2026.2.15`)
- **If `OPENCLAW_VERSION` is not set**: Defaults to `main` branch (original behavior)

## Railway Configuration

To pin to a stable OpenClaw release on Railway:

1. Go to your Railway service → Variables
2. Add a new variable:
   - Name: `OPENCLAW_VERSION`
   - Value: `v2026.2.15` (or any valid Git tag/branch)
3. Redeploy the service

Railway automatically passes environment variables as build args, so no additional configuration is needed.

## Use Cases

### Pin to Stable Release (Recommended)
```
OPENCLAW_VERSION=v2026.2.15
```
Use this when the main branch is broken or to ensure consistent deployments.

### Use Latest Main (Default)
```
(Leave OPENCLAW_VERSION unset)
```
Automatically uses the latest main branch code. Good for testing but may break if main has issues.

### Test a Specific Branch
```
OPENCLAW_VERSION=feature-branch-name
```
Useful for testing unreleased features.

## Local Development

When building locally, override with:
```bash
docker build --build-arg OPENCLAW_VERSION=v2026.2.16 .
```

## Finding Available Versions

List all OpenClaw release tags:
```bash
git ls-remote --tags https://github.com/openclaw/openclaw.git | grep -v '\^{}' | sed 's|.*refs/tags/||'
```

## Current Recommendation

Set `OPENCLAW_VERSION=v2026.2.15` until the main branch is confirmed stable, then you can remove the variable to auto-track main.
