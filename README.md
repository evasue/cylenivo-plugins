# Cylenivo Plugins

Community connectors for [Cylenivo](https://cylenivo.org) — connect any project management tool to Cylenivo's flow metrics engine.

> **What is Cylenivo?** A local desktop app that turns your ticket data into Cycle Time, Lead Time, Throughput, and Monte Carlo delivery forecasts. No cloud, no accounts. → [cylenivo.org](https://cylenivo.org) · [GitHub](https://github.com/nobsagile/cylenivo)

---

## Available plugins

| Plugin | Description |
|---|---|
| [OpenProject](plugins/openproject/) | Import work packages from OpenProject (cloud or self-hosted) |

---

## Installing a plugin

1. Open Cylenivo → **Settings → Plugins**
2. Click **Browse plugins** to open the plugin registry
3. Install the plugin — no restart required
4. The connector appears in the **New Dataset** wizard

---

## Build your own plugin

A plugin is a single JavaScript file (`index.js`) + a `manifest.json` that describes its form fields. No build step, no framework — just plain ES module exports.

→ **[Plugin development guide](CONTRIBUTING.md)**

The two functions you implement:

```js
export async function test(credentials) {
  // validate credentials, return { ok: true, display_name: '...' }
}

export async function fetch(credentials, options, onProgress) {
  // fetch tickets with status transitions, return ImportFile
}
```

Cylenivo calculates all metrics from the `transitions` array — the more complete the history, the better the metrics.

**To contribute:** fork this repo, add your plugin under `plugins/your-tool/`, open a pull request.

---

## License

Plugins in this registry are individually licensed. See each plugin's directory for details.
