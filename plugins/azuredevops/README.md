# Cylenivo Plugin — Azure DevOps

Imports Product Backlog Items with status transitions from [Azure DevOps](https://dev.azure.com) Cloud.

## Setup

1. In Cylenivo: **Settings → Plugins → Install** (or install from the plugin browser)
2. Go to **Connections → Add Connection → Azure DevOps**
3. Enter your organization name and a Personal Access Token

## Getting a Personal Access Token (PAT)

1. Log into [dev.azure.com](https://dev.azure.com)
2. Click your avatar (top right) → **Personal Access Tokens**
3. Click **New Token**
4. Set a name, expiry, and select the scope **Work Items → Read**
5. Copy the generated token — it won't be shown again

## Configuration

| Field | Description |
|---|---|
| Organization | Your organization name from the URL: `dev.azure.com/{organization}` |
| Personal Access Token | PAT with Work Items (Read) scope |
| Project | Project name as shown in Azure DevOps |
| Area Path | Optional. Filters by area path prefix, e.g. `MyProject\MyTeam`. Leave empty for all areas. |
| Max Items | Maximum number of work packages to fetch (default: 100) |

## What gets imported

- All **Product Backlog Items** in the selected project (and area path, if specified)
- Full **System.State transition history** per item, parsed from the update log
- Each item links back to the work item in Azure DevOps

## Notes

- Status transitions come from the work item's revision history. If a state was set and immediately changed in the same revision, only the final state for that revision will appear.
- The Area Path filter uses `UNDER` semantics — it includes all sub-areas beneath the given path.
- Large projects: increase Max Items as needed.

## Local testing

```bash
# Test credentials
echo '{"command":"test","credentials":{"organization":"myorg","pat":"your-pat"}}' \
  | node index.js

# Fetch items
echo '{"command":"fetch","credentials":{"organization":"myorg","pat":"your-pat"},"options":{"project":"MyProject","area_path":"MyProject\\MyTeam","limit":10}}' \
  | node index.js
```

> Requires Node 18+ or Bun (ES module exports).
