# Trello Plugin for Cylenivo

Import cards from a Trello board and analyze Cycle Time, Lead Time, and Throughput based on how cards move between lists.

**How it works:** Each Trello list is a workflow status. When a card moves from one list to another, that's a status transition — exactly what Cylenivo uses to calculate Cycle Time.

## Setup

### 1. Get your API Key

1. Go to https://trello.com/power-ups/admin
2. Click **New** (or select an existing Power-Up)
3. Copy the **API Key** shown on the page

### 2. Generate an API Token

Open this URL in your browser (replace `YOUR_API_KEY`):

```
https://trello.com/1/authorize?expiration=never&scope=read&response_type=token&name=Cylenivo&key=YOUR_API_KEY
```

Click **Allow** → copy the token shown on the next page.

### 3. Find your Board ID

Open your Trello board in the browser. The URL looks like:

```
https://trello.com/b/ABC123de/my-board-name
                    ^^^^^^^^
                    This is your Board ID
```

Copy the short code between `/b/` and the board name.

## Configuration in Cylenivo

| Field | Value |
|---|---|
| API Key | Your API key from step 1 |
| API Token | Your token from step 2 |
| Board ID | The short code from step 3 |
| Max cards | How many cards to import (default: 200) |

## Notes

- **Archived cards are included** — Cylenivo imports the full history, including cards that have been archived. This gives you accurate throughput and cycle time data.
- **All lists are included** — including archived lists. Configure your Cycle Time start/end statuses in Cylenivo to match your workflow.
- **Card type** is set to "story" for all cards. Trello has no native card types.
