# Building a Cylenivo Plugin

← [Back to plugin registry](README.md) · [Cylenivo on GitHub](https://github.com/nobsagile/cylenivo) · [cylenivo.org](https://cylenivo.org)

A Cylenivo plugin is a plain JavaScript file that connects any project management tool to Cylenivo's metric engine. No build step required.

## Plugin structure

```
plugins/your-tool/
  manifest.json   ← describes the plugin and its form fields
  index.js        ← the connector logic
  README.md       ← usage instructions
```

## manifest.json

```json
{
  "source_type": "your-tool",
  "name": "Your Tool",
  "version": "1.0.0",
  "description": "Short description shown in the plugin browser",
  "author": "your-github-username",
  "credentials": [
    { "key": "base_url", "label": "Server URL", "type": "url", "placeholder": "https://..." },
    { "key": "api_token", "label": "API Token", "type": "password" }
  ],
  "fetch_options": [
    { "key": "project", "label": "Project", "type": "string", "required": true },
    { "key": "limit", "label": "Max Items", "type": "number", "default": 100 }
  ]
}
```

### Field types

| type | UI |
|---|---|
| `string` | Text input |
| `password` | Masked input |
| `url` | URL input |
| `number` | Number input |

## index.js

Your plugin must export two async functions:

```js
/**
 * Validate credentials. Called when user clicks "Test Connection".
 * @param {Record<string, string>} credentials — keys match manifest.credentials[].key
 * @returns {{ ok: boolean, display_name?: string }}
 * @throws {Error} with a user-readable message on failure
 */
export async function test(credentials) {
  // call your API to validate
  return { ok: true, display_name: 'User Name' }
}

/**
 * Fetch tickets with status transitions.
 * @param {Record<string, string>} credentials
 * @param {Record<string, unknown>} options — keys match manifest.fetch_options[].key
 * @param {(current: number, total: number, key: string) => void} onProgress
 * @returns {ImportFile}
 */
export async function fetch(credentials, options, onProgress) {
  // fetch your data...
  onProgress(1, 10, 'TICKET-1')

  return {
    source_type: 'your-tool',   // must match manifest source_type
    project_key: options.project,
    exported_at: new Date().toISOString(),
    tickets: [
      {
        external_id: 'TICKET-1',          // unique ID in your system
        title: 'My ticket',
        ticket_type: 'story',             // 'story' | 'task' | 'bug' | 'epic'
        created_at: '2024-01-01T00:00:00.000Z',
        external_link: 'https://...',     // optional: link back to the ticket
        transitions: [
          { from_status: null, to_status: 'Todo', transitioned_at: '2024-01-01T00:00:00.000Z' },
          { from_status: 'Todo', to_status: 'Done', transitioned_at: '2024-01-05T00:00:00.000Z' },
        ],
      },
    ],
  }
}
```

### The ImportFile format

| Field | Type | Description |
|---|---|---|
| `source_type` | string | Must match your manifest |
| `project_key` | string | Project identifier |
| `exported_at` | ISO timestamp | When the export ran |
| `tickets` | array | See below |

Each ticket:

| Field | Type | Required |
|---|---|---|
| `external_id` | string | Yes — unique in your system |
| `title` | string | Yes |
| `ticket_type` | `'story'\|'task'\|'bug'\|'epic'` | Yes |
| `created_at` | ISO timestamp | Yes |
| `external_link` | string | No |
| `transitions` | array | Yes (can be empty) |

Each transition:

| Field | Type | Description |
|---|---|---|
| `from_status` | string \| null | null for the first/initial status |
| `to_status` | string | The status transitioned to |
| `transitioned_at` | ISO timestamp | When the transition happened |

> **Tip:** Status transitions are the most important data. Cylenivo calculates Cycle Time, Lead Time, and Time in Status entirely from these timestamps. The more complete the transition history, the better the metrics.

## Testing locally

```bash
# Test credentials
echo '{"credentials":{"base_url":"https://...","api_token":"..."}}' | node index.js

# Fetch tickets
echo '{"credentials":{...},"options":{"project":"my-project","limit":5}}' | node index.js
```

Your plugin uses ES module exports (`export async function`). Use Node 18+ or Bun.

## Submitting your plugin

1. Fork this repo
2. Add your plugin under `plugins/your-tool/`
3. Open a pull request

We review for basic quality (API usage, error handling, README) before merging into the official registry.
