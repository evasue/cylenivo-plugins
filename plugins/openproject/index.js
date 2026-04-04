/**
 * Cylenivo plugin — OpenProject
 * Imports work packages with status transitions from OpenProject (cloud or self-hosted).
 *
 * Interface: exports test() and fetch() — loaded by Cylenivo via dynamic import.
 */

function authHeader(apiToken) {
  return 'Basic ' + Buffer.from(`apikey:${apiToken}`).toString('base64')
}

async function opGet(baseUrl, apiToken, path) {
  const res = await fetch(`${baseUrl}/api/v3${path}`, {
    headers: { Authorization: authHeader(apiToken), Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenProject API ${res.status} on ${path}: ${body}`)
  }
  return res.json()
}

async function fetchWorkPackages(baseUrl, apiToken, projectId, limit) {
  const all = []
  const pageSize = 100
  let offset = 1
  while (all.length < limit) {
    const batch = Math.min(pageSize, limit - all.length)
    const data = await opGet(baseUrl, apiToken, `/projects/${projectId}/work_packages?pageSize=${batch}&offset=${offset}`)
    const items = data._embedded?.elements ?? []
    all.push(...items)
    if (all.length >= data.total || items.length === 0) break
    offset += items.length
  }
  return all.slice(0, limit)
}

async function fetchActivities(baseUrl, apiToken, wpId) {
  const all = []
  let offset = 1
  while (true) {
    const data = await opGet(baseUrl, apiToken, `/work_packages/${wpId}/activities?pageSize=100&offset=${offset}`)
    const items = data._embedded?.elements ?? []
    all.push(...items)
    if (all.length >= data.total || items.length === 0) break
    offset += items.length
  }
  return all
}

function parseTransitions(activities) {
  const transitions = []
  for (const activity of activities) {
    for (const detail of activity.details ?? []) {
      if (!detail.html?.includes('<strong>Status</strong>')) continue
      const matches = [...detail.html.matchAll(/<i>(.*?)<\/i>/g)]
      const ts = activity.createdAt
      if (matches.length === 1) {
        // "Status set to X" — initial status
        transitions.push({ from_status: null, to_status: matches[0][1], transitioned_at: ts })
      } else if (matches.length >= 2) {
        // "Status changed from X to Y"
        transitions.push({ from_status: matches[0][1], to_status: matches[1][1], transitioned_at: ts })
      }
    }
  }
  return transitions.sort((a, b) => new Date(a.transitioned_at) - new Date(b.transitioned_at))
}

function mapType(opType) {
  const t = (opType ?? '').toLowerCase()
  if (t === 'bug') return 'bug'
  if (t === 'epic') return 'epic'
  if (t === 'task') return 'task'
  return 'story' // user story, feature, etc.
}

// ── Exported plugin interface ────────────────────────────────────────────────

export async function test(credentials) {
  const { base_url, api_token } = credentials
  if (!base_url || !api_token) throw new Error('base_url and api_token are required')
  const data = await opGet(base_url, api_token, '/users/me')
  return { ok: true, display_name: data.name ?? data.login }
}

export async function fetch(credentials, options, onProgress) {
  const { base_url, api_token } = credentials
  const projectId = options.project
  const limit = Number(options.limit ?? 100)

  if (!projectId) throw new Error('project identifier is required')

  const workPackages = await fetchWorkPackages(base_url, api_token, projectId, limit)
  const tickets = []

  for (let i = 0; i < workPackages.length; i++) {
    const wp = workPackages[i]
    const key = `WP-${wp.id}`
    onProgress(i + 1, workPackages.length, key)

    const activities = await fetchActivities(base_url, api_token, wp.id)
    const transitions = parseTransitions(activities)

    tickets.push({
      external_id: key,
      title: wp.subject,
      ticket_type: mapType(wp._links?.type?.title),
      created_at: wp.createdAt,
      external_link: `${base_url}/work_packages/${wp.id}`,
      transitions,
    })
  }

  return {
    source_type: 'openproject',
    project_key: String(projectId),
    exported_at: new Date().toISOString(),
    tickets,
  }
}
