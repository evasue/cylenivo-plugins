/**
 * Cylenivo plugin — Trello
 * Imports cards from a Trello board with full list-transition history.
 * Lists = workflow statuses. Card moves between lists = status transitions.
 *
 * Interface: exports test() and fetch() — loaded by Cylenivo via dynamic import.
 */

const BASE = 'https://api.trello.com/1'
const MAX_RETRIES = 3
const CONCURRENCY = 10

async function trelloGet(path, key, token, attempt = 0) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await globalThis.fetch(`${BASE}${path}${sep}key=${key}&token=${token}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })

  if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
    if (attempt >= MAX_RETRIES) throw new Error(`Trello API ${res.status} on ${path} (gave up after ${MAX_RETRIES} retries)`)
    const retryAfter = res.headers.get('Retry-After')
    const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * Math.pow(2, attempt)
    await new Promise(r => setTimeout(r, delay))
    return trelloGet(path, key, token, attempt + 1)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Trello API ${res.status} on ${path}: ${body}`)
  }
  return res.json()
}

/** Decode card creation time from Trello's object ID (first 4 bytes = Unix timestamp). */
function cardCreatedAt(id) {
  return new Date(parseInt(id.substring(0, 8), 16) * 1000).toISOString()
}

function buildTransitions(actions, listMap, card) {
  const transitions = []

  for (const action of actions) {
    if (action.type === 'createCard') {
      const listName = action.data?.list?.name ?? listMap[card.idList] ?? 'Unknown'
      transitions.push({ from_status: null, to_status: listName, transitioned_at: action.date })
    } else if (action.type === 'updateCard' && action.data?.listBefore && action.data?.listAfter) {
      transitions.push({
        from_status: action.data.listBefore.name,
        to_status: action.data.listAfter.name,
        transitioned_at: action.date,
      })
    }
  }

  // If no createCard action found, synthesise an initial transition from card creation time
  if (!transitions.some(t => t.from_status === null)) {
    const listName = listMap[card.idList] ?? 'Unknown'
    transitions.unshift({ from_status: null, to_status: listName, transitioned_at: cardCreatedAt(card.id) })
  }

  return transitions.sort((a, b) => new Date(a.transitioned_at) - new Date(b.transitioned_at))
}

// ── Exported plugin interface ────────────────────────────────────────────────

export async function test(credentials) {
  const { api_key, api_token } = credentials
  if (!api_key || !api_token) throw new Error('api_key and api_token are required')
  const data = await trelloGet('/members/me', api_key, api_token)
  return { ok: true, display_name: data.fullName ?? data.username }
}

export async function fetch(credentials, options, onProgress) {
  const { api_key, api_token } = credentials
  const board = (options.board ?? '').trim()
  const limit = Number(options.limit ?? 200)

  if (!board) throw new Error('board ID is required')

  // 1. Load all lists (= statuses)
  const lists = await trelloGet(`/boards/${board}/lists?filter=all`, api_key, api_token)
  const listMap = Object.fromEntries(lists.map(l => [l.id, l.name]))

  // 2. Load cards (including archived)
  const cards = await trelloGet(`/boards/${board}/cards?filter=all&limit=${limit}`, api_key, api_token)
  const boardName = cards[0]?.idBoard ?? board

  // 3. Fetch actions per card in parallel (10 concurrent workers)
  const results = new Array(cards.length).fill(null)
  let completed = 0
  const queue = cards.map((_, i) => i)

  const workers = Array.from({ length: Math.min(CONCURRENCY, cards.length) }, async () => {
    while (queue.length > 0) {
      const i = queue.shift()
      const card = cards[i]
      try {
        const actions = await trelloGet(
          `/cards/${card.id}/actions?filter=createCard,updateCard:idList&limit=1000`,
          api_key,
          api_token
        )
        results[i] = {
          external_id: `${card.idShort}`,
          title: card.name,
          ticket_type: 'story',
          created_at: cardCreatedAt(card.id),
          external_link: card.shortUrl,
          transitions: buildTransitions(actions, listMap, card),
        }
      } catch (e) {
        console.warn(`[trello] skipping card ${card.idShort}: ${e.message}`)
      }
      completed++
      onProgress(completed, cards.length, String(card.idShort))
    }
  })

  await Promise.all(workers)

  return {
    source_type: 'trello',
    project_key: board,
    exported_at: new Date().toISOString(),
    tickets: results.filter(Boolean),
  }
}
