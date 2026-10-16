export type ScopeStatus = "Discovered" | "Approved in-scope" | "Excluded" | "Unmanaged"

export type DataSource = "Imported report" | "Demonstration" | "Live connector"
export type UserRole = "RCC Engineer" | "AC Mobility Approver" | "Administrator" | "Read-only Management"

export type Asset = {
  id: string
  hostname: string
  ip: string
  osVersion: string
  deviceType: string
  businessOwner: string
  department: string
  site: string
  criticality: string
  scopeStatus: ScopeStatus
  managementTool: string
  thirdPartyApplications: string
  connectivity: string
  lastScan: string
  rebootStatus: string
  targetGroup: string
  source: DataSource
  sourceName: string
  sourceTimestamp: string
}

export type ScanRecord = {
  id: string
  updateId: string
  title: string
  product: string
  severity: string
  cves: string[]
  applicability: string
  affectedAssetIds: string[]
  source: DataSource
  sourceName: string
  sourceTimestamp: string
}

export type ImportRecord = {
  id: string
  fileName: string
  importedAt: string
  source: DataSource
  recordType?: "Assets" | "Scan report"
  rowCount: number
  importedCount: number
  duplicateCount: number
  errorCount: number
}

export type PatchPlan = {
  id: string
  updateId: string
  targetGroup: string
  productionGroup: string
  evidence: string
  applicationChecks: string
  recoveryPlan: string
  rolloutCriteria: string
  schedule: string
  rebootPolicy: string
  result: "Not tested" | "Passed" | "Failed"
  pilotResult: "Not run" | "Passed" | "Failed"
  pilotStatus: "Not requested" | "Pending" | "Approved" | "Rejected"
  productionStatus: "Not requested" | "Pending" | "Approved" | "Rejected"
  emergencyStatus: "Not requested" | "Pending" | "Approved" | "Rejected"
  createdAt: string
  approvedScopeHash?: string
}

export type PlanDraft = Omit<PatchPlan, "id" | "result" | "pilotResult" | "pilotStatus" | "productionStatus" | "emergencyStatus" | "createdAt" | "approvedScopeHash">

export type ApprovalRecord = {
  id: string
  planId: string
  targetGroup: string
  stage: "Pilot" | "Production" | "Emergency"
  decision: "Approved" | "Rejected"
  approver: string
  timestamp: string
  comments: string
}

export type DeploymentRecord = {
  id: string
  planId: string
  targetGroup: string
  stage: "Pilot" | "Production" | "Emergency"
  targetAssetIds: string[]
  batchNumber: number
  batchCount: number
  status: "Queued" | "Running" | "Failed" | "Offline / pending" | "Reboot required" | "Awaiting verification" | "Verified"
  scheduledAt: string
  rebootPolicy: string
  rebootResult: string
  resultSource: "Demonstration"
  attempts: number
}

export type AuditRecord = {
  id: string
  timestamp: string
  actor: string
  action: string
  details: string
  source: DataSource
}

export type ExceptionRecord = {
  id: string
  assetOrUpdate: string
  category: string
  compensatingAction: string
  owner: string
  reviewDate: string
  status: "Open" | "Approved deferral" | "Resolved"
  source: DataSource
}

export type WorkspaceState = {
  schemaVersion: 1
  assets: Asset[]
  scans: ScanRecord[]
  imports: ImportRecord[]
  plans: PatchPlan[]
  approvals: ApprovalRecord[]
  deployments: DeploymentRecord[]
  audit: AuditRecord[]
  exceptions: ExceptionRecord[]
  role: UserRole
  criticalTargetHours: number
  policyConfirmed: boolean
  clockStart: string
  completionCriteria: string
  calendarHours: "Calendar hours" | "Business hours"
  escalationHours: string
  exceptionRules: string
  managementTools: string
  toolCoverage: string
  integrationCapability: string
  remoteAccessMethod: string
  pilotGroup: string
  productionBatchSize: number
  maintenanceWindow: string
  blackoutPeriods: string
  notificationLeadHours: number
  rebootPolicy: string
  retryLimit: number
}

export type ImportPreview = {
  valid: Asset[]
  errors: string[]
  duplicates: number
  rowCount: number
}

export type ScanImportPreview = {
  valid: ScanRecord[]
  errors: string[]
  duplicates: number
  rowCount: number
}

const now = () => new Date().toISOString()
const unknown = "Not confirmed"

export const demoExceptions: ExceptionRecord[] = [
  {
    id: "EXC-0041",
    assetOrUpdate: "ACM-CEB-WS-022 · KB5034441",
    category: "Compatibility blocker",
    compensatingAction: "Validate recovery partition; document vendor guidance",
    owner: "Endpoint Engineering",
    reviewDate: "2027-01-12",
    status: "Open",
    source: "Demonstration",
  },
  {
    id: "EXC-0039",
    assetOrUpdate: "ACM-MNL-SRV-003",
    category: "Offline device",
    compensatingAction: "Contact application owner; rescan on check-in",
    owner: "Infrastructure",
    reviewDate: "2027-01-12",
    status: "Open",
    source: "Demonstration",
  },
  {
    id: "EXC-0036",
    assetOrUpdate: "KB5046613",
    category: "Superseded",
    compensatingAction: "Deploy successor update",
    owner: "RCC Engineer",
    reviewDate: "2027-01-19",
    status: "Open",
    source: "Demonstration",
  },
  {
    id: "DEF-0012",
    assetOrUpdate: "KB5048667 · 8 devices",
    category: "Application compatibility validation",
    compensatingAction: "Complete app owner validation before the review date",
    owner: "Endpoint Engineering",
    reviewDate: "2027-01-19",
    status: "Approved deferral",
    source: "Demonstration",
  },
]

export const roles: UserRole[] = [
  "RCC Engineer",
  "AC Mobility Approver",
  "Administrator",
  "Read-only Management",
]

export const demoAssets: Asset[] = [
  ["ACM-0001", "ACM-MNL-LT-041", "10.24.18.41", "Windows 11 23H2 · 22631.4751"],
  [
    "ACM-0002",
    "ACM-MNL-LT-117",
    "10.24.18.117",
    "Windows 11 24H2 · 26100.2605",
  ],
  ["ACM-0003", "ACM-CEB-WS-022", "10.32.7.22", "Windows 10 22H2 · 19045.5247"],
  [
    "ACM-0004",
    "ACM-MNL-SRV-008",
    "10.24.2.8",
    "Windows Server 2022 · 20348.2966",
  ],
  ["ACM-0005", "ACM-DVO-LT-014", "10.40.11.14", "Windows 11 23H2 · 22631.4751"],
  [
    "ACM-0006",
    "ACM-MNL-SRV-003",
    "10.24.2.3",
    "Windows Server 2019 · 17763.6532",
  ],
].map(([id, hostname, ip, osVersion], index) => ({
  id,
  hostname,
  ip,
  osVersion,
  deviceType: index === 3 || index === 5 ? "Server" : "Laptop",
  businessOwner: unknown,
  department: unknown,
  site: unknown,
  criticality: unknown,
  scopeStatus: "Discovered" as const,
  managementTool: unknown,
  thirdPartyApplications: unknown,
  connectivity: "Not confirmed",
  lastScan: unknown,
  rebootStatus: unknown,
  targetGroup: unknown,
  source: "Demonstration" as const,
  sourceName: "January 2027 onboarding scenario",
  sourceTimestamp: "2027-01-05T09:00:00+08:00",
}))

export const demoScans: ScanRecord[] = [
  {
    id: "demo-kb5048685",
    updateId: "KB5048685",
    title: "Cumulative security update",
    product: "Windows 11 23H2",
    severity: "Critical",
    cves: ["CVE-2024-xxxx · Demonstration placeholder"],
    applicability: "Applicable · demonstration",
    affectedAssetIds: ["ACM-0001"],
    source: "Demonstration",
    sourceName: "January 2027 onboarding scenario",
    sourceTimestamp: "2027-01-05T09:00:00+08:00",
  },
  {
    id: "demo-kb5048667",
    updateId: "KB5048667",
    title: ".NET Framework security update",
    product: "Windows 11",
    severity: "High",
    cves: [],
    applicability: "Applicable · demonstration",
    affectedAssetIds: ["ACM-0001", "ACM-0002"],
    source: "Demonstration",
    sourceName: "January 2027 onboarding scenario",
    sourceTimestamp: "2027-01-05T09:00:00+08:00",
  },
  {
    id: "demo-kb5048652",
    updateId: "KB5048652",
    title: "Windows Server security update",
    product: "Windows Server 2022",
    severity: "Critical",
    cves: [],
    applicability: "Applicable · demonstration",
    affectedAssetIds: ["ACM-0004"],
    source: "Demonstration",
    sourceName: "January 2027 onboarding scenario",
    sourceTimestamp: "2027-01-05T09:00:00+08:00",
  },
  {
    id: "demo-kb5034441",
    updateId: "KB5034441",
    title: "Windows Recovery Environment Update",
    product: "Windows 10",
    severity: "Unknown",
    cves: [],
    applicability: "Blocked · demonstration",
    affectedAssetIds: ["ACM-0003"],
    source: "Demonstration",
    sourceName: "January 2027 onboarding scenario",
    sourceTimestamp: "2027-01-05T09:00:00+08:00",
  },
  {
    id: "demo-kb5046613",
    updateId: "KB5046613",
    title: "Cumulative update",
    product: "Windows 10 22H2",
    severity: "High",
    cves: [],
    applicability: "Superseded · demonstration",
    affectedAssetIds: ["ACM-0003"],
    source: "Demonstration",
    sourceName: "January 2027 onboarding scenario",
    sourceTimestamp: "2027-01-05T09:00:00+08:00",
  },
]

export function createInitialState(
  legacyAssets: unknown[] = [],
): WorkspaceState {
  const migrated = legacyAssets.map((candidate, index): Asset => {
    const value = candidate as Partial<Asset> & {
      os?: string
      owner?: string
    }
    const isDemoAsset = demoAssets.some((asset) => asset.id === value.id)
    return {
      id: value.id || `MIG-${String(index + 1).padStart(4, "0")}`,
      hostname: value.hostname || unknown,
      ip: value.ip || unknown,
      osVersion: value.osVersion || value.os || unknown,
      deviceType: value.deviceType || unknown,
      businessOwner: value.businessOwner || value.owner || unknown,
      department: value.department || unknown,
      site: value.site || unknown,
      criticality: value.criticality || unknown,
      scopeStatus: value.scopeStatus || "Discovered",
      managementTool: value.managementTool || unknown,
      thirdPartyApplications: value.thirdPartyApplications || unknown,
      connectivity: value.connectivity || "Not confirmed",
      lastScan: value.lastScan || unknown,
      rebootStatus: value.rebootStatus || unknown,
      targetGroup: value.targetGroup || unknown,
      source:
        value.source || (isDemoAsset ? "Demonstration" : "Imported report"),
      sourceName:
        value.sourceName ||
        (isDemoAsset
          ? "January 2027 onboarding scenario"
          : "Migrated browser inventory"),
      sourceTimestamp: value.sourceTimestamp || now(),
    }
  })
  const seenHostnames = new Set<string>()
  const seenIps = new Set<string>()
  const assets = [...demoAssets, ...migrated].filter((asset) => {
    const hostname = asset.hostname.toLowerCase()
    const ip = asset.ip.toLowerCase()
    if (seenHostnames.has(hostname) || (ip !== unknown && seenIps.has(ip)))
      return false
    seenHostnames.add(hostname)
    if (ip !== unknown) seenIps.add(ip)
    return true
  })
  return {
    schemaVersion: 1,
    assets,
    scans: demoScans,
    imports: [],
    plans: [],
    approvals: [],
    deployments: [],
    audit: [],
    exceptions: demoExceptions,
    role: "RCC Engineer",
    criticalTargetHours: 48,
    policyConfirmed: false,
    clockStart: "First confirmed applicable scan",
    completionCriteria:
      "Verified by post-deployment rescan or connector evidence",
    calendarHours: "Calendar hours",
    escalationHours: "12, 24, 36",
    exceptionRules: "No automatic pauses for approval or offline devices.",
    managementTools: "Not confirmed",
    toolCoverage: "Not confirmed",
    integrationCapability: "Not confirmed",
    remoteAccessMethod: "Not confirmed",
    pilotGroup: "Pilot group · Not confirmed",
    productionBatchSize: 50,
    maintenanceWindow: "Asia/Manila · Not confirmed",
    blackoutPeriods: "Not confirmed",
    notificationLeadHours: 24,
    rebootPolicy: "Not confirmed",
    retryLimit: 2,
  }
}

export function loadWorkspaceState(
  storage: Pick<Storage, "getItem">,
): { state: WorkspaceState; error: string | null } {
  try {
    const raw = storage.getItem("rcc-patchguard-workspace-v1")
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceState
      if (
        parsed.schemaVersion === 1 &&
        Array.isArray(parsed.assets) &&
        Array.isArray(parsed.scans) &&
        Array.isArray(parsed.plans)
      ) {
        return {
          state: {
            ...createInitialState(),
            ...parsed,
            assets: parsed.assets.map((asset) => ({
              ...asset,
              thirdPartyApplications:
                asset.thirdPartyApplications ?? "Not confirmed",
            })),
            deployments: Array.isArray(parsed.deployments)
              ? parsed.deployments.map((deployment) => ({
                  ...deployment,
                  targetAssetIds: Array.isArray(deployment.targetAssetIds)
                    ? deployment.targetAssetIds
                    : [],
                  batchNumber: deployment.batchNumber ?? 1,
                  batchCount: deployment.batchCount ?? 1,
                }))
              : [],
            exceptions: Array.isArray(parsed.exceptions)
              ? parsed.exceptions
              : [],
          },
          error: null,
        }
      }
      return {
        state: createInitialState(),
        error:
          "Saved workspace data was invalid; a fresh rehearsal workspace was loaded.",
      }
    }
    const legacyRaw = storage.getItem("rcc-imported-assets")
    const legacy = legacyRaw ? JSON.parse(legacyRaw) : []
    return {
      state: createInitialState(Array.isArray(legacy) ? legacy : []),
      error: null,
    }
  } catch {
    return {
      state: createInitialState(),
      error:
        "Saved workspace data could not be read; changes may not be available.",
    }
  }
}

export function parseAssetCsv(
  value: string,
  existing: Asset[] = [],
): ImportPreview {
  let rows: string[][]
  try {
    rows = parseCsvRows(value)
  } catch (error) {
    return {
      valid: [],
      errors: [
        error instanceof Error ? error.message : "CSV could not be parsed.",
      ],
      duplicates: 0,
      rowCount: 0,
    }
  }
  const valid: Asset[] = []
  const errors: string[] = []
  let duplicates = 0
  if (!rows.length || rows.every((row) => row.every((cell) => !cell.trim()))) {
    return { valid, errors, duplicates, rowCount: 0 }
  }
  const headers = rows[0].map((header) => normalizeHeader(header))
  const index = (...names: string[]) =>
    headers.findIndex((header) => names.includes(header))
  const hostnameIndex = index("hostname", "device name", "computer name")
  if (hostnameIndex < 0) {
    return {
      valid,
      errors: [
        "Header row must include hostname, device name, or computer name.",
      ],
      duplicates,
      rowCount: Math.max(0, rows.length - 1),
    }
  }
  const seenHostnames = new Set(
    existing.map((asset) => asset.hostname.toLowerCase()),
  )
  const seenIps = new Set(
    existing
      .map((asset) => asset.ip.toLowerCase())
      .filter((ip) => ip && ip !== unknown),
  )
  const timestamp = now()
  const columns = {
    ip: index("ip", "ip address"),
    os: index(
      "os",
      "os version",
      "operating system",
      "operating system version",
    ),
    type: index("device type", "type"),
    owner: index("business owner", "owner"),
    department: index("department"),
    site: index("site", "location"),
    criticality: index("business criticality", "criticality"),
    managementTool: index("management tool", "patching tool", "agent"),
    thirdPartyApplications: index(
      "third party applications",
      "third-party applications",
      "applications",
      "software inventory",
    ),
    connectivity: index("connectivity", "connection status"),
    lastScan: index("last scan", "last scanned"),
    rebootStatus: index("reboot status", "restart status"),
    group: index("target group", "group"),
  }
  rows.slice(1).forEach((row, offset) => {
    if (row.every((cell) => !cell.trim())) return
    const line = offset + 2
    const hostname = row[hostnameIndex]?.trim()
    if (!hostname) {
      errors.push(`Row ${line}: hostname is required.`)
      return
    }
    const get = (column: number) =>
      column < 0 ? "" : row[column]?.trim() || ""
    const ip = get(columns.ip)
    if (
      hostname.length > 255 ||
      !/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,253}[a-zA-Z0-9])?$/.test(hostname)
    ) {
      errors.push(
        `Row ${line}: hostname contains unsupported characters or is too long.`,
      )
      return
    }
    if (ip && ip !== unknown && !isValidIpAddress(ip)) {
      errors.push(
        `Row ${line}: IP address is not a valid IPv4 or IPv6 address.`,
      )
      return
    }
    const hostnameKey = hostname.toLowerCase()
    const ipKey = ip.toLowerCase()
    if (
      seenHostnames.has(hostnameKey) ||
      (ipKey && ipKey !== unknown && seenIps.has(ipKey))
    ) {
      duplicates += 1
      return
    }
    seenHostnames.add(hostnameKey)
    if (ipKey && ipKey !== unknown) seenIps.add(ipKey)
    valid.push({
      id: `INV-${timestamp.replace(/\D/g, "").slice(-14)}-${String(offset + 1).padStart(3, "0")}`,
      hostname,
      ip: ip || unknown,
      osVersion: get(columns.os) || unknown,
      deviceType: get(columns.type) || unknown,
      businessOwner: get(columns.owner) || unknown,
      department: get(columns.department) || unknown,
      site: get(columns.site) || unknown,
      criticality: get(columns.criticality) || unknown,
      scopeStatus: "Discovered",
      managementTool: get(columns.managementTool) || unknown,
      thirdPartyApplications: get(columns.thirdPartyApplications) || unknown,
      connectivity: get(columns.connectivity) || "Not confirmed",
      lastScan: get(columns.lastScan) || "Not confirmed",
      rebootStatus: get(columns.rebootStatus) || "Not confirmed",
      targetGroup: get(columns.group) || unknown,
      source: "Imported report",
      sourceName: "CSV inventory import",
      sourceTimestamp: timestamp,
    })
  })
  return { valid, errors, duplicates, rowCount: Math.max(0, rows.length - 1) }
}

export function parseScanCsv(
  value: string,
  assets: Asset[],
  existing: ScanRecord[] = [],
): ScanImportPreview {
  let rows: string[][]
  try {
    rows = parseCsvRows(value)
  } catch (error) {
    return {
      valid: [],
      errors: [error instanceof Error ? error.message : "CSV could not be parsed."],
      duplicates: 0,
      rowCount: 0,
    }
  }
  if (!rows.length || rows.every((row) => row.every((cell) => !cell.trim()))) {
    return { valid: [], errors: [], duplicates: 0, rowCount: 0 }
  }
  const headers = rows[0].map((header) => normalizeHeader(header))
  const index = (...names: string[]) =>
    headers.findIndex((header) => names.includes(header))
  const columns = {
    updateId: index("update id", "kb", "kb number", "patch id", "update"),
    title: index("title", "update title", "patch title"),
    product: index("product", "product name"),
    severity: index("severity", "criticality"),
    cves: index("cve", "cves", "cve id"),
    applicability: index("applicability", "status", "finding status"),
    assets: index("affected assets", "affected devices", "hostnames", "asset ids"),
  }
  const requiredHeaders: [string, number][] = [
    ["update ID", columns.updateId],
    ["title", columns.title],
    ["severity", columns.severity],
    ["applicability", columns.applicability],
  ]
  const missing = requiredHeaders
    .filter(([, column]) => column < 0)
    .map(([name]) => name)
  if (missing.length) {
    return {
      valid: [],
      errors: [`Header row must include: ${missing.join(", ")}.`],
      duplicates: 0,
      rowCount: Math.max(0, rows.length - 1),
    }
  }
  const assetLookup = new Map<string, string>()
  assets.forEach((asset) => {
    assetLookup.set(asset.id.toLowerCase(), asset.id)
    assetLookup.set(asset.hostname.toLowerCase(), asset.id)
  })
  const seen = new Set(
    existing.map((scan) =>
      [
        scan.updateId.toLowerCase(),
        scan.applicability.toLowerCase(),
        [...scan.affectedAssetIds].sort().join("|"),
      ].join("::"),
    ),
  )
  const valid: ScanRecord[] = []
  const errors: string[] = []
  let duplicates = 0
  const timestamp = now()
  const unknown = "Not confirmed"
  rows.slice(1).forEach((row, offset) => {
    if (row.every((cell) => !cell.trim())) return
    const line = offset + 2
    const get = (column: number) => (column < 0 ? "" : row[column]?.trim() || "")
    const updateId = get(columns.updateId)
    const title = get(columns.title)
    const severity = get(columns.severity)
    const applicability = get(columns.applicability)
    if (!updateId || !title || !severity || !applicability) {
      errors.push(`Row ${line}: update ID, title, severity, and applicability are required.`)
      return
    }
    if (updateId.length > 100 || title.length > 300) {
      errors.push(`Row ${line}: update ID or title is too long.`)
      return
    }
    const allowedApplicability = [
      "applicable",
      "not applicable",
      "blocked",
      "superseded",
      "unsupported",
      "unknown",
    ]
    if (
      !["critical", "high", "medium", "low", "informational", "unknown", "not confirmed"].includes(
        severity.toLowerCase(),
      )
    ) {
      errors.push(`Row ${line}: severity is not recognized.`)
      return
    }
    if (!allowedApplicability.some((status) => applicability.toLowerCase().startsWith(status))) {
      errors.push(`Row ${line}: applicability must be Applicable, Not applicable, Blocked, Superseded, Unsupported, or Unknown.`)
      return
    }
    const assetTokens = get(columns.assets)
      .split(/[|;]/)
      .map((token) => token.trim())
      .filter(Boolean)
    const affectedAssetIds: string[] = []
    for (const token of assetTokens) {
      const assetId = assetLookup.get(token.toLowerCase())
      if (!assetId) {
        errors.push(`Row ${line}: affected asset "${token}" is not in the imported inventory.`)
        return
      }
      if (!affectedAssetIds.includes(assetId)) affectedAssetIds.push(assetId)
    }
    const fingerprint = [
      updateId.toLowerCase(),
      applicability.toLowerCase(),
      [...affectedAssetIds].sort().join("|"),
    ].join("::")
    if (seen.has(fingerprint)) {
      duplicates += 1
      return
    }
    seen.add(fingerprint)
    valid.push({
      id: `SCAN-${timestamp.replace(/\D/g, "").slice(-14)}-${String(offset + 1).padStart(3, "0")}`,
      updateId,
      title,
      product: get(columns.product) || unknown,
      severity,
      cves: get(columns.cves)
        .split(/[|;]/)
        .map((cve) => cve.trim())
        .filter(Boolean),
      applicability,
      affectedAssetIds,
      source: "Imported report",
      sourceName: "Imported scan report CSV",
      sourceTimestamp: timestamp,
    })
  })
  return { valid, errors, duplicates, rowCount: Math.max(0, rows.length - 1) }
}

function isValidIpAddress(value: string): boolean {
  if (value.includes(".")) {
    const parts = value.split(".")
    return (
      parts.length === 4 &&
      parts.every(
        (part) =>
          /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255,
      )
    )
  }
  return value.includes(":") && /^[0-9a-fA-F:]+$/.test(value)
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
}

function parseCsvRows(value: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    const character = value[cursor]
    if (quoted) {
      if (character === '"' && value[cursor + 1] === '"') {
        field += '"'
        cursor += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && !field) {
      quoted = true
    } else if (character === ",") {
      row.push(field)
      field = ""
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && value[cursor + 1] === "\n") cursor += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += character
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.")
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function summarizeScans(scans: ScanRecord[]) {
  const applicable = scans.filter((scan) =>
    scan.applicability.toLowerCase().startsWith("applicable"),
  )
  const affectedAssetIds = new Set(
    applicable.flatMap((scan) => scan.affectedAssetIds),
  )
  const patchInstances = new Set(
    applicable.flatMap((scan) =>
      scan.affectedAssetIds.map((assetId) => `${scan.updateId}|${assetId}`),
    ),
  )
  return {
    distinctPatchChecks: new Set(applicable.map((scan) => scan.updateId)).size,
    affectedDevices: affectedAssetIds.size,
    devicePatchInstances: patchInstances.size,
  }
}

export function canApprove(
  role: UserRole,
  stage: "Pilot" | "Production" | "Emergency",
) {
  return (
    ["Pilot", "Production", "Emergency"].includes(stage) &&
    role === "AC Mobility Approver"
  )
}

export function canSchedule(role: UserRole): boolean {
  return role === "RCC Engineer" || role === "Administrator"
}

export function targetSetIsApplicable(
  scans: ScanRecord[],
  updateId: string,
  targetAssetIds: string[],
): boolean {
  if (!targetAssetIds.length) return false
  const affected = new Set(
    scans
      .filter(
        (scan) =>
          scan.updateId === updateId &&
          scan.applicability.toLowerCase().startsWith("applicable"),
      )
      .flatMap((scan) => scan.affectedAssetIds),
  )
  return targetAssetIds.every((assetId) => affected.has(assetId))
}

export function hasPostDeploymentVerification(
  plan: PatchPlan,
  deployment: DeploymentRecord,
  scans: ScanRecord[],
  targetAssetIds: string[],
): boolean {
  const verification = scans.find(
    (scan) =>
      scan.updateId === plan.updateId &&
      Date.parse(scan.sourceTimestamp) > Date.parse(deployment.scheduledAt) &&
      scan.applicability.toLowerCase().includes("not applicable") &&
      targetAssetIds.every((assetId) =>
        scan.affectedAssetIds.includes(assetId),
      ),
  )
  return Boolean(verification && targetAssetIds.length)
}

export function scopeFingerprint(
  plan: PatchPlan,
  targetAssetIds: string[] = [],
): string {
  return [
    plan.updateId,
    plan.targetGroup,
    plan.productionGroup,
    plan.evidence,
    plan.applicationChecks,
    plan.recoveryPlan,
    plan.rolloutCriteria,
    plan.schedule,
    plan.rebootPolicy,
    [...targetAssetIds].sort().join(","),
  ].join("|")
}

export function exportCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? "")
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(","),
    )
    .join("\r\n")
}
