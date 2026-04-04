# Cylenivo Plugin — OpenProject

Imports work packages with status transitions from [OpenProject](https://www.openproject.org/) — works with both cloud instances and self-hosted Community Edition.

## Setup

1. In Cylenivo: **Settings → Plugins → Install** (or install from the plugin browser)
2. Go to **Connections → Add Connection → OpenProject**
3. Enter your server URL and API token

## Getting an API token

1. Log into OpenProject
2. Click your avatar → **My Account**
3. Go to **Access Tokens → API**
4. Click **Generate** and copy the token

## Configuration

| Field | Description |
|---|---|
| Server URL | Your OpenProject instance, e.g. `https://yourcompany.openproject.com` |
| API Token | Personal API token (see above) |
| Project Identifier | The slug in your project URL: `/projects/{identifier}` |
| Max Items | Maximum number of work packages to fetch (default: 100) |

## What gets imported

- All work packages in the project (all types, all statuses)
- Full status transition history per work package
- Work package type mapped to: `story`, `task`, `bug`, or `epic`

## Notes

- Status transitions are parsed from activity history — rapid consecutive changes within ~10 minutes may be aggregated by OpenProject into a single activity
- Large projects: increase Max Items as needed (no hard limit)

## Local testing

```bash
echo '{"command":"test","credentials":{"base_url":"https://your.openproject.com","api_token":"your-token"}}' \
  | node index.js

echo '{"command":"fetch","credentials":{"base_url":"https://your.openproject.com","api_token":"your-token"},"options":{"project":"my-project","limit":10}}' \
  | node index.js
```

> Note: the plugin uses ES module exports (`export async function`), so test it with Node 18+ or Bun.
