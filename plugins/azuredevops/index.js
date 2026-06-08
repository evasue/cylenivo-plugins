/**
 * Cylenivo plugin — Azure DevOps
 * Imports Product Backlog Items with status transitions from Azure DevOps Cloud.
 *
 * Interface: exports test() and fetch() — loaded by Cylenivo via dynamic import.
 *
 * Authentication: Personal Access Token (PAT)
 * Required PAT scope: Work Items (Read)
 */

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function authHeader(pat) {
  // Azure DevOps uses Basic auth with an empty username and the PAT as password
  return 'Basic ' + Buffer.from(`:${pat}`).toString('base64')
}

async function adoGet(organization, pat, path) {
  const url = `https://dev.azure.com/${encodeURIComponent(organization)}${path}`
  const res = await globalThis.fetch(url, {
    headers: {
      Authorization: authHeader(pat),
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Azure DevOps API ${res.status} on ${path}: ${body}`)
  }
  return res.json()
}

async function adoPost(organization, pat, path, body) {
  const url = `https://dev.azure.com/${encodeURIComponent(organization)}${path}`
  const res = await globalThis.fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(pat),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Azure DevOps API ${res.status} on ${path}: ${body}`)
  }
  return res.json()
}

// ── Work item fetching via WIQL ───────────────────────────────────────────────

/**
 * Runs a WIQL query to get work item IDs for Product Backlog Items,
 * optionally filtered by Area Path.
 */
async function queryWorkItemIds(organization, pat, project, areaPath, limit) {
  const areaFilter = areaPath
    ? `AND [System.AreaPath] UNDER '${areaPath.replace(/'/g, "''")}'`
    : ''

  const wiql = {
    query: `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.TeamProject] = '${project.replace(/'/g, "''")}'
        AND [System.WorkItemType] = 'Product Backlog Item'
        ${areaFilter}
      ORDER BY [System.CreatedDate] ASC
    `,
  }

  const data = await adoPost(
    organization,
    pat,
    `/${encodeURIComponent(project)}/_apis/wit/wiql?$top=${limit}&api-version=7.1`,
    wiql
  )

  return (data.workItems ?? []).map((wi) => wi.id)
}

/**
 * Fetches work item details in batches of up to 200 (API limit).
 */
async function fetchWorkItemDetails(organization, pat, project, ids) {
  const all = []
  const batchSize = 200
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const data = await adoGet(
      organization,
      pat,
      `/${encodeURIComponent(project)}/_apis/wit/workItems?ids=${batch.join(',')}&fields=System.Id,System.Title,System.WorkItemType,System.CreatedDate,System.AreaPath&api-version=7.1`
    )
    all.push(...(data.value ?? []))
  }
  return all
}

// ── Transition parsing ────────────────────────────────────────────────────────

/**
 * Fetches the full update history for a single work item and extracts
 * all System.State transitions.
 */
async function fetchTransitions(organization, pat, project, workItemId) {
  const data = await adoGet(
    organization,
    pat,
    `/${encodeURIComponent(project)}/_apis/wit/workItems/${workItemId}/updates?api-version=7.1`
  )

  const transitions = []

  for (const update of data.value ?? []) {
    const stateChange = update.fields?.['System.State']
    if (!stateChange) continue

    const ts = update.revisedDate ?? update.fields?.['System.ChangedDate']?.newValue
    if (!ts) continue

    // The first update (revision 1) sets the initial state — no oldValue present
    transitions.push({
      from_status: stateChange.oldValue ?? null,
      to_status: stateChange.newValue,
      transitioned_at: new Date(ts).toISOString(),
    })
  }

  return transitions.sort(
    (a, b) => new Date(a.transitioned_at) - new Date(b.transitioned_at)
  )
}

// ── Exported plugin interface ─────────────────────────────────────────────────

/**
 * Validate credentials against the Azure DevOps API.
 * Calls the "current user profile" endpoint.
 */
export async function test(credentials) {
  const { organization, pat } = credentials
  if (!organization || !pat) throw new Error('organization and pat are required')

  const data = await adoGet(organization, pat, '/_apis/profile/profiles/me?api-version=7.1')
  return { ok: true, display_name: data.displayName ?? data.emailAddress ?? 'Unknown' }
}

/**
 * Fetch Product Backlog Items with full status transition history.
 */
export async function fetch(credentials, options, onProgress) {
  const { organization, pat } = credentials
  const project = (options.project ?? '').trim()
  const areaPath = (options.area_path ?? '').trim() || null
  const limit = Number(options.limit ?? 100)

  if (!organization) throw new Error('organization is required')
  if (!project) throw new Error('project is required')

  // Step 1: query IDs via WIQL
  const ids = await queryWorkItemIds(organization, pat, project, areaPath, limit)
  if (ids.length === 0) {
    return {
      source_type: 'azuredevops',
      project_key: project,
      exported_at: new Date().toISOString(),
      tickets: [],
    }
  }

  // Step 2: fetch details for all IDs
  const workItems = await fetchWorkItemDetails(organization, pat, project, ids)

  // Step 3: fetch transitions per item
  const tickets = []
  for (let i = 0; i < workItems.length; i++) {
    const wi = workItems[i]
    const id = wi.id
    const key = `AB#${id}`
    onProgress(i + 1, workItems.length, key)

    const transitions = await fetchTransitions(organization, pat, project, id)

    tickets.push({
      external_id: key,
      title: wi.fields['System.Title'],
      ticket_type: 'story', // Product Backlog Item → story
      created_at: new Date(wi.fields['System.CreatedDate']).toISOString(),
      external_link: `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_workitems/edit/${id}`,
      transitions,
    })
  }

  return {
    source_type: 'azuredevops',
    project_key: project,
    exported_at: new Date().toISOString(),
    tickets,
  }
}
