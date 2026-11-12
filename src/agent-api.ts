export type AgentUser = {
  id: string
  email: string
  role: "engineer" | "client_approver" | "read_only_reviewer"
}

export type AgentSession =
  | { authenticated: false }
  | { authenticated: true; user: AgentUser }

export type LiveAgentDevice = {
  id: string
  hostname: string
  os_name: string
  os_version: string | null
  os_build: string | null
  architecture: string | null
  agent_version: string | null
  enrollment_status: string
  restart_status: string
  last_heartbeat_at: string | null
  last_scan_at: string | null
  created_at: string
  scan_count: number
}

export type LiveAgentFinding = {
  id: string
  scan_run_id: string
  update_id: string
  revision: string | null
  kb: string | null
  product: string
  title: string
  source: string
  applicability: string
  severity: string | null
  severity_source: string | null
  detected_at: string
  status: string
}

export type LiveAgentScan = {
  id: string
  asset_id: string
  hostname: string
  provider: string
  started_at: string
  completed_at: string | null
  received_at: string | null
  status: string
  updates: LiveAgentFinding[]
}

export class AgentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message)
    this.name = "AgentApiError"
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new AgentApiError(
      "PatchGuard API is unreachable. Check that the backend and dashboard proxy are running.",
      0,
      "api_unreachable",
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new AgentApiError(
      `PatchGuard API returned a non-JSON response (${response.status}).`,
      response.status,
      "invalid_response",
    )
  }

  if (!response.ok) {
    const body =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {}
    throw new AgentApiError(
      typeof body.error === "string"
        ? body.error
        : `PatchGuard API request failed (${response.status}).`,
      response.status,
      typeof body.code === "string" ? body.code : null,
    )
  }

  return payload as T
}

export const getAgentSession = () =>
  request<AgentSession>("/api/auth/session")

export const signInAgentUser = (email: string, password: string) =>
  request<{ authenticated: true; user: AgentUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })

export const signOutAgentUser = () =>
  request<{ authenticated: false }>("/api/auth/logout", {
    method: "POST",
  })

export const createEnrollmentToken = (hostname: string) =>
  request<{
    enrollmentToken: string
    hostname: string
    expiresAt: string
  }>("/api/agent/enrollment-tokens", {
    method: "POST",
    body: JSON.stringify({ hostname }),
  })

export const getLiveAgentDevices = () =>
  request<{ records: LiveAgentDevice[] }>("/api/agent/devices")

export const getLiveAgentScans = () =>
  request<{ records: LiveAgentScan[] }>("/api/agent/scans")

export const revokeLiveAgentDevice = (deviceId: string) =>
  request<{ revoked: true; revokedAt: string }>(
    `/api/agent/devices/${encodeURIComponent(deviceId)}/revoke`,
    { method: "POST" },
  )
