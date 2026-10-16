import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  canApprove,
  canSchedule,
  createInitialState,
  demoAssets,
  demoScans,
  exportCsv,
  hasPostDeploymentVerification,
  loadWorkspaceState,
  parseAssetCsv,
  parseScanCsv,
  scopeFingerprint,
  summarizeScans,
  targetSetIsApplicable,
  type ApprovalRecord,
  type Asset,
  type AuditRecord,
  type DataSource,
  type DeploymentRecord,
  type ExceptionRecord,
  type ImportRecord,
  type PatchPlan,
  type PlanDraft,
  type ScanRecord,
  type ScopeStatus,
  type UserRole,
  type WorkspaceState,
} from "./domain"
import {
  AgentApiError,
  createEnrollmentToken,
  getAgentSession,
  getLiveAgentDevices,
  getLiveAgentScans,
  revokeLiveAgentDevice,
  signInAgentUser,
  signOutAgentUser,
  type AgentUser,
  type LiveAgentDevice,
  type LiveAgentScan,
} from "./agent-api"

type Page = "Overview" | "Assets" | "Scan results" | "Enroll Device" | "Testing" | "Approvals" | "Deployments" | "Verification" | "SLA monitoring" | "Reports" | "Exceptions & audit" | "Settings"

type IconName = "grid" | "devices" | "scan" | "flask" | "check" | "rocket" | "shield" | "clock" | "report" | "history" | "settings" | "plus" | "search" | "bell" | "chevron" | "arrow" | "plug" | "calendar" | "download" | "upload" | "lock" | "info" | "warning" | "close" | "more" | "refresh"

const nav: { label: Page; icon: IconName; divider?: boolean }[] = [
  { label: "Overview", icon: "grid" },
  { label: "Assets", icon: "devices" },
  { label: "Scan results", icon: "scan" },
  { label: "Enroll Device", icon: "lock" },
  { label: "Testing", icon: "flask", divider: true },
  { label: "Approvals", icon: "check" },
  { label: "Deployments", icon: "rocket" },
  { label: "Verification", icon: "shield" },
  { label: "SLA monitoring", icon: "clock", divider: true },
  { label: "Reports", icon: "report" },
  { label: "Exceptions & audit", icon: "history" },
  { label: "Settings", icon: "settings", divider: true },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    devices: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    scan: (
      <>
        <path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    flask: (
      <>
        <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
        <path d="M8 15h8" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    rocket: (
      <>
        <path d="M14 5c2-2 5-2 5-2s0 3-2 5l-5 5-4-4 6-4Z" />
        <path d="m8 9-4 1-2 3 6 1M12 13l-1 6-3 2-1-7" />
        <path d="m4 18 2-2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    report: (
      <>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>
    ),
    history: (
      <>
        <path d="M4 5v5h5" />
        <path d="M5.5 9A8 8 0 1 1 4 14" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19 13.5v-3l-2-.7-.6-1.4.9-1.9-2.1-2.1-1.9.9-1.4-.6L11 2H8l-.7 2.3-1.4.6-1.9-.9L2 6l.9 1.9-.6 1.4L0 10v3l2.3.7.6 1.4L2 17l2.1 2.1 1.9-.9 1.4.6L8 21h3l.7-2.3 1.4-.6 1.9.9 2.1-2.1-.9-1.9.6-1.4z"
          transform="translate(1)"
        />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    plug: (
      <>
        <path d="m8 12 8-8M14 3l3 3M6 10l3 3M4 12l8 8M2 20l5-5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 6v5h-5" />
        <path d="M4 18v-5h5" />
        <path d="M18 9a7 7 0 0 0-12-2L4 10M6 15a7 7 0 0 0 12 2l2-3" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  disabled,
  title,
  type = "button",
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  icon?: IconName
  onClick?: () => void
  disabled?: boolean
  title?: string
  type?: "button" | "submit"
}) {
  return (
    <button
      type={type}
      className={`button button-${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </button>
  )
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: string
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`panel ${className}`}>{children}</section>
}

function PanelHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={25} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone = "teal",
  onClick,
}: {
  label: string
  value: string
  note: string
  icon: IconName
  tone?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="panel metric-card metric-card-button"
      onClick={onClick}
    >
      <div className={`metric-icon tone-${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </button>
  )
}

function MetricDisplayCard({
  label,
  value,
  note,
  icon,
  tone = "teal",
}: {
  label: string
  value: string
  note: string
  icon: IconName
  tone?: string
}) {
  return (
    <div className="panel metric-card">
      <div className={`metric-icon tone-${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  )
}

function Table({
  headers,
  children,
}: {
  headers: string[]
  children?: ReactNode
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function IntegrationNote({ children }: { children: ReactNode }) {
  return (
    <div className="integration-note">
      <Icon name="plug" size={17} />
      <div>
        <strong>Integration required</strong>
        <span>{children}</span>
      </div>
    </div>
  )
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">AC Mobility · RCC PatchGuard</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ActionDialog({
  title,
  description,
  confirmLabel = "Got it",
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel?: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
        <p className="dialog-copy">{description}</p>
      </div>
      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

function App() {
  const [page, setPage] = useState<Page>("Overview")
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionDialog, setActionDialog] = useState<{
    title: string
    description: string
    confirmLabel?: string
    onConfirm?: () => void
  } | null>(null)
  const [modal, setModal] =
    useState<
      "import" | "scan-import" | "report" | "plan" | null
    >(null)
  const [importText, setImportText] = useState("")
  const [importFileName, setImportFileName] = useState("Pasted CSV")
  const [scanImportText, setScanImportText] = useState("")
  const [scanImportFileName, setScanImportFileName] = useState("Pasted scan report")
  const [toast, setToast] = useState("")
  const [loadedWorkspace] = useState(() =>
    loadWorkspaceState(window.localStorage),
  )
  const [workspace, setWorkspace] = useState<WorkspaceState>(
    loadedWorkspace.state,
  )
  const [storageError, setStorageError] = useState(loadedWorkspace.error)
  const [agentUser, setAgentUser] = useState<AgentUser | null>(null)
  const [agentSessionStatus, setAgentSessionStatus] = useState<
    "loading" | "authenticated" | "unauthenticated" | "unavailable"
  >("loading")
  const [agentSessionError, setAgentSessionError] = useState("")
  const [liveDevices, setLiveDevices] = useState<LiveAgentDevice[]>([])
  const [liveScans, setLiveScans] = useState<LiveAgentScan[]>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState("")
  const [agentAuthRequired, setAgentAuthRequired] = useState(false)
  const [agentRefreshKey, setAgentRefreshKey] = useState(0)
  const assets = workspace.assets
  const scanMetrics = useMemo(
    () => summarizeScans(workspace.scans),
    [workspace.scans],
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "rcc-patchguard-workspace-v1",
        JSON.stringify(workspace),
      )
      setStorageError(null)
    } catch {
      setStorageError(
        "Workspace changes could not be saved in this browser. Export data before leaving.",
      )
    }
  }, [workspace, loadedWorkspace.error])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let active = true
    getAgentSession()
      .then((session) => {
        if (!active) return
        if (session.authenticated) {
          setAgentUser(session.user)
          setAgentSessionStatus("authenticated")
        } else {
          setAgentUser(null)
          setAgentSessionStatus("unauthenticated")
        }
        setAgentSessionError("")
      })
      .catch((error: unknown) => {
        if (!active) return
        setAgentSessionStatus("unavailable")
        setAgentSessionError(
          error instanceof Error
            ? error.message
            : "PatchGuard API session could not be checked.",
        )
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (page !== "Assets" && page !== "Scan results") return
    let active = true
    setLiveLoading(true)
    setLiveError("")
    setAgentAuthRequired(false)
    Promise.all([getLiveAgentDevices(), getLiveAgentScans()])
      .then(([devices, scans]) => {
        if (!active) return
        setLiveDevices(devices.records)
        setLiveScans(scans.records)
      })
      .catch((error: unknown) => {
        if (!active) return
        setLiveDevices([])
        setLiveScans([])
        if (error instanceof AgentApiError && error.status === 401) {
          setAgentAuthRequired(true)
          setAgentUser(null)
          setAgentSessionStatus("unauthenticated")
        } else {
          setLiveError(
            error instanceof Error
              ? error.message
              : "Live agent evidence could not be loaded.",
          )
        }
      })
      .finally(() => {
        if (active) setLiveLoading(false)
      })
    return () => {
      active = false
    }
  }, [page, agentRefreshKey])

  async function handleAgentLogin(email: string, password: string) {
    const session = await signInAgentUser(email, password)
    setAgentUser(session.user)
    setAgentSessionStatus("authenticated")
    setAgentSessionError("")
    setAgentAuthRequired(false)
    setAgentRefreshKey((current) => current + 1)
  }

  async function handleAgentLogout() {
    await signOutAgentUser()
    setAgentUser(null)
    setAgentSessionStatus("unauthenticated")
    setAgentRefreshKey((current) => current + 1)
  }

  async function handleAgentRevoke(device: LiveAgentDevice) {
    if (
      !window.confirm(
        `Revoke the Windows agent credential for ${device.hostname}? The device will no longer be able to submit heartbeats or scans.`,
      )
    ) {
      return
    }
    try {
      await revokeLiveAgentDevice(device.id)
      setToast(`Credential revoked for ${device.hostname}.`)
      setAgentRefreshKey((current) => current + 1)
    } catch (error) {
      setToast(
        error instanceof Error
          ? `Credential revocation failed: ${error.message}`
          : "Credential revocation failed.",
      )
    }
  }

  const importedPreview = useMemo(
    () => parseAssetCsv(importText, workspace.assets),
    [importText, workspace.assets],
  )
  const importedScanPreview = useMemo(
    () =>
      parseScanCsv(scanImportText, workspace.assets, workspace.scans),
    [scanImportText, workspace.assets, workspace.scans],
  )
  const pageMeta: Record<Page, [string, string]> = {
    Overview: [
      "Overview",
      "January 2027 onboarding scenario · scope and SLA pending client confirmation.",
    ],
    Assets: [
      "Asset inventory",
      "Manage discovered devices, scope, ownership, and scan freshness.",
    ],
    "Scan results": [
      "Scan results",
      "Source-tagged patch findings and applicability.",
    ],
    "Enroll Device": [
      "Enroll Device",
      "Authenticate with the PatchGuard backend to authorize a single Windows device.",
    ],
    Testing: [
      "Testing",
      "Evidence and recovery readiness for exact update revisions.",
    ],
    Approvals: [
      "Approval center",
      "Review tested scope before any deployment is authorized.",
    ],
    Deployments: [
      "Deployments",
      "Operator-triggered installation jobs and maintenance windows.",
    ],
    Verification: [
      "Verification",
      "Confirm remediation with post-deployment scan evidence.",
    ],
    "SLA monitoring": [
      "SLA monitoring",
      "Configurable remediation targets in Asia/Manila time.",
    ],
    Reports: [
      "Reports",
      "Evidence-based operational reporting from persisted records.",
    ],
    "Exceptions & audit": [
      "Exceptions & audit",
      "Deferrals, limitations, failures, and security-relevant activity.",
    ],
    Settings: [
      "Administration",
      "Access, integrations, enrollment, maintenance, and policy configuration.",
    ],
  }

  function commitImport() {
    if (!importedPreview.valid.length) return
    const additions = importedPreview.valid.map((asset) => ({
      ...asset,
      sourceName: importFileName,
    }))
    const timestamp = new Date().toISOString()
    const importRecord: ImportRecord = {
      id: `IMP-${Date.now()}`,
      fileName: importFileName,
      importedAt: timestamp,
      source: "Imported report",
      recordType: "Assets",
      rowCount: importedPreview.rowCount,
      importedCount: additions.length,
      duplicateCount: importedPreview.duplicates,
      errorCount: importedPreview.errors.length,
    }
    setWorkspace((current) => ({
      ...current,
      assets: [...current.assets, ...additions],
      imports: [importRecord, ...current.imports],
      audit: [
        makeAudit(
          current.role,
          "Inventory imported",
          `${additions.length} discovered assets from ${importFileName}.`,
          "Imported report",
        ),
        ...current.audit,
      ],
    }))
    setModal(null)
    setImportText("")
    setImportFileName("Pasted CSV")
    setToast(
      `${additions.length} asset record${
        additions.length === 1 ? "" : "s"
      } imported as discovered; none were automatically approved in-scope.`,
    )
  }

  function commitScanImport() {
    if (!importedScanPreview.valid.length) return
    const additions = importedScanPreview.valid.map((scan) => ({
      ...scan,
      sourceName: scanImportFileName,
    }))
    const timestamp = new Date().toISOString()
    const importRecord: ImportRecord = {
      id: `IMP-${Date.now()}`,
      fileName: scanImportFileName,
      importedAt: timestamp,
      source: "Imported report",
      recordType: "Scan report",
      rowCount: importedScanPreview.rowCount,
      importedCount: additions.length,
      duplicateCount: importedScanPreview.duplicates,
      errorCount: importedScanPreview.errors.length,
    }
    setWorkspace((current) => ({
      ...current,
      scans: [...additions, ...current.scans],
      imports: [importRecord, ...current.imports],
      audit: [
        makeAudit(
          current.role,
          "Scan report imported",
          `${additions.length} scan record(s) from ${scanImportFileName}.`,
          "Imported report",
        ),
        ...current.audit,
      ],
    }))
    setModal(null)
    setScanImportText("")
    setScanImportFileName("Pasted scan report")
    setToast(
      `${additions.length} scan record(s) imported with source and import timestamp; no live scan was performed.`,
    )
  }

  function handleCsvFile(file: File) {
    void file
      .text()
      .then((text) => {
        setImportText(text)
        setImportFileName(file.name)
      })
      .catch(() => {
        setToast(`Could not read ${file.name}. Try pasting the CSV contents.`)
      })
  }

  function handleScanCsvFile(file: File) {
    void file
      .text()
      .then((text) => {
        setScanImportText(text)
        setScanImportFileName(file.name)
      })
      .catch(() => {
        setToast(`Could not read ${file.name}. Try pasting the scan report CSV.`)
      })
  }

  function updateAssetScope(ids: string[], scopeStatus: ScopeStatus) {
    if (workspace.role !== "Administrator") {
      openAction(
        "Administrator permission required",
        "Only the Administrator role may change asset scope in this rehearsal. A production service must enforce this permission on the server.",
      )
      return
    }
    setWorkspace((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        ids.includes(asset.id) ? { ...asset, scopeStatus } : asset,
      ),
      audit: [
        makeAudit(
          current.role,
          "Asset scope changed",
          `${ids.length} asset(s) set to ${scopeStatus}.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast(`${ids.length} asset scope record(s) updated in this browser.`)
  }

  function assignAssetGroup(ids: string[], targetGroup: string) {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can assign groups in this rehearsal.",
      )
      return
    }
    if (!targetGroup.trim()) {
      setToast("Enter a group name before assigning selected assets.")
      return
    }
    setWorkspace((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        ids.includes(asset.id)
          ? { ...asset, targetGroup: targetGroup.trim() }
          : asset,
      ),
      audit: [
        makeAudit(
          current.role,
          "Asset group assigned",
          `${ids.length} asset(s) assigned to ${targetGroup.trim()}.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast(`${ids.length} asset(s) assigned to ${targetGroup.trim()}.`)
  }

  function createPatchPlan(draft: PlanDraft) {
    if (
      workspace.role !== "RCC Engineer" &&
      workspace.role !== "Administrator"
    ) {
      setToast("Only the RCC Engineer may prepare a plan in this rehearsal.")
      return false
    }
    const plan: PatchPlan = {
      ...draft,
      id: `PLAN-${Date.now()}`,
      result: "Not tested",
      pilotResult: "Not run",
      pilotStatus: "Not requested",
      productionStatus: "Not requested",
      emergencyStatus: "Not requested",
      createdAt: new Date().toISOString(),
    }
    setWorkspace((current) => ({
      ...current,
      plans: [plan, ...current.plans],
      audit: [
        makeAudit(
          current.role,
          "Patch plan created",
          `${plan.id} · ${plan.updateId}`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setModal(null)
    setToast(`${plan.id} saved in this browser as a demonstration plan.`)
    return true
  }

  function recordPlanTest(planId: string, result: "Passed" | "Failed") {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can record rehearsal test results.",
      )
      return
    }
    setWorkspace((current) => ({
      ...current,
      plans: current.plans.map((plan) =>
        plan.id === planId ? { ...plan, result } : plan,
      ),
      audit: [
        makeAudit(
          workspace.role,
          "Test result recorded",
          `${planId} · ${result} · demonstration only.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast(`Demo test result recorded: ${result}.`)
  }

  function requestPlanApproval(
    planId: string,
    stage: "Pilot" | "Production" | "Emergency",
  ) {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator may submit an approval request.",
      )
      return
    }
    const plan = workspace.plans.find((candidate) => candidate.id === planId)
    if (!plan) return
    const hasCriticalPatch = workspace.scans.some(
      (scan) =>
        scan.updateId === plan.updateId &&
        scan.severity === "Critical" &&
        scan.applicability.toLowerCase().startsWith("applicable"),
    )
    const valid =
      stage === "Pilot"
        ? plan.result === "Passed"
        : stage === "Production"
          ? plan.pilotResult === "Passed"
          : plan.result === "Passed" && hasCriticalPatch
    if (!valid) {
      setToast(
        stage === "Production"
          ? "Production approval requires a passed pilot and its verified result."
          : stage === "Emergency"
            ? "Emergency requests require a critical applicable patch and passed test."
            : "Pilot approval requires a passing test result.",
      )
      return
    }
    const targetGroup =
      stage === "Pilot" ? plan.targetGroup : plan.productionGroup
    const targetAssetIds = workspace.assets
      .filter(
        (asset) =>
          asset.scopeStatus === "Approved in-scope" &&
          asset.targetGroup === targetGroup,
      )
      .map((asset) => asset.id)
    if (!targetAssetIds.length) {
      setToast(
        "The plan target group must contain confirmed in-scope assets before approval.",
      )
      return
    }
    if (!targetSetIsApplicable(workspace.scans, plan.updateId, targetAssetIds)) {
      setToast(
        "The selected group contains devices without applicable scan evidence for this update. Record a matching scan before requesting approval.",
      )
      return
    }
    const field =
      stage === "Pilot"
        ? "pilotStatus"
        : stage === "Production"
          ? "productionStatus"
          : "emergencyStatus"
    setWorkspace((current) => ({
      ...current,
      plans: current.plans.map((item) =>
        item.id === planId
          ? {
              ...item,
              [field]: "Pending",
              approvedScopeHash: scopeFingerprint(item, targetAssetIds),
            }
          : item,
      ),
      audit: [
        makeAudit(
          current.role,
          `${stage} approval requested`,
          `${planId} · exact scope fingerprint attached.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast(`${stage} approval request submitted in this rehearsal.`)
  }

  function decidePlanApproval(
    planId: string,
    stage: "Pilot" | "Production" | "Emergency",
    decision: "Approved" | "Rejected",
    comments: string,
  ) {
    if (!canApprove(workspace.role, stage)) {
      setToast("Only the AC Mobility Approver can decide approval requests.")
      return false
    }
    if (!comments.trim()) {
      setToast("Approval comments are required for attribution.")
      return false
    }
    const plan = workspace.plans.find((candidate) => candidate.id === planId)
    if (!plan) return false
    const field =
      stage === "Pilot"
        ? "pilotStatus"
        : stage === "Production"
          ? "productionStatus"
          : "emergencyStatus"
    const approvalFieldPending = plan[field] === "Pending"
    const targetGroup =
      stage === "Pilot" ? plan.targetGroup : plan.productionGroup
    const targetAssetIds = workspace.assets
      .filter(
        (asset) =>
          asset.scopeStatus === "Approved in-scope" &&
          asset.targetGroup === targetGroup,
      )
      .map((asset) => asset.id)
    if (
      !approvalFieldPending ||
      plan.approvedScopeHash !== scopeFingerprint(plan, targetAssetIds)
    ) {
      setToast(
        "Approval scope changed or is not pending. Submit a renewed request.",
      )
      return false
    }
    const approval: ApprovalRecord = {
      id: `APR-${Date.now()}`,
      planId,
      targetGroup: stage === "Pilot" ? plan.targetGroup : plan.productionGroup,
      stage,
      decision,
      approver: workspace.role,
      timestamp: new Date().toISOString(),
      comments: comments.trim(),
    }
    setWorkspace((current) => ({
      ...current,
      plans: current.plans.map((item) =>
        item.id === planId ? { ...item, [field]: decision } : item,
      ),
      approvals: [approval, ...current.approvals],
      audit: [
        makeAudit(
          workspace.role,
          `${stage} approval ${decision.toLowerCase()}`,
          `${planId} · ${comments.trim()}`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast(`${stage} approval ${decision.toLowerCase()} recorded locally.`)
    return true
  }

  function schedulePlanDeployment(
    planId: string,
    stage: "Pilot" | "Production" | "Emergency",
  ) {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can schedule a rehearsal deployment.",
      )
      return
    }
    const plan = workspace.plans.find((candidate) => candidate.id === planId)
    const targetGroup =
      stage === "Pilot" ? plan?.targetGroup : plan?.productionGroup
    const targetAssetIds = plan
      ? workspace.assets
          .filter(
            (asset) =>
              asset.scopeStatus === "Approved in-scope" &&
              asset.targetGroup === targetGroup,
          )
          .map((asset) => asset.id)
      : []
    if (
      plan &&
      !targetSetIsApplicable(workspace.scans, plan.updateId, targetAssetIds)
    ) {
      setToast(
        "The target group no longer matches applicable scan evidence. Record a matching scan and request renewed approval.",
      )
      return
    }
    if (
      !plan ||
      plan.approvedScopeHash !== scopeFingerprint(plan, targetAssetIds)
    ) {
      setToast(
        "Plan scope changed; renewed approval is required before scheduling.",
      )
      return
    }
    if (
      plan.schedule !== workspace.maintenanceWindow ||
      plan.rebootPolicy !== workspace.rebootPolicy
    ) {
      setToast(
        "The maintenance window or reboot policy changed since plan approval. Create a revised plan and request renewed approval.",
      )
      return
    }
    const isAuthorized =
      stage === "Pilot"
        ? plan.pilotStatus === "Approved"
        : stage === "Production"
          ? plan.productionStatus === "Approved" &&
            plan.pilotResult === "Passed"
          : plan.emergencyStatus === "Approved"
    if (!isAuthorized) {
      setToast("A current approval for this exact stage and plan is required.")
      return
    }
    const existing = workspace.deployments.find(
      (deployment) =>
        deployment.planId === planId && deployment.stage === stage,
    )
    if (existing) {
      setToast(
        existing.status === "Failed" && existing.attempts < workspace.retryLimit
          ? "A prior job exists. Use its retry action; duplicate jobs are blocked."
          : "A deployment job already exists for this plan and stage.",
      )
      return
    }
    const batchSize =
      stage === "Production"
        ? Math.max(1, workspace.productionBatchSize)
        : Math.max(1, targetAssetIds.length)
    const targetBatches = Array.from(
      { length: Math.ceil(targetAssetIds.length / batchSize) },
      (_, index) =>
        targetAssetIds.slice(index * batchSize, (index + 1) * batchSize),
    )
    const deployments: DeploymentRecord[] = targetBatches.map(
      (batchAssetIds, index) => ({
        id: `JOB-${Date.now()}-${index + 1}`,
        planId,
        targetGroup: stage === "Pilot" ? plan.targetGroup : plan.productionGroup,
        targetAssetIds: batchAssetIds,
        batchNumber: index + 1,
        batchCount: targetBatches.length,
        stage,
        status: "Queued",
        scheduledAt: new Date().toISOString(),
        rebootPolicy: plan.rebootPolicy,
        rebootResult: "Not confirmed",
        resultSource: "Demonstration",
        attempts: 0,
      }),
    )
    setWorkspace((current) => ({
      ...current,
      deployments: [...deployments, ...current.deployments],
      audit: [
        makeAudit(
          current.role,
          `${stage} deployment scheduled`,
          `${deployments.length} batch(es) · ${plan.updateId} · local rehearsal only.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast(
      `${deployments.length} ${stage.toLowerCase()} rehearsal batch(es) queued; no endpoint command was sent.`,
    )
    setPage("Deployments")
  }

  function startDemoDeployment(deploymentId: string) {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can start a rehearsal job.",
      )
      return
    }
    const deployment = workspace.deployments.find(
      (job) => job.id === deploymentId,
    )
    if (!deployment || deployment.status !== "Queued") return
    if (deployment.attempts >= workspace.retryLimit) {
      setToast(`Retry limit (${workspace.retryLimit}) reached.`)
      return
    }
    if (
      deployment.stage === "Production" &&
      deployment.batchNumber > 1 &&
      !workspace.deployments.some(
        (job) =>
          job.planId === deployment.planId &&
          job.stage === "Production" &&
          job.batchNumber === deployment.batchNumber - 1 &&
          job.status === "Verified",
      )
    ) {
      setToast(
        "Production batches run sequentially; verify the previous batch first.",
      )
      return
    }
    setWorkspace((current) => ({
      ...current,
      deployments: current.deployments.map((job) =>
        job.id === deploymentId
          ? { ...job, status: "Running", attempts: job.attempts + 1 }
          : job,
      ),
      audit: [
        makeAudit(
          current.role,
          "Demonstration deployment started",
          `${deploymentId} · endpoint command was not sent.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
  }

  function recordDemoDeploymentOutcome(
    deploymentId: string,
    status: "Failed" | "Offline / pending" | "Reboot required" | "Awaiting verification",
  ) {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can record a rehearsal result.",
      )
      return
    }
    setWorkspace((current) => ({
      ...current,
      deployments: current.deployments.map((job) =>
        job.id === deploymentId && job.status === "Running"
          ? {
              ...job,
              status,
              rebootResult:
                status === "Reboot required"
                  ? "Required · not performed"
                  : job.rebootResult,
            }
          : job,
      ),
      audit: [
        makeAudit(
          current.role,
          "Demonstration deployment result recorded",
          `${deploymentId} · ${status} · no connector execution.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast(`Demonstration result recorded: ${status}.`)
  }

  function recordDemoReboot(deploymentId: string) {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can record a rehearsal reboot.",
      )
      return
    }
    const job = workspace.deployments.find((item) => item.id === deploymentId)
    if (
      !job ||
      job.status !== "Reboot required" ||
      job.rebootPolicy === "Not confirmed"
    ) {
      setToast(
        "A reboot is unavailable without a reboot-required result and an authorized policy.",
      )
      return
    }
    setWorkspace((current) => ({
      ...current,
      deployments: current.deployments.map((item) =>
        item.id === deploymentId
          ? {
              ...item,
              status: "Awaiting verification",
              rebootResult: "Completed · demonstration only",
            }
          : item,
      ),
      audit: [
        makeAudit(
          current.role,
          "Reboot simulation recorded",
          `${deploymentId} · no endpoint was restarted.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast("Simulated reboot result saved; no device was restarted.")
  }

  function retryDemoDeployment(deploymentId: string) {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can retry a rehearsal job.",
      )
      return
    }
    const job = workspace.deployments.find((item) => item.id === deploymentId)
    if (
      !job ||
      !["Failed", "Offline / pending"].includes(job.status) ||
      job.attempts >= workspace.retryLimit
    ) {
      setToast(
        `Retry is unavailable; maximum attempts: ${workspace.retryLimit}.`,
      )
      return
    }
    setWorkspace((current) => ({
      ...current,
      deployments: current.deployments.map((item) =>
        item.id === deploymentId ? { ...item, status: "Queued" } : item,
      ),
      audit: [
        makeAudit(
          current.role,
          "Demonstration deployment retry queued",
          `${deploymentId} · retry ${job.attempts + 1} of ${workspace.retryLimit}.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
  }

  function verifyDemoDeployment(deploymentId: string) {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can record a verification rehearsal.",
      )
      return
    }
    const deployment = workspace.deployments.find(
      (item) => item.id === deploymentId,
    )
    const plan = workspace.plans.find((item) => item.id === deployment?.planId)
    if (!deployment || !plan || deployment.status !== "Awaiting verification") {
      setToast("Only an awaiting-verification job can be verified.")
      return
    }
    const targetAssetIds = deployment.targetAssetIds?.length
      ? deployment.targetAssetIds
      : workspace.assets
          .filter(
            (asset) =>
              asset.scopeStatus === "Approved in-scope" &&
              asset.targetGroup === deployment.targetGroup,
          )
          .map((asset) => asset.id)
    if (!targetAssetIds.length) {
      setToast("No approved in-scope assets match this plan's target group.")
      return
    }
    const timestamp = new Date().toISOString()
    const verification: ScanRecord = {
      id: `RESCAN-${Date.now()}`,
      updateId: plan.updateId,
      title: "Post-deployment verification rescan",
      product: "Plan target group",
      severity: "Not applicable",
      cves: [],
      applicability: "Not applicable after rescan · demonstration verification",
      affectedAssetIds: targetAssetIds,
      source: "Demonstration",
      sourceName: "Post-deployment rescan simulation",
      sourceTimestamp: timestamp,
    }
    if (
      !hasPostDeploymentVerification(
        plan,
        deployment,
        [...workspace.scans, verification],
        targetAssetIds,
      )
    ) {
      setToast(
        "Post-deployment rescan evidence is required before verification.",
      )
      return
    }
    setWorkspace((current) => ({
      ...current,
      scans: [verification, ...current.scans],
      assets: current.assets.map((asset) =>
        targetAssetIds.includes(asset.id)
          ? {
              ...asset,
              lastScan: timestamp,
              rebootStatus: deployment.rebootResult,
            }
          : asset,
      ),
      deployments: current.deployments.map((job) =>
        job.id === deploymentId ? { ...job, status: "Verified" } : job,
      ),
      plans: current.plans.map((item) =>
        item.id === plan.id && deployment.stage === "Pilot"
          ? { ...item, pilotResult: "Passed" }
          : item,
      ),
      audit: [
        makeAudit(
          current.role,
          "Remediation verified by rescan",
          `${deploymentId} · ${plan.updateId} · ${targetAssetIds.length} target(s) · demonstration source.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast(
      "Remediation marked verified from a demonstration rescan. No live evidence was received.",
    )
  }

  function recordDemonstrationScan() {
    if (!canSchedule(workspace.role)) {
      setToast(
        "Only an RCC Engineer or Administrator can record a demonstration scan.",
      )
      return
    }
    const sourceTimestamp = new Date().toISOString()
    const addedScans = demoScans.map((scan) => ({
      ...scan,
      id: `demo-${Date.now()}-${scan.updateId}`,
      sourceTimestamp,
    }))
    setWorkspace((current) => ({
      ...current,
      scans: [...addedScans, ...current.scans],
      assets: current.assets.map((asset) =>
        addedScans.some((scan) => scan.affectedAssetIds.includes(asset.id))
          ? { ...asset, lastScan: sourceTimestamp }
          : asset,
      ),
      audit: [
        makeAudit(
          current.role,
          "Demonstration scan recorded",
          `${addedScans.length} demonstration patch checks; no endpoint was contacted.`,
          "Demonstration",
        ),
        ...current.audit,
      ],
    }))
    setToast("Demonstration scan recorded locally; no connector was contacted.")
  }

  function openAction(
    title: string,
    description: string,
    confirmLabel = "Got it",
    onConfirm?: () => void,
  ) {
    setActionDialog({ title, description, confirmLabel, onConfirm })
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <span>R</span>
          </div>
          <div>
            <strong>RCC PatchGuard</strong>
            <small>AC Mobility</small>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          {nav.map((item) => (
            <div
              key={item.label}
              className={item.divider ? "nav-group-start" : ""}
            >
              <button
                className={`nav-item ${page === item.label ? "active" : ""}`}
                onClick={() => {
                  setPage(item.label)
                  setMenuOpen(false)
                }}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.label === "Approvals" && <i>2</i>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-status">
          <div className="status-row">
            <span className="status-dot offline" />
            <div>
              <strong>Device Integration</strong>
              <small>
                {liveDevices.length
                  ? `${liveDevices.length} live agent device${liveDevices.length === 1 ? "" : "s"}`
                  : "Agent evidence requires backend sign-in"}
              </small>
            </div>
          </div>
          <button onClick={() => setPage("Settings")}>
            Open settings <Icon name="arrow" size={14} />
          </button>
        </div>
        <div className="user-card">
          <div className="avatar">
            {workspace.role === "AC Mobility Approver"
              ? "AP"
              : workspace.role === "Administrator"
                ? "AD"
                : workspace.role === "Read-only Management"
                  ? "RM"
                  : "RE"}
          </div>
          <div>
            <strong>{workspace.role}</strong>
            <small>Rehearsal persona · not authenticated</small>
          </div>
          <button
            className="user-options-button"
            aria-label="Account options"
            onClick={() =>
              openAction(
                "Account",
                  "This sidebar role is a rehearsal persona, not an authenticated account. Use Enroll Device to sign in to the PatchGuard backend; only that server session authorizes token issuance or live record access.",
              )
            }
          >
            <Icon name="more" size={18} />
          </button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <Icon name="chevron" size={13} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <Badge tone="amber">
              January 2027 · rehearsal + live evidence separated
            </Badge>
            <div className="timezone">
              <Icon name="clock" size={15} />
              <span>
                Asia/Manila ·{" "}
                {new Intl.DateTimeFormat("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Manila",
                }).format(new Date())}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() =>
                openAction(
                  "Notifications",
                  "Sample workspace alerts: 2 approval requests are waiting for review, and 1 deployment failure needs a retry decision. These are rehearsal records, not live alerts.",
                )
              }
            >
              <Icon name="bell" size={18} />
            </button>
            <button
              className="help-button"
              aria-label="Help"
              onClick={() =>
                openAction(
                  "PatchGuard help",
                  "Use the navigation to review rehearsal workflows. Actual Windows agent devices and scans are fetched separately from the authenticated backend. Patch installation and reboot remain unavailable.",
                )
              }
            >
              ?
            </button>
          </div>
        </header>

        <div className="content">
          <div className="workspace-banner" role="status">
            <Icon name="info" size={16} />
            <span>
              Browser-persisted records are rehearsal only. Actual Windows
              agent evidence is fetched separately from the authenticated API;
              patch installation and restart are not supported. The 48-hour
              target remains proposed, pending AC Mobility confirmation.
            </span>
          </div>
          {storageError && (
            <div className="workspace-banner workspace-error" role="alert">
              <Icon name="warning" size={16} />
              <span>{storageError}</span>
            </div>
          )}
          <div className="page-title">
            <div>
              <div className="eyebrow">Patch management workspace</div>
              <h1>{pageMeta[page][0]}</h1>
              <p>{pageMeta[page][1]}</p>
            </div>
            <div className="page-actions">
              {page === "Assets" && (
                <Button
                  variant="secondary"
                  icon="upload"
                  onClick={() => setModal("import")}
                >
                  Import inventory
                </Button>
              )}
              {page === "Reports" && (
                <Button icon="report" onClick={() => setModal("report")}>
                  Preview report
                </Button>
              )}
              {page === "Overview" && (
                <Button icon="plus" onClick={() => setPage("Enroll Device")}>
                  Enroll first device
                </Button>
              )}
            </div>
          </div>

          {page === "Overview" && (
            <Overview
              assets={assets}
              workspace={workspace}
              metrics={scanMetrics}
              criticalTargetHours={workspace.criticalTargetHours}
              goTo={setPage}
              onEnroll={() => setPage("Enroll Device")}
            />
          )}
          {page === "Assets" && (
            <Assets
              assets={assets}
              importHistory={workspace.imports}
              onUpdateScope={updateAssetScope}
              onAssignGroup={assignAssetGroup}
              onEnroll={() => setPage("Enroll Device")}
              onImport={() => setModal("import")}
              liveDevices={liveDevices}
              liveLoading={liveLoading}
              liveError={liveError}
              authRequired={agentAuthRequired}
              canRevoke={agentUser?.role === "engineer"}
              onLiveRefresh={() => setAgentRefreshKey((key) => key + 1)}
              onRevoke={handleAgentRevoke}
            />
          )}
          {page === "Scan results" && (
            <ScanResults
              scans={workspace.scans}
              assets={workspace.assets}
              onRecordDemoScan={recordDemonstrationScan}
              onImportScanReport={() => setModal("scan-import")}
              onConfigure={() => setPage("Settings")}
              liveScans={liveScans}
              liveLoading={liveLoading}
              liveError={liveError}
              authRequired={agentAuthRequired}
              onLiveRefresh={() => setAgentRefreshKey((key) => key + 1)}
              onEnroll={() => setPage("Enroll Device")}
            />
          )}
          {page === "Enroll Device" && (
            <EnrollmentPage
              user={agentUser}
              sessionStatus={agentSessionStatus}
              sessionError={agentSessionError}
              onLogin={handleAgentLogin}
              onLogout={handleAgentLogout}
              onRefreshEvidence={() =>
                setAgentRefreshKey((current) => current + 1)
              }
            />
          )}
          {page === "Testing" && (
            <Testing
              plans={workspace.plans}
              onNewPlan={() => setModal("plan")}
              onRecordTest={recordPlanTest}
            />
          )}
          {page === "Approvals" && (
            <Approvals
              workspace={workspace}
              onRequest={requestPlanApproval}
              onDecision={decidePlanApproval}
              onSchedule={schedulePlanDeployment}
            />
          )}
          {page === "Deployments" && (
            <Deployments
              workspace={workspace}
              onStart={startDemoDeployment}
              onOutcome={recordDemoDeploymentOutcome}
              onRetry={retryDemoDeployment}
              onRebootComplete={recordDemoReboot}
              onNavigate={setPage}
            />
          )}
          {page === "Verification" && (
            <Verification
              workspace={workspace}
              onVerify={verifyDemoDeployment}
            />
          )}
          {page === "SLA monitoring" && <Sla workspace={workspace} />}
          {page === "Reports" && (
            <Reports
              workspace={workspace}
              openPreview={() => setModal("report")}
            />
          )}
          {page === "Exceptions & audit" && (
            <Exceptions
              workspace={workspace}
              onAddException={(record) => {
                if (!canSchedule(workspace.role)) {
                  setToast(
                    "Only an RCC Engineer or Administrator can record an exception.",
                  )
                  return
                }
                setWorkspace((current) => ({
                  ...current,
                  exceptions: [record, ...current.exceptions],
                  audit: [
                    makeAudit(
                      current.role,
                      "Exception recorded",
                      `${record.id} · ${record.assetOrUpdate} · ${record.status}`,
                      "Demonstration",
                    ),
                    ...current.audit,
                  ],
                }))
                setToast("Exception recorded in this browser.")
              }}
            />
          )}
          {page === "Settings" && (
            <Settings
              onEnroll={() => setPage("Enroll Device")}
              workspace={workspace}
              assets={assets}
              onWorkspaceChange={(changes, event) =>
                setWorkspace((current) => ({
                  ...current,
                  ...changes,
                  audit: event
                    ? [
                        makeAudit(
                          current.role,
                          event,
                          "Saved in this browser.",
                          "Demonstration",
                        ),
                        ...current.audit,
                      ]
                    : current.audit,
                }))
              }
              onAction={(title, description) =>
                openAction(title, description, "Close")
              }
            />
          )}
        </div>
      </main>

      {modal === "import" && (
        <ImportModal
          value={importText}
          setValue={setImportText}
          onFile={handleCsvFile}
          fileName={importFileName}
          preview={importedPreview}
          history={workspace.imports}
          onClose={() => setModal(null)}
          onImport={commitImport}
        />
      )}
      {modal === "scan-import" && (
        <ScanImportModal
          value={scanImportText}
          setValue={setScanImportText}
          onFile={handleScanCsvFile}
          fileName={scanImportFileName}
          preview={importedScanPreview}
          onClose={() => setModal(null)}
          onImport={commitScanImport}
        />
      )}
      {modal === "report" && (
        <ReportModal workspace={workspace} onClose={() => setModal(null)} />
      )}
      {modal === "plan" && (
        <PatchPlanModal
          scans={workspace.scans}
          workspace={workspace}
          onClose={() => setModal(null)}
          onCreate={createPatchPlan}
        />
      )}
      {actionDialog && (
        <ActionDialog
          title={actionDialog.title}
          description={actionDialog.description}
          confirmLabel={actionDialog.confirmLabel}
          onClose={() => setActionDialog(null)}
          onConfirm={() => {
            actionDialog.onConfirm?.()
            setActionDialog(null)
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <Icon name="check" size={18} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}

function Overview({
  assets,
  workspace,
  metrics,
  criticalTargetHours,
  goTo,
  onEnroll,
}: {
  assets: Asset[]
  workspace: WorkspaceState
  metrics: ReturnType<typeof summarizeScans>
  criticalTargetHours: number
  goTo: (page: Page) => void
  onEnroll: () => void
}) {
  const scopedAssets = assets.filter(
    (asset) => asset.scopeStatus === "Approved in-scope",
  )
  const workflowStatus = [
    `${assets.length} starting-reference records · completeness not confirmed`,
    `${workspace.scans.length} source-tagged scan records · ${workspace.scans.filter((scan) => scan.source === "Live connector").length} live`,
    `${workspace.scans.filter((scan) => scan.severity === "Critical" && scan.applicability.toLowerCase().startsWith("applicable")).length} applicable critical checks · target pending confirmation`,
    `${workspace.plans.length} plans · ${workspace.approvals.filter((approval) => approval.decision === "Approved").length} decisions recorded`,
    `${workspace.deployments.length} rehearsal jobs · no deployment connector`,
    `${workspace.deployments.filter((job) => job.status === "Verified").length} rescan-verified jobs · reports use stored records`,
  ]
  return (
    <div className="stack">
      <div className="notice-bar">
        <Icon name="info" size={18} />
        <div>
          <strong>
            January 2027 onboarding scenario · not a confirmed client schedule.
          </strong>
          <span>
            The supplied device list is a starting reference, not the complete
            1,300+ environment. Records below are demonstration data, not live
            Windows connectivity.
          </span>
        </div>
        <Button variant="ghost" onClick={() => goTo("Reports")}>
          View sample report
        </Button>
      </div>
      <div className="metric-grid">
        <MetricCard
          label="Starting reference assets"
          value={String(assets.length)}
          note={`${scopedAssets.length} approved in-scope · ${assets.filter((asset) => asset.source === "Demonstration").length} demo records`}
          icon="devices"
          onClick={() => goTo("Assets")}
        />
        <MetricCard
          label="Scan coverage"
          value="Not confirmed"
          note="Records do not include the total number of scanned devices"
          icon="scan"
          tone="blue"
          onClick={() => goTo("Scan results")}
        />
        <MetricCard
          label="Distinct patch checks"
          value={String(metrics.distinctPatchChecks)}
          note="Unique applicable update IDs · source-tagged"
          icon="check"
          tone="amber"
          onClick={() => goTo("Scan results")}
        />
        <MetricCard
          label="Affected devices"
          value={String(metrics.affectedDevices)}
          note={`${metrics.devicePatchInstances} unique update / device pairs`}
          icon="warning"
          tone="red"
          onClick={() => goTo("Scan results")}
        />
        <MetricCard
          label="Critical target"
          value={`${criticalTargetHours} hours`}
          note="Proposed · pending client confirmation"
          icon="refresh"
          tone="violet"
          onClick={() => goTo("SLA monitoring")}
        />
        <MetricCard
          label="Unconfirmed reboot status"
          value={String(
            assets.filter((asset) => asset.rebootStatus === "Not confirmed")
              .length,
          )}
          note="No live reboot evidence is connected"
          icon="shield"
          tone="green"
          onClick={() => goTo("Assets")}
        />
      </div>
      <div className="overview-grid">
        <Panel>
          <PanelHeading
            title="Patch operations workflow"
            description="Current activity across the controlled update lifecycle."
            action={
              <Badge tone="amber">
                January 2027 · proposed onboarding sequence
              </Badge>
            }
          />
          <div className="workflow">
            {[
              ["01", "Discover"],
              ["02", "Scan"],
              ["03", "Assess / prioritize"],
              ["04", "Test / approve"],
              ["05", "Deploy"],
              ["06", "Verify / report"],
            ].map(([step, title], index) => (
              <div className="workflow-row" key={title}>
                <div className="workflow-line">
                  <span>{step}</span>
                  {index < 5 && <i />}
                </div>
                <div>
                  <strong>{title}</strong>
                  <small>{workflowStatus[index]}</small>
                </div>
                <Badge tone="amber">
                  {index === 0
                    ? "Unconfirmed"
                    : index === 5 && workspace.deployments.some((job) => job.status === "Verified")
                      ? "Rehearsal verified"
                      : "Rehearsal / pending"}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
        <div className="stack">
          <Panel>
            <PanelHeading
              title="Device integration"
              description="Connector health and record freshness."
            />
            <div className="connection-card">
              <div className="connection-icon">
                <Icon name="plug" size={23} />
              </div>
              <div>
                <strong>Sample connector records</strong>
                <p>
                  These values are demonstration-only. Actual Windows agent
                  evidence is shown separately in Assets and Scan results.
                </p>
              </div>
            </div>
            <div className="key-values">
              <div>
                <span>Last heartbeat</span>
                <strong>Sample · 4 min ago</strong>
              </div>
              <div>
                <span>Last successful scan</span>
                <strong>Sample · 38 min ago</strong>
              </div>
              <div>
                <span>Stale device threshold</span>
                <strong>24 hours</strong>
              </div>
            </div>
            <Button variant="secondary" onClick={() => goTo("Settings")}>
              Configure integration
            </Button>
          </Panel>
          <Panel className="window-panel">
            <div className="window-icon">
              <Icon name="calendar" size={20} />
            </div>
            <div>
              <span>Next maintenance window</span>
              <strong>Saturday · 10:00 PM–2:00 AM</strong>
              <small>
                Standard deployment requires an approved off-peak window.
              </small>
            </div>
            <button onClick={() => goTo("Settings")}>
              <Icon name="chevron" size={17} />
            </button>
          </Panel>
        </div>
      </div>
      <Panel>
        <PanelHeading
          title="Operational coverage"
          description="Unscanned and stale devices are excluded from compliance."
          action={
            <Button variant="ghost" onClick={() => goTo("Assets")}>
              View assets <Icon name="arrow" size={14} />
            </Button>
          }
        />
        <div className="coverage-empty">
          <div className="donut">
            <span>24</span>
            <small>enrolled</small>
          </div>
          <div className="coverage-legend">
            <div>
              <i className="teal" />
              <span>Scanned and current</span>
              <strong>21</strong>
            </div>
            <div>
              <i className="gray" />
              <span>Unscanned</span>
              <strong>1</strong>
            </div>
            <div>
              <i className="orange" />
              <span>Stale or offline</span>
              <strong>2</strong>
            </div>
          </div>
          <div className="coverage-copy">
            <strong>87.5% sample scan coverage</strong>
            <p>
              Two stale devices and one unscanned device are excluded from
              compliance calculations.
            </p>
            <Button variant="secondary" onClick={() => goTo("Assets")}>
              Review coverage
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function Assets({
  assets,
  importHistory,
  liveDevices,
  liveLoading,
  liveError,
  authRequired,
  canRevoke,
  onEnroll,
  onImport,
  onUpdateScope,
  onAssignGroup,
  onLiveRefresh,
  onRevoke,
}: {
  assets: Asset[]
  importHistory: ImportRecord[]
  liveDevices: LiveAgentDevice[]
  liveLoading: boolean
  liveError: string
  authRequired: boolean
  canRevoke: boolean
  onEnroll: () => void
  onImport: () => void
  onUpdateScope: (ids: string[], status: ScopeStatus) => void
  onAssignGroup: (ids: string[], group: string) => void
  onLiveRefresh: () => void
  onRevoke: (device: LiveAgentDevice) => void
}) {
  const [query, setQuery] = useState("")
  const [scopeFilter, setScopeFilter] = useState("All scope states")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [groupName, setGroupName] = useState("")
  const pageSize = 10
  const filtered = assets.filter((asset) => {
    const matchesQuery = [
      asset.hostname,
      asset.ip,
      asset.osVersion,
      asset.deviceType,
      asset.businessOwner,
      asset.department,
      asset.site,
      asset.managementTool,
      asset.thirdPartyApplications,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
    return (
      matchesQuery &&
      (scopeFilter === "All scope states" || asset.scopeStatus === scopeFilter)
    )
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleAssets = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const allVisibleSelected =
    visibleAssets.length > 0 &&
    visibleAssets.every((asset) => selected.includes(asset.id))
  const scopeStatuses: ScopeStatus[] = [
    "Discovered",
    "Approved in-scope",
    "Excluded",
    "Unmanaged",
  ]
  return (
    <div className="stack">
      <LiveAgentDevicesPanel
        devices={liveDevices}
        loading={liveLoading}
        error={liveError}
        authRequired={authRequired}
        canRevoke={canRevoke}
        onRefresh={onLiveRefresh}
        onEnroll={onEnroll}
        onRevoke={(device) => {
          void device
        }}
      />
      <div className="subtle-banner">
        <Icon name="info" size={16} />
        <span>
          Device scope and inventory completeness have not been confirmed.
        </span>
      </div>
      <Panel>
        <div className="table-toolbar">
          <div className="search-field">
            <Icon name="search" size={17} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(0)
              }}
              placeholder="Search hostname, IP, OS, owner, tool…"
            />
          </div>
          <div className="toolbar-actions">
            <select
              aria-label="Filter by scope status"
              value={scopeFilter}
              onChange={(event) => {
                setScopeFilter(event.target.value)
                setPage(0)
              }}
            >
              <option>All scope states</option>
              {scopeStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <Button variant="secondary" icon="upload" onClick={onImport}>
              Import CSV
            </Button>
            <Button icon="plus" onClick={onEnroll}>
              Enroll device
            </Button>
          </div>
        </div>
        {selected.length > 0 && (
          <div className="bulk-toolbar">
            <strong>{selected.length} selected</strong>
            <input
              aria-label="Bulk target group"
              placeholder="Assign group"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
            />
            <Button
              variant="secondary"
              onClick={() => {
                onAssignGroup(selected, groupName)
                setGroupName("")
                setSelected([])
              }}
            >
              Assign group
            </Button>
            <select
              aria-label="Set selected asset scope"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  onUpdateScope(selected, event.target.value as ScopeStatus)
                  setSelected([])
                  event.target.value = ""
                }
              }}
            >
              <option value="" disabled>
                Set scope state…
              </option>
              {scopeStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        )}
        {assets.length === 0 ? (
          <EmptyState
            icon="devices"
            title="No devices enrolled"
            text="Enroll an authorized Windows device or import an inventory file for validation. Imported records remain separate until a connector checks in."
            action={
              <div className="button-row">
                <Button onClick={onEnroll}>Enroll first device</Button>
                <Button variant="secondary" onClick={onImport}>
                  Import inventory
                </Button>
              </div>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matching devices"
            text="Try a different hostname, IP address, or operating system search."
          />
        ) : (
          <>
            <Table
              headers={[
                "Select",
                "Device ID",
                "Hostname",
                "IP address",
                "OS / build",
                "Type",
                "Owner / department / site",
                "Criticality",
                "Scope",
                "Management tool",
                "Third-party applications",
                "Connectivity",
                "Scan",
                "Restart",
                "Source / timestamp",
                "Target group",
              ]}
            >
              {visibleAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${asset.hostname}`}
                      checked={selected.includes(asset.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, asset.id]
                            : current.filter((id) => id !== asset.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <span className="mono">{asset.id}</span>
                  </td>
                  <td>
                    <strong>{asset.hostname}</strong>
                  </td>
                  <td>{asset.ip || "—"}</td>
                  <td>{asset.osVersion}</td>
                  <td>{asset.deviceType}</td>
                  <td>{`${asset.businessOwner} / ${asset.department} / ${asset.site}`}</td>
                  <td>{asset.criticality}</td>
                  <td>
                    <Badge
                      tone={
                        asset.scopeStatus === "Approved in-scope"
                          ? "low"
                          : "amber"
                      }
                    >
                      {asset.scopeStatus}
                    </Badge>
                  </td>
                  <td>{asset.managementTool}</td>
                  <td>{asset.thirdPartyApplications}</td>
                  <td>{asset.connectivity}</td>
                  <td>
                    {asset.lastScan === "Not confirmed"
                      ? asset.lastScan
                      : formatTimestamp(asset.lastScan)}
                  </td>
                  <td>{asset.rebootStatus}</td>
                  <td>{`${asset.source} · ${formatTimestamp(asset.sourceTimestamp)}`}</td>
                  <td>{asset.targetGroup}</td>
                </tr>
              ))}
            </Table>
            <div className="table-pagination">
              <span>
                Showing {filtered.length ? page * pageSize + 1 : 0}–
                {Math.min((page + 1) * pageSize, filtered.length)} of{" "}
                {filtered.length} filtered · {assets.length} total
              </span>
              <div>
                <Button
                  variant="secondary"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {page + 1} of {pageCount}
                </span>
                <Button
                  variant="secondary"
                  disabled={page + 1 >= pageCount}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>
      <Panel>
        <PanelHeading
          title="Import history"
          description="CSV inventory imports are persisted in this browser; each row remains an unconfirmed discovered record."
        />
        {importHistory.length ? (
          <Table
            headers={[
              "File",
              "Type",
              "Imported",
              "Source",
              "Rows",
              "Added",
              "Duplicates",
              "Issues",
            ]}
          >
            {importHistory.map((record) => (
              <tr key={record.id}>
                <td>{record.fileName}</td>
                <td>{record.recordType || "Assets"}</td>
                <td>{formatTimestamp(record.importedAt)}</td>
                <td>{record.source}</td>
                <td>{record.rowCount}</td>
                <td>{record.importedCount}</td>
                <td>{record.duplicateCount}</td>
                <td>{record.errorCount}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="empty-inline">No inventory imports recorded yet.</p>
        )}
      </Panel>
    </div>
  )
}

function LiveAgentDevicesPanel({
  devices,
  loading,
  error,
  authRequired,
  canRevoke,
  onRefresh,
  onEnroll,
  onRevoke,
}: {
  devices: LiveAgentDevice[]
  loading: boolean
  error: string
  authRequired: boolean
  canRevoke: boolean
  onRefresh: () => void
  onEnroll: () => void
  onRevoke: (device: LiveAgentDevice) => void
}) {
  return (
    <Panel>
  <PanelHeading
  title="Live Windows agent devices"
  description="Actual backend records only · heartbeat time is the API receipt time."
  action={
  <div className="button-row">
  <Button variant="secondary" icon="refresh" onClick={onRefresh}>
  Refresh
  </Button>
  <Button icon="lock" onClick={onEnroll}>
  Connect another computer
  </Button>
  </div>
  }
  />
  <div className="subtle-banner">
  <Icon name="plug" size={16} />
  <span>
  Monitor another Windows computer remotely by installing the PatchGuard agent there. Use the enrollment flow to create a one-time token for each computer; this dashboard does not execute commands or restart devices.
  </span>
  </div>
  {loading ? (
        <p className="empty-inline">Loading authenticated agent records…</p>
      ) : authRequired ? (
        <p className="empty-inline" role="status">
          Sign in through Enroll Device to view actual agent records.
        </p>
      ) : error ? (
        <p className="empty-inline" role="alert">
          Live device records are unavailable: {error}
        </p>
      ) : devices.length === 0 ? (
        <p className="empty-inline">
          No Windows agent devices are registered in the backend. Demo and
          imported assets below are separate browser records.
        </p>
      ) : (
        <Table
          headers={[
            "Hostname",
            "OS / version / build",
            "Architecture",
            "Agent",
            "Connectivity",
            "Last heartbeat · API received",
            "Last scan",
            "Reboot",
            "Source",
            ...(canRevoke ? ["Credential"] : []),
          ]}
        >
          {devices.map((device) => (
            <tr key={device.id}>
              <td>
                <strong>{device.hostname}</strong>
                <small className="table-sub mono">{device.id}</small>
              </td>
              <td>
                {[device.os_name, device.os_version, device.os_build]
                  .filter(Boolean)
                  .join(" · ") || "Not confirmed"}
              </td>
              <td>{device.architecture || "Not confirmed"}</td>
              <td>{device.agent_version || "Not confirmed"}</td>
              <td>
                {device.last_heartbeat_at
                  ? "Heartbeat received"
                  : "Not confirmed"}
              </td>
              <td>
                {device.last_heartbeat_at
                  ? formatTimestamp(device.last_heartbeat_at)
                  : "Not confirmed"}
              </td>
              <td>
                {device.last_scan_at
                  ? formatTimestamp(device.last_scan_at)
                  : "No scan received"}
              </td>
              <td>
                {device.restart_status === "required"
                  ? "Required"
                  : device.restart_status === "not_required"
                    ? "Not required"
                    : "Not confirmed"}
              </td>
              <td>
                <Badge tone="low">Live connector</Badge>
                <small className="table-sub">Windows agent</small>
              </td>
              {canRevoke && (
                <td>
                  <Button
                    variant="danger"
                    onClick={() => onRevoke(device)}
                    title={`Revoke the credential for ${device.hostname}`}
                  >
                    Revoke credential
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  )
}

function ScanResults({
  scans,
  assets,
  liveScans,
  liveLoading,
  liveError,
  authRequired,
  onRecordDemoScan,
  onImportScanReport,
  onConfigure,
  onLiveRefresh,
  onEnroll,
}: {
  scans: ScanRecord[]
  assets: Asset[]
  liveScans: LiveAgentScan[]
  liveLoading: boolean
  liveError: string
  authRequired: boolean
  onRecordDemoScan: () => void
  onImportScanReport: () => void
  onConfigure: () => void
  onLiveRefresh: () => void
  onEnroll: () => void
}) {
  const [findingState, setFindingState] = useState("All states")
  const [sourceFilter, setSourceFilter] = useState("All sources")
  const visibleFindings = scans.filter(
    (scan) =>
      (findingState === "All states" ||
        scan.applicability.startsWith(findingState)) &&
      (sourceFilter === "All sources" || scan.source === sourceFilter),
  )
  const metrics = summarizeScans(visibleFindings)
  const assetById = new Map(assets.map((asset) => [asset.id, asset.hostname]))
  return (
    <div className="stack">
      <LiveAgentScansPanel
        scans={liveScans}
        loading={liveLoading}
        error={liveError}
        authRequired={authRequired}
        onRefresh={onLiveRefresh}
        onEnroll={onEnroll}
      />
      <div className="filter-bar">
        <div className="filter-label">
          <Icon name="scan" size={17} />
          <strong>Findings</strong>
          <Badge>{visibleFindings.length} source records</Badge>
        </div>
        <div className="filter-actions">
          <select
            aria-label="Finding state"
            value={findingState}
            onChange={(event) => setFindingState(event.target.value)}
          >
            <option>All states</option>
            <option>Applicable</option>
            <option>Superseded</option>
            <option>Unsupported</option>
            <option>Blocked</option>
            <option>Unknown</option>
          </select>
          <select
            aria-label="Scan data source"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option>All sources</option>
            <option>Imported report</option>
            <option>Demonstration</option>
            <option>Live connector</option>
          </select>
          <Button variant="secondary" icon="scan" onClick={onRecordDemoScan}>
            Record demo scan
          </Button>
          <Button
            variant="secondary"
            icon="upload"
            onClick={onImportScanReport}
          >
            Import scan report
          </Button>
          <Button variant="secondary" icon="refresh" onClick={onConfigure}>
            Connector settings
          </Button>
        </div>
      </div>
      <Panel>
        <div className="subtle-banner">
          <Icon name="info" size={16} />
          <span>
            Imported reports and browser demonstration records stay separate
            from the actual API-submitted Windows agent records above.
          </span>
        </div>
        <div className="scan-metrics" aria-label="Scan metric definitions">
          <div>
            <strong>{metrics.distinctPatchChecks}</strong>
            <span>Distinct patch checks · unique update IDs</span>
          </div>
          <div>
            <strong>{metrics.affectedDevices}</strong>
            <span>Affected devices · unique asset IDs</span>
          </div>
          <div>
            <strong>{metrics.devicePatchInstances}</strong>
            <span>
              Device-level patch instances · unique update / device pairs
            </span>
          </div>
        </div>
        <Table
          headers={[
            "Update",
            "Title",
            "Product",
            "Severity",
            "CVE",
            "Applicability",
            "Affected assets",
            "Source",
            "Source timestamp",
          ]}
        >
          {visibleFindings.map((scan) => (
            <tr key={scan.id}>
              <td>
                <strong>{scan.updateId}</strong>
              </td>
              <td>{scan.title}</td>
              <td>{scan.product}</td>
              <td>
                <Badge tone={scan.severity.toLowerCase()}>
                  {scan.severity}
                </Badge>
              </td>
              <td>
                {scan.cves.length ? scan.cves.join(", ") : "Not confirmed"}
              </td>
              <td>{scan.applicability}</td>
              <td>
                {scan.affectedAssetIds.length
                  ? scan.affectedAssetIds
                      .map((id) => assetById.get(id) || id)
                      .join(", ")
                  : "Not confirmed"}
              </td>
              <td>
                <Badge
                  tone={scan.source === "Live connector" ? "low" : "amber"}
                >
                  {scan.source}
                </Badge>
                <small className="table-sub">{scan.sourceName}</small>
              </td>
              <td>{formatTimestamp(scan.sourceTimestamp)}</td>
            </tr>
          ))}
        </Table>
        {visibleFindings.length === 0 && (
          <p className="empty-inline">
            No scan records match these filters. Import a report or record a
            clearly labeled demonstration scan.
          </p>
        )}
        <IntegrationNote>
          A live scan requires an authenticated, restricted Windows connector.
          Recording a demo scan only appends rehearsal data to this browser.
        </IntegrationNote>
      </Panel>
    </div>
  )
}

function LiveAgentScansPanel({
  scans,
  loading,
  error,
  authRequired,
  onRefresh,
  onEnroll,
}: {
  scans: LiveAgentScan[]
  loading: boolean
  error: string
  authRequired: boolean
  onRefresh: () => void
  onEnroll: () => void
}) {
  return (
    <Panel>
      <PanelHeading
        title="Live Windows agent scan submissions"
        description="Read-only Windows configured update source results · not a full vulnerability scan."
        action={
          <div className="button-row">
            <Button variant="secondary" icon="refresh" onClick={onRefresh}>
              Refresh
            </Button>
            <Button icon="lock" onClick={onEnroll}>
              Enroll Device
            </Button>
          </div>
        }
      />
      {loading ? (
        <p className="empty-inline">Loading actual submitted scan records…</p>
      ) : authRequired ? (
        <p className="empty-inline" role="status">
          Sign in through Enroll Device to view actual scan submissions.
        </p>
      ) : error ? (
        <p className="empty-inline" role="alert">
          Live scan records are unavailable: {error}
        </p>
      ) : scans.length === 0 ? (
        <p className="empty-inline">
          No agent scan submissions have been received. Demonstration and
          imported reports remain in the separate table below.
        </p>
      ) : (
        <Table
          headers={[
            "Device",
            "Scanned at · source time",
            "Received at · server time",
            "Source",
            "Update / title",
            "KB",
            "Severity",
            "Applicability",
          ]}
        >
          {scans.flatMap((scan) =>
            scan.updates.length
              ? scan.updates.map((update) => (
                  <tr key={update.id}>
                    <td>
                      <strong>{scan.hostname}</strong>
                      <small className="table-sub mono">{scan.id}</small>
                    </td>
                    <td>{formatTimestamp(scan.completed_at || scan.started_at)}</td>
                    <td>
                      {scan.received_at
                        ? formatTimestamp(scan.received_at)
                        : "Not confirmed"}
                    </td>
                    <td>
                      <Badge tone="low">Live connector</Badge>
                      <small className="table-sub">{update.source || scan.provider}</small>
                    </td>
                    <td>
                      <strong>{update.update_id}</strong>
                      <small className="table-sub">{update.title}</small>
                    </td>
                    <td>{update.kb || "Not confirmed"}</td>
                    <td>{update.severity || "Not confirmed"}</td>
                    <td>{update.applicability}</td>
                  </tr>
                ))
              : [
                  <tr key={scan.id}>
                    <td>
                      <strong>{scan.hostname}</strong>
                      <small className="table-sub mono">{scan.id}</small>
                    </td>
                    <td>{formatTimestamp(scan.completed_at || scan.started_at)}</td>
                    <td>
                      {scan.received_at
                        ? formatTimestamp(scan.received_at)
                        : "Not confirmed"}
                    </td>
                    <td>
                      <Badge tone="low">Live connector</Badge>
                      <small className="table-sub">{scan.provider}</small>
                    </td>
                    <td colSpan={4}>No applicable updates reported by this scan.</td>
                  </tr>,
                ],
          )}
        </Table>
      )}
    </Panel>
  )
}

function Testing({
  plans,
  onNewPlan,
  onRecordTest,
}: {
  plans: PatchPlan[]
  onNewPlan: () => void
  onRecordTest: (planId: string, result: "Passed" | "Failed") => void
}) {
  return (
    <div className="stack">
      <Panel>
        <PanelHeading
          title="Test plans"
          description="Testing must pass before pilot approval. Pilot deployment must verify before production approval."
          action={
            <Button icon="plus" onClick={onNewPlan}>
              New test plan
            </Button>
          }
        />
        <Table
          headers={[
            "Plan",
            "Exact updates",
            "Pilot / production groups",
            "Test evidence / app checks",
            "Recovery plan",
            "Rollout criteria",
            "Reboot policy",
            "Test result",
            "Actions",
          ]}
        >
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>
                <strong>{plan.id}</strong>
              </td>
              <td>{plan.updateId}</td>
              <td>
                {plan.targetGroup} → {plan.productionGroup}
              </td>
              <td>
                {plan.evidence} / {plan.applicationChecks}
              </td>
              <td>{plan.recoveryPlan}</td>
              <td>{plan.rolloutCriteria}</td>
              <td>{plan.rebootPolicy}</td>
              <td>
                <Badge
                  tone={
                    plan.result === "Passed"
                      ? "low"
                      : plan.result === "Failed"
                        ? "critical"
                        : "neutral"
                  }
                >
                  {plan.result} · rehearsal
                </Badge>
              </td>
              <td>
                <div className="workflow-actions">
                  <Button
                    variant="secondary"
                    disabled={plan.result === "Passed"}
                    onClick={() => onRecordTest(plan.id, "Passed")}
                  >
                    Record sample pass
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={plan.result === "Failed"}
                    onClick={() => onRecordTest(plan.id, "Failed")}
                  >
                    Record sample fail
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {!plans.length && (
          <EmptyState
            icon="flask"
            title="No patch plans yet"
            text="Import or select a patch finding, confirm approved pilot and production groups, then create a plan with evidence and recovery criteria."
            action={
              <Button onClick={onNewPlan}>Create first patch plan</Button>
            }
          />
        )}
      </Panel>
      <div className="two-col">
        <InfoPanel
          title="Required evidence"
          items={[
            "Exact update ID and revision",
            "Test device OS, product, and version",
            "Recovery readiness and limitations",
            "Install result and restart state",
            "Application and service checks",
          ]}
        />
        <InfoPanel
          title="Validation boundaries"
          items={[
            "One OS version does not validate another",
            "Manual evidence is visibly distinguished",
            "Attachments preserve owner and timestamp",
            "Non-uninstallable updates have no rollback promise",
          ]}
        />
      </div>
    </div>
  )
}

function PatchPlanModal({
  scans,
  workspace,
  onClose,
  onCreate,
}: {
  scans: ScanRecord[]
  workspace: WorkspaceState
  onClose: () => void
  onCreate: (draft: PlanDraft) => boolean
}) {
  const [draft, setDraft] = useState<PlanDraft>({
    updateId:
      scans.find((scan) =>
        scan.applicability.toLowerCase().startsWith("applicable"),
      )?.updateId ?? "",
    targetGroup: workspace.pilotGroup,
    productionGroup: "Production batch 1 · Not confirmed",
    evidence: "",
    applicationChecks: "",
    recoveryPlan: "",
    rolloutCriteria: "",
    schedule: workspace.maintenanceWindow,
    rebootPolicy: workspace.rebootPolicy,
  })
  const applicablePatches = [
    ...new Set(
      scans
        .filter((scan) =>
          scan.applicability.toLowerCase().startsWith("applicable"),
        )
        .map((scan) => scan.updateId),
    ),
  ]
  const canCreate =
    workspace.role === "RCC Engineer" || workspace.role === "Administrator"
  const update = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  return (
    <Modal title="Create patch plan" onClose={onClose} wide>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(draft)
        }}
      >
        <div className="modal-body plan-form">
          <div className="subtle-banner">
            <Icon name="warning" size={16} />
            <span>
              Rehearsal only. This records plan evidence locally; it does not
              install patches, contact devices, or represent approved client
              scope.
            </span>
          </div>
          <label>
            Patch / KB reference
            <input
              required
              list="applicable-patches"
              value={draft.updateId}
              onChange={(event) => update("updateId", event.target.value)}
              placeholder="KB or update identifier"
            />
            <datalist id="applicable-patches">
              {applicablePatches.map((patch) => (
                <option key={patch} value={patch} />
              ))}
            </datalist>
          </label>
          <label>
            Pilot group
            <input
              required
              value={draft.targetGroup}
              onChange={(event) => update("targetGroup", event.target.value)}
            />
          </label>
          <label>
            Phased production group
            <input
              required
              value={draft.productionGroup}
              onChange={(event) =>
                update("productionGroup", event.target.value)
              }
            />
          </label>
          <label>
            Test evidence
            <textarea
              required
              value={draft.evidence}
              onChange={(event) => update("evidence", event.target.value)}
              placeholder="Exact OS/build, update revision, install, restart and evidence source"
            />
          </label>
          <label>
            Application / service checks
            <textarea
              required
              value={draft.applicationChecks}
              onChange={(event) =>
                update("applicationChecks", event.target.value)
              }
            />
          </label>
          <label>
            Recovery plan and limitations
            <textarea
              required
              value={draft.recoveryPlan}
              onChange={(event) => update("recoveryPlan", event.target.value)}
            />
          </label>
          <label>
            Rollout / stop criteria
            <textarea
              required
              value={draft.rolloutCriteria}
              onChange={(event) =>
                update("rolloutCriteria", event.target.value)
              }
            />
          </label>
          <label>
            Asia/Manila schedule / maintenance window
            <input
              required
              value={draft.schedule}
              onChange={(event) => update("schedule", event.target.value)}
            />
          </label>
          <label>
            Reboot policy
            <select
              value={draft.rebootPolicy}
              onChange={(event) => update("rebootPolicy", event.target.value)}
            >
              <option>Prompt employee; reboot requires approved policy</option>
              <option>Reboot only in approved window</option>
              <option>No automatic reboot</option>
              <option>Not confirmed</option>
            </select>
          </label>
          {!canCreate && (
            <p className="field-help">
              Switch to the RCC Engineer rehearsal persona to create a plan.
              This persona switch is not authenticated access control.
            </p>
          )}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canCreate}>
            Save patch plan
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Approvals({
  workspace,
  onRequest,
  onDecision,
  onSchedule,
}: {
  workspace: WorkspaceState
  onRequest: (
    planId: string,
    stage: "Pilot" | "Production" | "Emergency",
  ) => void
  onDecision: (
    planId: string,
    stage: "Pilot" | "Production" | "Emergency",
    decision: "Approved" | "Rejected",
    comments: string,
  ) => boolean
  onSchedule: (
    planId: string,
    stage: "Pilot" | "Production" | "Emergency",
  ) => void
}) {
  const [comments, setComments] = useState<Record<string, string>>({})
  const stages = ["Pilot", "Production", "Emergency"] as const
  return (
    <div className="stack">
      <div className="role-banner">
        <Icon name="lock" />
        <div>
          <strong>{workspace.role}</strong>
        </div>
      </div>
      <Panel>
        <PanelHeading
          title="Pilot, production, and emergency approvals"
          description="Each approval is bound to patch, target group membership, test evidence, schedule, and reboot policy."
        />
        {!workspace.plans.length && (
          <EmptyState
            icon="check"
            title="No approval requests"
            text="Create a patch plan and record a passing test before requesting pilot authorization."
          />
        )}
        {workspace.plans.map((plan) => {
          const critical = workspace.scans.some(
            (scan) =>
              scan.updateId === plan.updateId &&
              scan.severity === "Critical" &&
              scan.applicability.toLowerCase().startsWith("applicable"),
          )
          const statusFor = {
            Pilot: plan.pilotStatus,
            Production: plan.productionStatus,
            Emergency: plan.emergencyStatus,
          }
          return (
            <div className="approval-plan" key={plan.id}>
              <div className="approval-plan-heading">
                <div>
                  <strong>
                    {plan.id} · {plan.updateId}
                  </strong>
                  <span>
                    Pilot: {plan.targetGroup} · Production:{" "}
                    {plan.productionGroup}
                  </span>
                  <span>
                    Test: {plan.result} · Pilot verification: {plan.pilotResult}
                  </span>
                </div>
                <Badge tone={plan.result === "Passed" ? "low" : "amber"}>
                  {plan.result}
                </Badge>
              </div>
              {stages.map((stage) => {
                const status = statusFor[stage]
                const available =
                  stage === "Pilot"
                    ? plan.result === "Passed"
                    : stage === "Production"
                      ? plan.pilotResult === "Passed"
                      : critical && plan.result === "Passed"
                const key = `${plan.id}-${stage}`
                const mayDecide = canApprove(workspace.role, stage)
                const maySubmit = canSchedule(workspace.role)
                return (
                  <div className="approval-stage" key={stage}>
                    <div>
                      <strong>
                        {stage === "Emergency"
                          ? "Emergency route"
                          : `${stage} approval`}
                      </strong>
                      <Badge
                        tone={
                          status === "Approved"
                            ? "low"
                            : status === "Rejected"
                              ? "critical"
                              : status === "Pending"
                                ? "amber"
                                : "neutral"
                        }
                      >
                        {status}
                      </Badge>
                      <small>
                        {stage === "Emergency"
                          ? "Critical patch only · approval still required"
                          : stage === "Production"
                            ? "Requires verified pilot outcome"
                            : "Requires passing test plan"}
                      </small>
                    </div>
                    <label>
                      Decision comments
                      <input
                        value={comments[key] || ""}
                        onChange={(event) =>
                          setComments((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        placeholder="Required for approve/reject"
                      />
                    </label>
                    {status === "Pending" ? (
                      mayDecide ? (
                        <div className="workflow-actions">
                          <Button
                            onClick={() => {
                              if (
                                onDecision(
                                  plan.id,
                                  stage,
                                  "Approved",
                                  comments[key] || "",
                                )
                              ) {
                                setComments((current) => ({
                                  ...current,
                                  [key]: "",
                                }))
                              }
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => {
                              if (
                                onDecision(
                                  plan.id,
                                  stage,
                                  "Rejected",
                                  comments[key] || "",
                                )
                              ) {
                                setComments((current) => ({
                                  ...current,
                                  [key]: "",
                                }))
                              }
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <small>Only AC Mobility Approver may decide.</small>
                      )
                    ) : status === "Approved" ? (
                      <Button
                        disabled={!maySubmit}
                        title={
                          !maySubmit
                            ? "RCC Engineer or Administrator scheduling permission required."
                            : ""
                        }
                        onClick={() => onSchedule(plan.id, stage)}
                      >
                        Schedule {stage.toLowerCase()} rehearsal
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={!available || !maySubmit}
                        title={
                          !available
                            ? "The required test/pilot result or critical finding is not available."
                            : !maySubmit
                              ? "RCC Engineer or Administrator submission permission required."
                              : ""
                        }
                        onClick={() => onRequest(plan.id, stage)}
                      >
                        Request {stage.toLowerCase()} approval
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </Panel>
      <Panel>
        <PanelHeading
          title="Approval decision audit"
          description="Approver, decision, timestamp, comments, and source are persisted in this browser rehearsal."
        />
        {workspace.approvals.length ? (
          <Table
            headers={[
              "Request",
              "Stage",
              "Decision",
              "Approver",
              "Timestamp",
              "Comments",
            ]}
          >
            {workspace.approvals.map((approval) => (
              <tr key={approval.id}>
                <td>{approval.planId}</td>
                <td>{approval.stage}</td>
                <td>{approval.decision}</td>
                <td>{approval.approver}</td>
                <td>{formatTimestamp(approval.timestamp)}</td>
                <td>{approval.comments}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="empty-inline">
            No approval decisions have been recorded.
          </p>
        )}
      </Panel>
      <div className="approval-rules">
        <div>
          <Icon name="shield" />
          <strong>Server-side enforcement</strong>
          <p>
            Unapproved deployment requests must be rejected by the authenticated
            API.
          </p>
        </div>
        <div>
          <Icon name="refresh" />
          <strong>Scope-change protection</strong>
          <p>
            Any change to an approved patch, target, window, or restart policy
            requires renewed approval.
          </p>
        </div>
        <div>
          <Icon name="history" />
          <strong>Complete attribution</strong>
          <p>
            Approver identity, timestamp, role, decision, and comments are audit
            records.
          </p>
        </div>
      </div>
    </div>
  )
}

function Deployments({
  workspace,
  onStart,
  onOutcome,
  onRetry,
  onRebootComplete,
  onNavigate,
}: {
  workspace: WorkspaceState
  onStart: (deploymentId: string) => void
  onOutcome: (
    deploymentId: string,
    status: "Failed" | "Offline / pending" | "Reboot required" | "Awaiting verification",
  ) => void
  onRetry: (deploymentId: string) => void
  onRebootComplete: (deploymentId: string) => void
  onNavigate: (page: Page) => void
}) {
  const statuses: DeploymentRecord["status"][] = [
    "Queued",
    "Running",
    "Failed",
    "Offline / pending",
    "Reboot required",
    "Awaiting verification",
    "Verified",
  ]
  const statusTone = (status: DeploymentRecord["status"]) =>
    status === "Verified"
      ? "low"
      : status === "Failed"
        ? "critical"
        : status === "Reboot required"
          ? "amber"
          : "neutral"
  return (
    <div className="stack">
      <Panel>
        <PanelHeading
          title="Approved deployment jobs"
          description="Routine changes use approved Asia/Manila off-peak windows; emergency work remains separately approved."
        />
        <div className="job-status-strip">
          {statuses.map((status) => (
            <div key={status}>
              <strong>
                {
                  workspace.deployments.filter((job) => job.status === status)
                    .length
                }
              </strong>
              <span>{status}</span>
            </div>
          ))}
        </div>
        <Table
          headers={[
            "Job",
            "Plan / patch",
            "Group / stage",
            "Scheduled · Asia/Manila",
            "Attempt",
            "Reboot policy / result",
            "Status",
            "Actions",
          ]}
        >
          {workspace.deployments.map((job) => {
            const plan = workspace.plans.find((item) => item.id === job.planId)
            return (
              <tr key={job.id}>
                <td>
                  <strong>{job.id}</strong>
                  <small className="table-sub">
                    {job.resultSource} · no endpoint action
                  </small>
                </td>
                <td>
                  {plan?.id || "Not confirmed"} ·{" "}
                  {plan?.updateId || "Not confirmed"}
                </td>
                <td>
                  {job.targetGroup} · {job.stage}
                  <small className="table-sub">
                    Batch {job.batchNumber ?? 1} of {job.batchCount ?? 1} ·{" "}
                    {job.targetAssetIds?.length ?? 0} target asset(s)
                  </small>
                </td>
                <td>
                  {formatTimestamp(job.scheduledAt)}
                  <small className="table-sub">
                    {plan?.schedule || "Not confirmed"}
                  </small>
                </td>
                <td>
                  {job.attempts} / {workspace.retryLimit}
                </td>
                <td>
                  {job.rebootPolicy} / {job.rebootResult}
                </td>
                <td>
                  <Badge tone={statusTone(job.status)}>
                    {job.status} · demo
                  </Badge>
                </td>
                <td>
                  {job.status === "Queued" && (
                    <Button onClick={() => onStart(job.id)}>
                      Start demonstration
                    </Button>
                  )}
                  {job.status === "Running" && (
                    <div className="workflow-actions">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          onOutcome(job.id, "Awaiting verification")
                        }
                      >
                        Record installed
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => onOutcome(job.id, "Reboot required")}
                      >
                        Needs reboot
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => onOutcome(job.id, "Offline / pending")}
                      >
                        Offline / pending
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => onOutcome(job.id, "Failed")}
                      >
                        Record failure
                      </Button>
                    </div>
                  )}
                  {job.status === "Reboot required" && (
                    <Button
                      variant="secondary"
                      onClick={() => onRebootComplete(job.id)}
                    >
                      Record simulated reboot result
                    </Button>
                  )}
                  {["Failed", "Offline / pending"].includes(job.status) && (
                    <Button
                      variant="secondary"
                      disabled={job.attempts >= workspace.retryLimit}
                      title={`Retry limit: ${workspace.retryLimit}`}
                      onClick={() => onRetry(job.id)}
                    >
                      Retry demonstration
                    </Button>
                  )}
                  {job.status === "Awaiting verification" && (
                    <Button
                      variant="secondary"
                      onClick={() => onNavigate("Verification")}
                    >
                      Open verification queue
                    </Button>
                  )}
                  {job.status === "Verified" && (
                    <span>Rescan evidence recorded</span>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>
        {!workspace.deployments.length && (
          <EmptyState
            icon="rocket"
            title="No deployment jobs"
            text="A test-passed plan must receive the matching pilot, production, or emergency approval before it can be scheduled."
            action={
              <Button
                variant="secondary"
                onClick={() => onNavigate("Approvals")}
              >
                Review approvals
              </Button>
            }
          />
        )}
      </Panel>
      <IntegrationNote>
        Rehearsal states are not live provider results. No endpoint agent,
        automated reboot, retry, or real API integration is implemented.
      </IntegrationNote>
    </div>
  )
}

function Verification({
  workspace,
  onVerify,
}: {
  workspace: WorkspaceState
  onVerify: (deploymentId: string) => void
}) {
  const verificationJobs = workspace.deployments.filter((job) =>
    ["Awaiting verification", "Verified"].includes(job.status),
  )
  return (
    <div className="stack">
      <div className="notice-bar caution">
        <Icon name="warning" size={18} />
        <div>
          <strong>Installer success is not verified remediation.</strong>
          <span>
            A matching post-deployment rescan or connector evidence must be
            newer than the job and cover all approved target assets.
          </span>
        </div>
      </div>
      <div className="verification-stages">
        <div>
          <span>1</span>
          <strong>Installed</strong>
          <small>Provider confirms installation</small>
        </div>
        <Icon name="chevron" />
        <div>
          <span>2</span>
          <strong>Restart complete</strong>
          <small>If explicitly authorized</small>
        </div>
        <Icon name="chevron" />
        <div>
          <span>3</span>
          <strong>Verified</strong>
          <small>Post-install evidence passes</small>
        </div>
      </div>
      <Panel>
        <PanelHeading
          title="Verification queue"
          description="Demo rescan records are labelled and do not confirm actual client remediation."
        />
        <Table
          headers={[
            "Job / plan",
            "Update",
            "Target group",
            "Stage",
            "Install / reboot",
            "Evidence source",
            "Verification",
          ]}
        >
          {verificationJobs.map((job) => {
            const plan = workspace.plans.find((item) => item.id === job.planId)
            return (
              <tr key={job.id}>
                <td>
                  <strong>{job.id}</strong>
                  <small className="table-sub">{plan?.id}</small>
                </td>
                <td>{plan?.updateId || "Not confirmed"}</td>
                <td>{job.targetGroup}</td>
                <td>{job.stage}</td>
                <td>
                  {job.status} / {job.rebootResult}
                </td>
                <td>{job.resultSource} · demonstration</td>
                <td>
                  {job.status === "Awaiting verification" ? (
                    <Button
                      variant="secondary"
                      onClick={() => onVerify(job.id)}
                    >
                      Record demo rescan
                    </Button>
                  ) : (
                    <Badge tone="amber">Verified · demonstration only</Badge>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>
        {!verificationJobs.length && (
          <EmptyState
            icon="shield"
            title="Nothing awaiting verification"
            text="Deployment success must be followed by a newer, matching rescan for every approved target before remediation can be verified."
          />
        )}
      </Panel>
    </div>
  )
}

function criticalSlaRows(workspace: WorkspaceState) {
  const criticalScans = workspace.scans
    .filter(
      (scan) =>
        scan.severity.toLowerCase() === "critical" &&
        scan.applicability.toLowerCase().startsWith("applicable"),
    )
    .reduce((byUpdate, scan) => {
      const previous = byUpdate.get(scan.updateId)
      if (!previous) {
        byUpdate.set(scan.updateId, scan)
        return byUpdate
      }
      const previousTime = Date.parse(previous.sourceTimestamp)
      const scanTime = Date.parse(scan.sourceTimestamp)
      const earliest =       Number.isFinite(scanTime) &&
      (!Number.isFinite(previousTime) || scanTime < previousTime)
        ? scan
        : previous
      byUpdate.set(scan.updateId, {
        ...earliest,
        affectedAssetIds: [
          ...new Set([...previous.affectedAssetIds, ...scan.affectedAssetIds]),
        ],
      })
      return byUpdate
    }, new Map<string, ScanRecord>())
  return [...criticalScans.values()].map((scan) => {
    const plan = workspace.plans.find((item) => item.updateId === scan.updateId)
    const productionJobs = workspace.deployments.filter(
      (job) => job.planId === plan?.id && job.stage !== "Pilot",
    )
    const verified =
      productionJobs.length > 0 &&
      productionJobs.every((job) => job.status === "Verified")
    const start =
      workspace.clockStart === "First confirmed applicable scan" ||
      (workspace.clockStart === "Report import timestamp" &&
        scan.source === "Imported report")
        ? new Date(scan.sourceTimestamp)
        : null
    const validStart = start && Number.isFinite(start.getTime()) ? start : null
    const due =
      validStart && workspace.calendarHours === "Calendar hours"
        ? new Date(
            validStart.getTime() +
              workspace.criticalTargetHours * 60 * 60 * 1000,
          )
        : null
    const offlineCount = scan.affectedAssetIds.filter((id) =>
      workspace.assets
        .find((asset) => asset.id === id)
        ?.connectivity.toLowerCase()
        .includes("offline"),
    ).length
    const unconfirmedConnectivity = scan.affectedAssetIds.filter((id) => {
      const asset = workspace.assets.find((item) => item.id === id)
      return !asset || asset.connectivity === "Not confirmed"
    }).length
    return {
      scan,
      plan,
      verified,
      due,
      validStart,
      offlineCount,
      unconfirmedConnectivity,
    }
  })
}

function Sla({ workspace }: { workspace: WorkspaceState }) {
  const rows = criticalSlaRows(workspace)
  const openRows = rows.filter((row) => !row.verified)
  const overdue = openRows.filter(
    (row) => row.due && row.due.getTime() < Date.now(),
  )
  const approvalDelays = openRows.filter(
    (row) =>
      row.plan?.productionStatus === "Pending" ||
      row.plan?.emergencyStatus === "Pending",
  )
  const offline = openRows.reduce((sum, row) => sum + row.offlineCount, 0)
  return (
    <div className="stack">
      <div className="policy-banner">
        <div className="policy-icon">
          <Icon name="clock" />
        </div>
        <div>
          <strong>Policy configuration pending client agreement</strong>
          <p>
            Proposed critical target: {workspace.criticalTargetHours} calendar
            hours. Clock start: {workspace.clockStart}. Completion:{" "}
            {workspace.completionCriteria}. Approval waits and offline assets do
            not pause the clock. Business-hours due times are not calculated
            until an agreed business calendar exists.
          </p>
        </div>
        <Badge tone="amber">Pending client confirmation</Badge>
      </div>
      <div className="metric-grid">
        <MetricDisplayCard
          label="Open critical items"
          value={String(openRows.length)}
          note="Applicable stored scans"
          icon="warning"
          tone="critical"
        />
        <MetricDisplayCard
          label="Overdue"
          value={String(overdue.length)}
          note="Clock is not paused"
          icon="clock"
          tone="amber"
        />
        <MetricDisplayCard
          label="Approval delays"
          value={String(approvalDelays.length)}
          note="Awaiting authorization"
          icon="check"
        />
        <MetricDisplayCard
          label="Offline assets"
          value={String(offline)}
          note="Affected critical devices"
          icon="devices"
        />
      </div>
      <Panel>
        <PanelHeading
          title="Critical patch clock"
          description="Due times use Asia/Manila. Intermediate targets are proposed, not approved commitments."
        />
        <Table
          headers={[
            "Patch",
            "Due time",
            "Time remaining",
            "Affected / offline",
            "Approval",
            "Blockers",
            "Source / clock start",
          ]}
        >
          {rows.map(
            ({
              scan,
              plan,
              verified,
              due,
              validStart,
              offlineCount,
              unconfirmedConnectivity,
            }) => {
              const remaining = due ? due.getTime() - Date.now() : null
              return (
                <tr key={scan.id}>
                  <td>
                    <strong>{scan.updateId}</strong>
                    <div>{scan.severity}</div>
                  </td>
                  <td>
                    {due
                      ? formatTimestamp(due.toISOString())
                      : "Not calculated"}
                  </td>
                  <td>
                    {verified
                      ? "Verified"
                      : remaining === null
                        ? workspace.calendarHours === "Business hours"
                          ? "Business calendar required"
                          : "Clock start not confirmed"
                        : remaining < 0
                          ? `Overdue · ${Math.floor(-remaining / 3600000)}h`
                          : `${Math.floor(remaining / 3600000)}h ${Math.floor((remaining % 3600000) / 60000)}m`}
                  </td>
                  <td>
                    {scan.affectedAssetIds.length} / {offlineCount} offline
                  </td>
                  <td>{plan?.productionStatus ?? "No plan"}</td>
                  <td>
                    {verified
                      ? "None · verified"
                      : !plan
                        ? "No patch plan"
                        : [
                            plan.productionStatus !== "Approved"
                              ? "Production approval pending"
                              : "",
                            offlineCount ? `${offlineCount} offline` : "",
                            unconfirmedConnectivity
                              ? `${unconfirmedConnectivity} connectivity not confirmed`
                              : "",
                          ]
                            .filter(Boolean)
                            .join("; ") || "None recorded"}
                  </td>
                  <td>
                    {scan.source} ·{" "}
                    {validStart
                      ? formatTimestamp(validStart.toISOString())
                      : "start not confirmed"}
                  </td>
                </tr>
              )
            },
          )}
        </Table>
        {!rows.length && (
          <EmptyState
            icon="clock"
            title="No applicable critical scan records"
            text="Record a scan before an SLA clock can be calculated. The proposed policy remains pending client confirmation."
          />
        )}
        <div className="subtle-banner">
          <Icon name="info" size={16} />
          <span>
            Escalation thresholds:{" "}
            {workspace.escalationHours || "Not confirmed"}. No approval or
            offline pause is applied. {workspace.exceptionRules}
          </span>
        </div>
      </Panel>
      <Panel>
        <PanelHeading
          title="Emergency critical route"
          description="Separate approval stage; authorization is never bypassed."
        />
        <div className="mini-summary">
          <strong>Emergency approval required</strong>
          <span>
            Create a plan, record emergency evidence and recovery steps, then
            request the Emergency stage from an AC Mobility Approver. This
            rehearsal cannot execute a connector job.
          </span>
          <Badge tone="amber">Proposed process</Badge>
        </div>
      </Panel>
    </div>
  )
}

function Reports({
  workspace,
  openPreview,
}: {
  workspace: WorkspaceState
  openPreview: () => void
}) {
  const metrics = summarizeScans(workspace.scans)
  const criticalItems = criticalSlaRows(workspace)
  const openCriticalItems = criticalItems.filter((item) => !item.verified)
  const overdueCriticalItems = openCriticalItems.filter(
    (item) => item.due && item.due.getTime() < Date.now(),
  ).length
  const approvalDelays = openCriticalItems.filter(
    (item) =>
      item.plan?.productionStatus === "Pending" ||
      item.plan?.emergencyStatus === "Pending",
  ).length
  const offlineCriticalAssets = openCriticalItems.reduce(
    (sum, item) => sum + item.offlineCount,
    0,
  )
  const cards: [string, string, IconName, number][] = [
    [
      "Asset coverage",
      `${workspace.assets.filter((asset) => asset.scopeStatus === "Approved in-scope").length} approved in-scope of ${workspace.assets.length} starting-reference records`,
      "devices",
      workspace.assets.length,
    ],
    [
      "Patch compliance",
      "Stored applicability and verification; not an estate-wide claim",
      "scan",
      metrics.distinctPatchChecks,
    ],
    [
      "Critical SLA performance",
      `${overdueCriticalItems} overdue · ${approvalDelays} awaiting approval · ${offlineCriticalAssets} offline assets; proposed policy only`,
      "clock",
      criticalItems.length,
    ],
    [
      "Deployment results",
      "Queued, rehearsal, failed, and verified jobs",
      "shield",
      workspace.deployments.length,
    ],
    [
      "Reboot backlog",
      "Assets whose reboot status still requires action",
      "refresh",
      workspace.assets.filter((asset) =>
        asset.rebootStatus.toLowerCase().includes("required"),
      ).length,
    ],
    [
      "Exceptions",
      "Open exceptions and approved deferrals",
      "warning",
      workspace.exceptions.filter((item) => item.status !== "Resolved").length,
    ],
  ]
  return (
    <div className="stack">
      <div className="report-grid">
        {cards.map(([title, text, icon, count]) => (
          <Panel className="report-card" key={title}>
            <div className="report-card-icon">
              <Icon name={icon} />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
            <div>
              <Badge>{count} records</Badge>
              <button onClick={openPreview}>
                Preview <Icon name="arrow" size={14} />
              </button>
            </div>
          </Panel>
        ))}
      </div>
      <Panel>
        <PanelHeading
          title="Generated reports"
          description="Exports use current browser-persisted records."
          action={
            <Button icon="report" onClick={openPreview}>
              Preview report
            </Button>
          }
        />
        <Table
          headers={[
            "Report",
            "Period",
            "Scope",
            "Generated by",
            "Generated",
            "Format",
            "Status",
          ]}
        >
          <tr>
            <td>
              <strong>Current workspace report</strong>
            </td>
            <td>January 2027 onboarding scenario</td>
            <td>{workspace.assets.length} starting-reference assets</td>
            <td>Current rehearsal role</td>
            <td>{formatTimestamp(new Date().toISOString())}</td>
            <td>Print / CSV</td>
            <td>
              <Badge tone="amber">Demonstration / imported</Badge>
            </td>
          </tr>
        </Table>
      </Panel>
      <HistoricalReference />
    </div>
  )
}

function HistoricalReference() {
  return (
    <Panel className="historical">
      <div className="historical-heading">
        <div>
          <Badge tone="violet">Historical reference</Badge>
          <h2>September 16, 2026 assessment</h2>
          <p>Historical reference — not current coverage</p>
        </div>
        <Icon name="history" size={27} />
      </div>
      <div className="historical-metrics">
        <div>
          <strong>30</strong>
          <span>Windows systems</span>
        </div>
        <div>
          <strong>18</strong>
          <span>Systems with missing Microsoft patches</span>
        </div>
        <div>
          <strong>646</strong>
          <span>Distinct patch checks</span>
        </div>
        <div>
          <strong>2,197</strong>
          <span>Patch instances</span>
        </div>
        <div>
          <strong>6</strong>
          <span>Windows Server 2012 R2 systems</span>
        </div>
      </div>
      <div className="historical-foot">
        <Icon name="warning" size={17} />
        <span>
          Patch instances are not unique installers. Legacy systems require
          support and licensing assessment. These figures never contribute to
          current metrics. The 30 assessed systems are not the complete
          1,300+ device environment.
        </span>
      </div>
    </Panel>
  )
}

function Exceptions({
  workspace,
  onAddException,
}: {
  workspace: WorkspaceState
  onAddException: (record: ExceptionRecord) => void
}) {
  const [activeTab, setActiveTab] =
    useState<"Exceptions" | "Audit log" | "Approved deferrals">("Exceptions")
  const [showForm, setShowForm] = useState(false)
  const [assetOrUpdate, setAssetOrUpdate] = useState("")
  const [category, setCategory] = useState("")
  const [compensatingAction, setCompensatingAction] = useState("")
  const [owner, setOwner] = useState("")
  const [reviewDate, setReviewDate] = useState("")
  const exceptions = workspace.exceptions
  const audit = workspace.audit
  const deferrals = exceptions.filter(
    (record) => record.status === "Approved deferral",
  )
  const tabs = [
    [
      "Exceptions",
      String(
        exceptions.filter((record) => record.status !== "Resolved").length,
      ),
    ],
    ["Audit log", String(audit.length)],
    ["Approved deferrals", String(deferrals.length)],
  ] as const
  return (
    <div className="stack">
      <div className="section-tabs">
        {tabs.map(([label, count]) => (
          <button
            key={label}
            className={activeTab === label ? "active" : ""}
            aria-pressed={activeTab === label}
            onClick={() => setActiveTab(label)}
          >
            {label} <span>{count}</span>
          </button>
        ))}
      </div>
      <Panel>
        <PanelHeading
          title={
            activeTab === "Exceptions"
              ? "Operational exceptions"
              : activeTab === "Audit log"
                ? "Audit activity"
                : "Approved deferrals"
          }
          description={
            activeTab === "Exceptions"
              ? "Unsupported systems, unavailable patches, compatibility issues, failed jobs, and offline devices."
              : activeTab === "Audit log"
                ? "Browser-persisted rehearsal activity; not a tamper-resistant server audit."
                : "Updates with an approved, time-bounded remediation deferral."
          }
          action={
            activeTab === "Exceptions" ? (
              <Button
                icon="plus"
                onClick={() => setShowForm((visible) => !visible)}
              >
                {showForm ? "Cancel" : "Record exception"}
              </Button>
            ) : undefined
          }
        />
        {showForm && (
          <form
            className="settings-fields"
            onSubmit={(event) => {
              event.preventDefault()
              if (
                !assetOrUpdate.trim() ||
                !category.trim() ||
                !owner.trim() ||
                !reviewDate
              )
                return
              onAddException({
                id: `EXC-${Date.now()}`,
                assetOrUpdate: assetOrUpdate.trim(),
                category: category.trim(),
                compensatingAction:
                  compensatingAction.trim() || "Not confirmed",
                owner: owner.trim(),
                reviewDate,
                status: "Open",
                source: "Demonstration",
              })
              setAssetOrUpdate("")
              setCategory("")
              setCompensatingAction("")
              setOwner("")
              setReviewDate("")
              setShowForm(false)
            }}
          >
            <label>
              Device / update
              <input
                required
                value={assetOrUpdate}
                onChange={(event) => setAssetOrUpdate(event.target.value)}
              />
            </label>
            <label>
              Category
              <input
                required
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </label>
            <label>
              Owner
              <input
                required
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
              />
            </label>
            <label>
              Review date
              <input
                required
                type="date"
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
              />
            </label>
            <label>
              Compensating action
              <textarea
                value={compensatingAction}
                onChange={(event) => setCompensatingAction(event.target.value)}
              />
            </label>
            <Button type="submit">Save exception</Button>
          </form>
        )}
        {activeTab === "Exceptions" && (
          <Table
            headers={[
              "Exception",
              "Device / update",
              "Category",
              "Mitigation",
              "Owner",
              "Next action",
              "State",
            ]}
          >
            {exceptions
              .filter((record) => record.status !== "Approved deferral")
              .map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.id}</strong>
                  </td>
                  <td>{record.assetOrUpdate}</td>
                  <td>{record.category}</td>
                  <td>{record.compensatingAction}</td>
                  <td>{record.owner}</td>
                  <td>{record.reviewDate}</td>
                  <td>
                    <Badge tone={record.status === "Open" ? "amber" : "low"}>
                      {record.status} · {record.source}
                    </Badge>
                  </td>
                </tr>
              ))}
          </Table>
        )}
        {activeTab === "Audit log" && (
          <>
            <Table headers={["Time", "Actor", "Action", "Scope", "Result"]}>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatTimestamp(entry.timestamp)}</td>
                  <td>{entry.actor}</td>
                  <td>{entry.action}</td>
                  <td>{entry.details}</td>
                  <td>
                    <Badge tone="amber">{entry.source} · browser record</Badge>
                  </td>
                </tr>
              ))}
            </Table>
            {!audit.length && (
              <EmptyState
                icon="history"
                title="No audit events yet"
                text="Approvals, scope changes, policy changes, and rehearsal actions will appear here."
              />
            )}
          </>
        )}
        {activeTab === "Approved deferrals" && (
          <>
            <Table
              headers={[
                "Deferral",
                "Update",
                "Scope",
                "Reason",
                "Owner",
                "Review date",
                "State",
              ]}
            >
              {deferrals.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.id}</strong>
                  </td>
                  <td>{record.assetOrUpdate}</td>
                  <td>Starting reference</td>
                  <td>{record.compensatingAction}</td>
                  <td>{record.owner}</td>
                  <td>{record.reviewDate}</td>
                  <td>
                    <Badge tone="amber">
                      {record.status} · {record.source}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
            {!deferrals.length && (
              <EmptyState
                icon="clock"
                title="No approved deferrals"
                text="Deferrals require authorized approval and a review date."
              />
            )}
          </>
        )}
      </Panel>
    </div>
  )
}

function Settings({
  onEnroll,
  onAction,
  workspace,
  assets,
  onWorkspaceChange,
}: {
  onEnroll: () => void
  onAction: (title: string, description: string) => void
  workspace: WorkspaceState
  assets: Asset[]
  onWorkspaceChange: (changes: Partial<WorkspaceState>, event?: string) => void
}) {
  const [selectedTitle, setSelectedTitle] = useState("Device integration")
  const sections = [
    [
      "Device integration",
      "Review existing tools and the read-only Windows agent connection.",
      "plug",
      "Read-only API",
    ],
    [
      "Enrollment & approved scope",
      "Authorize devices and manage revocable connector credentials.",
      "devices",
      "24 sample devices",
    ],
    [
      "Users & roles",
      "RCC Engineer, AC Mobility Approver, Administrator, and Read-only Management.",
      "lock",
      "Demo role selector",
    ],
    [
      "Maintenance windows",
      "Approved off-peak windows and explicit restart authorization.",
      "calendar",
      "Saturday off-peak",
    ],
    [
      "Notifications",
      "Operational alerts and escalation recipients.",
      "bell",
      "5 recipients",
    ],
    [
      "SLA configuration",
      "Clock, calendar, escalation, completion, and exception rules.",
      "clock",
      "Draft",
    ],
    [
      "Reporting frequency",
      "Scheduled evidence-based reporting cadence.",
      "report",
      "Weekly",
    ],
  ] as [string, string, IconName, string][]
  const selectedSection =
    sections.find(([title]) => title === selectedTitle) ?? sections[0]
  const saveConfig = (changes: Partial<WorkspaceState>, label: string) => {
    if (workspace.role !== "Administrator") {
      onAction(
        "Administrator permission required",
        "Configuration edits require the Administrator role in this rehearsal. A production API must enforce authorization independently of this browser.",
      )
      return
    }
    onWorkspaceChange(changes, label)
  }
  return (
    <div className="settings-layout">
      <div className="settings-nav">
        <strong>Administrator settings</strong>
        {sections.map(([title]) => (
          <button
            className={selectedTitle === title ? "active" : ""}
            aria-pressed={selectedTitle === title}
            key={title}
            onClick={() => setSelectedTitle(title)}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="stack">
        <Panel>
          <PanelHeading
            title={selectedSection[0]}
            description={selectedSection[1]}
          />
          {selectedTitle === "Device integration" ? (
            <>
              <div className="integration-health">
                <div className="large-status">
                  <span className="status-dot offline" />
                  <div>
                    <small>Windows agent API</small>
                    <strong>
                      Enrollment and read-only evidence APIs · no connection is
                      assumed
                    </strong>
                  </div>
                </div>
                <div>
                  <small>Existing tools</small>
                  <strong>{workspace.managementTools}</strong>
                </div>
                <div>
                  <small>Remote access</small>
                  <strong>{workspace.remoteAccessMethod}</strong>
                </div>
              </div>
              <IntegrationNote>
                Use supported client tools where available. Remote desktop is
                not a patch deployment integration. No connector is implemented
                or marked connected without actual evidence. Third-party
                applications may be inventoried, but their patch deployment is
                excluded from day one unless explicitly approved.
              </IntegrationNote>
              <fieldset
                className="settings-fields"
                disabled={workspace.role !== "Administrator"}
              >
                <label>
                  Existing patch tools / agents
                  <input
                    value={workspace.managementTools}
                    placeholder="Not confirmed"
                    onChange={(event) =>
                      onWorkspaceChange({ managementTools: event.target.value })
                    }
                    onBlur={(event) =>
                      saveConfig(
                        {
                          managementTools:
                            event.target.value || "Not confirmed",
                        },
                        "Existing tool inventory changed",
                      )
                    }
                  />
                </label>
                <label>
                  Tool coverage
                  <input
                    value={workspace.toolCoverage}
                    placeholder="Not confirmed"
                    onChange={(event) =>
                      onWorkspaceChange({ toolCoverage: event.target.value })
                    }
                    onBlur={(event) =>
                      saveConfig(
                        { toolCoverage: event.target.value || "Not confirmed" },
                        "Existing tool coverage changed",
                      )
                    }
                  />
                </label>
                <label>
                  Integration capability / supported API
                  <input
                    value={workspace.integrationCapability}
                    placeholder="Not confirmed"
                    onChange={(event) =>
                      onWorkspaceChange({
                        integrationCapability: event.target.value,
                      })
                    }
                    onBlur={(event) =>
                      saveConfig(
                        {
                          integrationCapability:
                            event.target.value || "Not confirmed",
                        },
                        "Integration capability changed",
                      )
                    }
                  />
                </label>
                <label>
                  Approved remote access method
                  <input
                    value={workspace.remoteAccessMethod}
                    placeholder="Not confirmed"
                    onChange={(event) =>
                      onWorkspaceChange({
                        remoteAccessMethod: event.target.value,
                      })
                    }
                    onBlur={(event) =>
                      saveConfig(
                        {
                          remoteAccessMethod:
                            event.target.value || "Not confirmed",
                        },
                        "Remote access documentation changed",
                      )
                    }
                  />
                </label>
                <p className="field-help">
                  Coverage, client ownership, APIs, credentials, and integration
                  capability still require confirmation. No secrets belong here.
                </p>
              </fieldset>
              <div className="button-row">
                <Button onClick={onEnroll}>Open enrollment guide</Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    onAction(
                      "Connector requirements",
                        "The Windows agent API issues short-lived, hostname-scoped enrollment tokens and revocable per-device credentials, and accepts heartbeat and read-only Windows Update scan evidence over HTTPS. Real Windows validation and an approved Laptop 1 TLS endpoint are still required. Patch installation and restart are not supported.",
                    )
                  }
                >
                  Review connector requirements
                </Button>
              </div>
            </>
          ) : selectedTitle === "SLA configuration" ? (
            <fieldset
              className="settings-fields"
              disabled={workspace.role !== "Administrator"}
            >
              <div className="subtle-banner">
                <Icon name="info" size={16} />
                <span>
                  Proposed only · Pending client confirmation. Approval waits
                  and offline devices do not automatically pause this clock.
                </span>
              </div>
              <label>
                Proposed critical target (calendar hours)
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={workspace.criticalTargetHours}
                  onChange={(event) =>
                    onWorkspaceChange({
                      criticalTargetHours: Math.min(
                        720,
                        Math.max(1, Number(event.target.value) || 48),
                      ),
                    })
                  }
                  onBlur={() =>
                    saveConfig(
                      { criticalTargetHours: workspace.criticalTargetHours },
                      "Proposed critical SLA target changed",
                    )
                  }
                />
              </label>
              <label>
                Clock starts
                <select
                  value={workspace.clockStart}
                  onChange={(event) =>
                    saveConfig(
                      { clockStart: event.target.value },
                      "SLA clock start changed",
                    )
                  }
                >
                  <option>First confirmed applicable scan</option>
                  <option>Vendor publication timestamp</option>
                  <option>Report import timestamp</option>
                  <option>Client-approved start event</option>
                </select>
              </label>
              <label>
                Completion criteria
                <input
                  value={workspace.completionCriteria}
                  onChange={(event) =>
                    onWorkspaceChange({
                      completionCriteria: event.target.value,
                    })
                  }
                  onBlur={() =>
                    saveConfig(
                      { completionCriteria: workspace.completionCriteria },
                      "SLA completion criteria changed",
                    )
                  }
                />
              </label>
              <label>
                SLA calendar
                <select
                  value={workspace.calendarHours}
                  onChange={(event) =>
                    saveConfig(
                      {
                        calendarHours: event.target
                          .value as WorkspaceState["calendarHours"],
                      },
                      "SLA calendar changed",
                    )
                  }
                >
                  <option>Calendar hours</option>
                  <option>Business hours</option>
                </select>
              </label>
              <label>
                Escalation thresholds (hours, comma-separated)
                <input
                  value={workspace.escalationHours}
                  onChange={(event) =>
                    onWorkspaceChange({ escalationHours: event.target.value })
                  }
                  onBlur={() =>
                    saveConfig(
                      { escalationHours: workspace.escalationHours },
                      "SLA escalation thresholds changed",
                    )
                  }
                />
              </label>
              <label>
                Exceptions
                <textarea
                  value={workspace.exceptionRules}
                  onChange={(event) =>
                    onWorkspaceChange({ exceptionRules: event.target.value })
                  }
                  onBlur={() =>
                    saveConfig(
                      { exceptionRules: workspace.exceptionRules },
                      "SLA exception rules changed",
                    )
                  }
                />
              </label>
              <Button
                onClick={() =>
                  saveConfig(
                    { policyConfirmed: false },
                    "SLA policy left pending client confirmation",
                  )
                }
              >
                Save proposed policy
              </Button>
            </fieldset>
          ) : selectedTitle === "Maintenance windows" ? (
            <fieldset
              className="settings-fields"
              disabled={workspace.role !== "Administrator"}
            >
              <div className="subtle-banner">
                <Icon name="info" size={16} />
                <span>
                  Asia/Manila schedule only. Routine work should use confirmed
                  off-peak windows. Lead time is a preference only; no
                  employee notifications are sent here, and employee approval
                  is not a prerequisite to deployment.
                </span>
              </div>
              <label>
                Approved maintenance window
                <input
                  value={workspace.maintenanceWindow}
                  onChange={(event) =>
                    onWorkspaceChange({ maintenanceWindow: event.target.value })
                  }
                  onBlur={() =>
                    saveConfig(
                      { maintenanceWindow: workspace.maintenanceWindow },
                      "Maintenance window changed",
                    )
                  }
                />
              </label>
              <label>
                Blackout periods
                <input
                  value={workspace.blackoutPeriods}
                  onChange={(event) =>
                    onWorkspaceChange({ blackoutPeriods: event.target.value })
                  }
                  onBlur={() =>
                    saveConfig(
                      { blackoutPeriods: workspace.blackoutPeriods },
                      "Maintenance blackout periods changed",
                    )
                  }
                />
              </label>
              <label>
                Notification lead time (hours)
                <input
                  type="number"
                  min="0"
                  max="720"
                  value={workspace.notificationLeadHours}
                  onChange={(event) =>
                    onWorkspaceChange({
                      notificationLeadHours: Math.max(
                        0,
                        Number(event.target.value) || 0,
                      ),
                    })
                  }
                  onBlur={() =>
                    saveConfig(
                      {
                        notificationLeadHours: workspace.notificationLeadHours,
                      },
                      "Notification lead time changed",
                    )
                  }
                />
              </label>
              <label>
                Pilot group
                <input
                  value={workspace.pilotGroup}
                  onChange={(event) =>
                    onWorkspaceChange({ pilotGroup: event.target.value })
                  }
                  onBlur={() =>
                    saveConfig(
                      { pilotGroup: workspace.pilotGroup },
                      "Pilot group changed",
                    )
                  }
                />
              </label>
              <label>
                Production batch size
                <input
                  type="number"
                  min="1"
                  value={workspace.productionBatchSize}
                  onChange={(event) =>
                    onWorkspaceChange({
                      productionBatchSize: Math.max(
                        1,
                        Number(event.target.value) || 1,
                      ),
                    })
                  }
                  onBlur={() =>
                    saveConfig(
                      { productionBatchSize: workspace.productionBatchSize },
                      "Production batch size changed",
                    )
                  }
                />
              </label>
              <label>
                Reboot policy
                <select
                  value={workspace.rebootPolicy}
                  onChange={(event) =>
                    saveConfig(
                      { rebootPolicy: event.target.value },
                      "Reboot policy changed",
                    )
                  }
                >
                  <option>
                    Prompt employee; reboot requires approved policy
                  </option>
                  <option>Reboot only in approved window</option>
                  <option>No automatic reboot</option>
                  <option>Not confirmed</option>
                </select>
              </label>
            </fieldset>
          ) : selectedTitle === "Users & roles" ? (
            <div className="settings-fields">
              <div className="subtle-banner">
                <Icon name="warning" size={16} />
                <span>
                  Rehearsal persona only; this is not authentication or access
                  control. Production role enforcement must be server-side.
                </span>
              </div>
              <label>
                Rehearsal role
                <select
                  value={workspace.role}
                  onChange={(event) =>
                    onWorkspaceChange(
                      { role: event.target.value as UserRole },
                      "Rehearsal role changed",
                    )
                  }
                >
                  {([
                    "RCC Engineer",
                    "AC Mobility Approver",
                    "Administrator",
                    "Read-only Management",
                  ] as UserRole[]).map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <p className="field-help">
                RCC Engineer prepares plans and requests. AC Mobility Approver
                records pilot/production decisions. Administrator configures
                policy and scope. Read-only Management reviews records.
              </p>
            </div>
          ) : (
            <>
              <div className="integration-health">
                <div className="large-status">
                  <span className="status-dot offline" />
                  <div>
                    <small>Current configuration</small>
                    <strong>
                      {selectedTitle === "Enrollment & approved scope"
                        ? `${assets.length} reference records`
                        : selectedSection[3]}
                    </strong>
                  </div>
                </div>
                <div>
                  <small>Workspace mode</small>
                  <strong>Browser-persisted demonstration</strong>
                </div>
              </div>
              <div className="subtle-banner">
                <Icon name="info" size={16} />
                <span>
                  This section is a rehearsal view; no backend exists. Unknown
                  scope stays unapproved and all imported records are discovered
                  by default.
                </span>
              </div>
              {selectedTitle === "Enrollment & approved scope" ? (
                <Button onClick={onEnroll}>Open enrollment guide</Button>
              ) : (
                <Button
                  onClick={() =>
                    onAction(
                      selectedSection[0],
                      `${selectedSection[1]} Current sample value: ${selectedSection[3]}. Configuration changes require an authenticated administrative backend and are not saved in this prototype.`,
                    )
                  }
                >
                  Review {selectedSection[0].toLowerCase()}
                </Button>
              )}
            </>
          )}
        </Panel>
        <Panel>
          <PanelHeading
            title="Configuration areas"
            description="Administrative controls remain outside ordinary operator workflows."
          />
          <div className="settings-list">
            {sections.slice(1).map(([title, text, icon, status]) => (
              <button
                key={title}
                className={selectedTitle === title ? "active" : ""}
                aria-pressed={selectedTitle === title}
                onClick={() => setSelectedTitle(title)}
              >
                <span className="settings-icon">
                  <Icon name={icon} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
                <Badge tone={status === "Draft" ? "amber" : "neutral"}>
                  {status}
                </Badge>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function InfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel>
      <PanelHeading title={title} />
      <ul className="check-list">
        {items.map((item) => (
          <li key={item}>
            <Icon name="check" size={16} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function EnrollmentPage({
  user,
  sessionStatus,
  sessionError,
  onLogin,
  onLogout,
  onRefreshEvidence,
}: {
  user: AgentUser | null
  sessionStatus: "loading" | "authenticated" | "unauthenticated" | "unavailable"
  sessionError: string
  onLogin: (email: string, password: string) => Promise<void>
  onLogout: () => Promise<void>
  onRefreshEvidence: () => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [hostname, setHostname] = useState("")
  const [loginError, setLoginError] = useState("")
  const [tokenError, setTokenError] = useState("")
  const [busy, setBusy] = useState(false)
  const [issuedToken, setIssuedToken] = useState<{
    value: string
    hostname: string
    expiresAt: string
  } | null>(null)
  const [copyMessage, setCopyMessage] = useState("")

  useEffect(() => {
    if (!issuedToken) return
    const remaining = Date.parse(issuedToken.expiresAt) - Date.now()
    const timeout = window.setTimeout(() => {
      setIssuedToken(null)
      setCopyMessage("")
      setTokenError("The displayed enrollment token expired and has been cleared.")
    }, Math.max(remaining, 0))
    return () => window.clearTimeout(timeout)
  }, [issuedToken])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setLoginError("")
    try {
      await onLogin(email, password)
      setPassword("")
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Sign-in failed.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function submitEnrollmentToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setTokenError("")
    setCopyMessage("")
    setIssuedToken(null)
    try {
      const result = await createEnrollmentToken(hostname.trim())
      setIssuedToken({
        value: result.enrollmentToken,
        hostname: result.hostname,
        expiresAt: result.expiresAt,
      })
      setHostname("")
      onRefreshEvidence()
    } catch (error) {
      setTokenError(
        error instanceof Error
          ? error.message
          : "Enrollment token could not be issued.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function copyToken() {
    if (!issuedToken) return
    try {
      await navigator.clipboard.writeText(issuedToken.value)
      setCopyMessage("Copied. Share this token only with the authorized device operator.")
    } catch {
      setCopyMessage("Clipboard access is unavailable. Select and copy the token manually.")
    }
  }

  async function logout() {
    setBusy(true)
    setLoginError("")
    try {
      await onLogout()
      setIssuedToken(null)
      setCopyMessage("")
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Sign-out failed.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <Panel>
        <PanelHeading
          title="Authenticated device enrollment"
          description="Backend-issued, hostname-scoped, single-use tokens expire after 10 minutes."
        />
        <div className="settings-fields">
          {sessionStatus === "loading" ? (
            <p className="empty-inline">Checking authenticated backend session…</p>
          ) : sessionStatus === "authenticated" && user ? (
            <>
              <div className="notice-bar">
                <Icon name="lock" size={17} />
                <div>
                  <strong>Authenticated API session</strong>
                  <span>
                    {user.email} · {user.role.replace(/_/g, " ")}
                  </span>
                </div>
                <Button variant="secondary" disabled={busy} onClick={logout}>
                  Sign out
                </Button>
              </div>
              {user.role !== "engineer" ? (
                <div className="enroll-warning" role="alert">
                  <Icon name="warning" />
                  <div>
                    <strong>Enrollment authorization denied</strong>
                    <p>
                      This backend permits only an authenticated Engineer to
                      issue device enrollment tokens. Your account can view
                      records but cannot authorize enrollment.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <form className="agent-form" onSubmit={submitEnrollmentToken}>
                    <label>
                      Authorized Windows hostname
                      <input
                        autoComplete="off"
                        maxLength={255}
                        pattern="[A-Za-z0-9][A-Za-z0-9.-]{0,253}"
                        required
                        value={hostname}
                        onChange={(event) => setHostname(event.target.value)}
                        placeholder="WIN-TEST-01"
                      />
                    </label>
                    <p className="field-help">
                      The Windows agent must report this exact hostname. The
                      backend stores only a hash of the token.
                    </p>
                    <Button disabled={busy} type="submit" icon="lock">
                      {busy ? "Issuing…" : "Generate single-use token"}
                    </Button>
                  </form>
                  {tokenError && (
                    <p className="error-list" role="alert">
                      {tokenError}
                    </p>
                  )}
                  {issuedToken && (
                    <div className="issued-token" role="status">
                      <div>
                        <strong>
                          Enrollment token for {issuedToken.hostname}
                        </strong>
                        <span>
                          Expires{" "}
                          {new Date(issuedToken.expiresAt).toLocaleString()} ·
                          single use · do not save in tickets or logs
                        </span>
                      </div>
                      <input
                        aria-label="Single-use enrollment token"
                        readOnly
                        value={issuedToken.value}
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <div className="button-row">
                        <Button variant="secondary" onClick={copyToken}>
                          Copy token
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setIssuedToken(null)
                            setCopyMessage("")
                          }}
                        >
                          Clear token
                        </Button>
                      </div>
                      {copyMessage && (
                        <p className="field-help" role="status">
                          {copyMessage}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div className="enroll-warning" role="status">
                <Icon name="warning" />
                <div>
                  <strong>
                    {sessionStatus === "unavailable"
                      ? "PatchGuard API is unavailable"
                      : "Sign in required"}
                  </strong>
                  <p>
                    {sessionStatus === "unavailable"
                      ? sessionError
                      : "Use your existing PatchGuard account. The session is server-managed; no account or password is stored in this browser."}
                  </p>
                </div>
              </div>
              <form className="agent-form" onSubmit={submitLogin}>
                <label>
                  Email
                  <input
                    autoComplete="username"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="current-password"
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                {loginError && (
                  <p className="error-list" role="alert">
                    {loginError}
                  </p>
                )}
                <Button disabled={busy} type="submit" icon="lock">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </>
          )}
        </div>
      </Panel>
      <Panel>
        <PanelHeading
          title="Windows agent package"
          description="Download the reviewed PowerShell agent files for an authorized Windows 10/11 test laptop."
        />
        <div className="agent-download-card">
          <div className="agent-download-copy">
            <div className="agent-download-icon">
              <Icon name="download" size={20} />
            </div>
            <div>
              <strong>RCC PatchGuard Windows Agent 0.2</strong>
              <p>
                This is a source package, not a signed EXE or background service.
                Review the script before running it and keep the files together in
                one folder.
              </p>
              <div className="agent-download-meta">
                <span>Windows PowerShell 5.1</span>
                <span>Windows 10/11</span>
                <span>No external packages</span>
              </div>
            </div>
          </div>
          <div className="agent-download-actions">
            <a className="button button-primary" href="/agent/Start-Agent.cmd" download>
              <Icon name="download" size={16} />
              <span>Download launcher</span>
            </a>
            <a className="button button-secondary" href="/agent/RCC-Agent.ps1" download>
              <span>Agent script</span>
            </a>
            <a className="button button-ghost" href="/agent/README.md" target="_blank" rel="noreferrer">
              <span>Read setup guide</span>
            </a>
          </div>
        </div>
        <p className="field-help">
          Download all three files before launching: <code>Start-Agent.cmd</code>,
          <code>RCC-Agent.ps1</code>, and the setup guide. The launcher does not
          bypass execution policy or certificate validation.
        </p>
      </Panel>
      <Panel>
        <PanelHeading
          title="Laptop 1 and Laptop 2 connection steps"
          description="No installation or reboot operation is available in this connector."
        />
        <ol className="agent-steps">
          <li>
            <strong>Laptop 1 — start the existing PatchGuard API</strong>
            <code>cd "/Users/rcc/Downloads/Security Services Platform" &amp;&amp; npm run api</code>
          </li>
          <li>
            <strong>Laptop 1 — start this dashboard</strong>
            <code>cd "/Users/rcc/Downloads/High-fidelity Figma prototype" &amp;&amp; npm run dev</code>
            <span>
              The dashboard proxies same-origin /api requests to the API. Use
              the actual Vite URL shown in the terminal.
            </span>
          </li>
          <li>
            <strong>
              Remote HTTPS prerequisite — do not expose the loopback API
            </strong>
            <span>
              Laptop 2 cannot reach 127.0.0.1 on Laptop 1. Configure the
              client-approved TLS reverse proxy and trusted DNS certificate
              for the API on Laptop 1. Route /api to 127.0.0.1:8787, set
              PATCHGUARD_COOKIE_SECURE=true, and have the trusted proxy replace
              X-Forwarded-Proto with https. Serve the dashboard through the
              approved HTTPS origin as well. Never use plain HTTP, self-signed
              untrusted certificates, or certificate-validation bypasses.
            </span>
          </li>
          <li>
            <strong>
              Laptop 2 — run Start-Agent.cmd and register
            </strong>
            <span>
              Enter the reachable HTTPS API base URL (not localhost) and the
              freshly issued hostname-specific token. Click Register device,
              then Send heartbeat. No patch installation or restart occurs.
            </span>
          </li>
          <li>
            <strong>Verify evidence</strong>
            <span>
              Confirm the hostname and API-received heartbeat in Assets. On
              Laptop 2 click Scan missing updates, then Send scan to backend;
              confirm its source timestamp, server receipt timestamp, and
              findings in Scan results.
            </span>
          </li>
        </ol>
      </Panel>
    </div>
  )
}

function ImportModal({
  value,
  setValue,
  onFile,
  fileName,
  preview,
  history,
  onClose,
  onImport,
}: {
  value: string
  setValue: (value: string) => void
  onFile: (file: File) => void
  fileName: string
  preview: ReturnType<typeof parseAssetCsv>
  history: ImportRecord[]
  onClose: () => void
  onImport: () => void
}) {
  return (
    <Modal title="Import inventory for validation" onClose={onClose} wide>
      <div className="modal-body">
        <div className="subtle-banner">
          <Icon name="info" size={16} />
          <span>
            Imported systems start as Discovered, never automatically enter
            approved scope. Unknown columns remain “Not confirmed”; imports do
            not discover subnet assets or confirm connectivity.
          </span>
        </div>
        <label className="field-label" htmlFor="csv-file">
          Choose a CSV report
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(file)
          }}
        />
        <small className="field-help">Current source: {fileName}</small>
        <label className="field-label" htmlFor="csv">
          Preview and edit CSV
        </label>
        <textarea
          id="csv"
          className="csv-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={
            "hostname,ip,os version,device type,business owner,department,site,criticality,management tool\nACM-LT-001,10.0.0.12,Windows 11 23H2,Laptop,Not confirmed,Finance,Manila,Not confirmed,Not confirmed"
          }
        />
        <div className="import-summary">
          <div>
            <strong>{preview.valid.length}</strong>
            <span>valid records</span>
          </div>
          <div>
            <strong>{preview.errors.length}</strong>
            <span>validation issues</span>
          </div>
          <div>
            <strong>{preview.duplicates}</strong>
            <span>duplicates skipped</span>
          </div>
        </div>
        {preview.errors.length > 0 && (
          <div className="error-list">
            {preview.errors.slice(0, 3).map((error) => (
              <span key={error}>
                <Icon name="warning" size={14} />
                {error}
              </span>
            ))}
          </div>
        )}
        <small className="field-help">
          Required: hostname (or device name/computer name). Optional: IP,
          operating system/version, device type, business owner, department,
          site, criticality, management tool, scan, reboot and target group.
          Quoted CSV cells are supported.
        </small>
        {history.length > 0 && (
          <div className="import-history-preview">
            <strong>Recent import history</strong>
            {history.slice(0, 3).map((record) => (
              <span key={record.id}>
                {record.fileName} · {record.importedCount} added ·{" "}
                {formatTimestamp(record.importedAt)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onImport} disabled={!preview.valid.length}>
          Import {preview.valid.length || ""} record
          {preview.valid.length === 1 ? "" : "s"}
        </Button>
      </div>
    </Modal>
  )
}

function ScanImportModal({
  value,
  setValue,
  onFile,
  fileName,
  preview,
  onClose,
  onImport,
}: {
  value: string
  setValue: (value: string) => void
  onFile: (file: File) => void
  fileName: string
  preview: ReturnType<typeof parseScanCsv>
  onClose: () => void
  onImport: () => void
}) {
  return (
    <Modal title="Import scan report for validation" onClose={onClose} wide>
      <div className="modal-body">
        <div className="subtle-banner">
          <Icon name="info" size={16} />
          <span>
            Imported report rows remain distinct from demo scans and live
            connector evidence. A report import does not contact devices or
            mark patches verified.
          </span>
        </div>
        <label className="field-label" htmlFor="scan-csv-file">
          Choose a scan report CSV
        </label>
        <input
          id="scan-csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(file)
          }}
        />
        <small className="field-help">Current source: {fileName}</small>
        <label className="field-label" htmlFor="scan-csv">
          Preview and edit CSV
        </label>
        <textarea
          id="scan-csv"
          className="csv-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={
            "update id,title,product,severity,cve,applicability,affected assets\nKB1234567,Security update,Windows 11,Critical,CVE-2027-12345,Applicable,ACM-0001"
          }
        />
        <div className="import-summary">
          <div>
            <strong>{preview.valid.length}</strong>
            <span>valid scan records</span>
          </div>
          <div>
            <strong>{preview.errors.length}</strong>
            <span>validation issues</span>
          </div>
          <div>
            <strong>{preview.duplicates}</strong>
            <span>duplicates skipped</span>
          </div>
        </div>
        {preview.errors.length > 0 && (
          <div className="error-list">
            {preview.errors.slice(0, 5).map((error) => (
              <span key={error}>
                <Icon name="warning" size={14} />
                {error}
              </span>
            ))}
          </div>
        )}
        {preview.valid.length > 0 && (
          <Table
            headers={[
              "Update",
              "Title",
              "Severity",
              "Applicability",
              "Affected assets",
              "Source",
            ]}
          >
            {preview.valid.slice(0, 5).map((scan) => (
              <tr key={scan.id}>
                <td>{scan.updateId}</td>
                <td>{scan.title}</td>
                <td>{scan.severity}</td>
                <td>{scan.applicability}</td>
                <td>{scan.affectedAssetIds.length}</td>
                <td>Imported report · {formatTimestamp(scan.sourceTimestamp)}</td>
              </tr>
            ))}
          </Table>
        )}
        <small className="field-help">
          Required headers: update id, title, severity, applicability. Optional:
          product, cve, affected assets. Affected assets accepts inventory
          hostname or ID values separated by “|” or “;”. Unknown identifiers,
          unsupported severity/status values, and duplicate rows are rejected
          or skipped with a preview count.
        </small>
      </div>
      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onImport} disabled={!preview.valid.length}>
          Import {preview.valid.length || ""} scan record
          {preview.valid.length === 1 ? "" : "s"}
        </Button>
      </div>
    </Modal>
  )
}

function ReportModal({
  workspace,
  onClose,
}: {
  workspace: WorkspaceState
  onClose: () => void
}) {
  const metrics = summarizeScans(workspace.scans)
  const criticalItems = criticalSlaRows(workspace)
  const openCriticalItems = criticalItems.filter((item) => !item.verified)
  const overdueCriticalItems = openCriticalItems.filter(
    (item) => item.due && item.due.getTime() < Date.now(),
  ).length
  const approvalDelays = openCriticalItems.filter(
    (item) =>
      item.plan?.productionStatus === "Pending" ||
      item.plan?.emergencyStatus === "Pending",
  ).length
  const offlineCriticalAssets = openCriticalItems.reduce(
    (sum, item) => sum + item.offlineCount,
    0,
  )
  return (
    <Modal
      title="January 2027 onboarding report preview"
      onClose={onClose}
      wide
    >
      <div className="report-preview">
        <div className="preview-header">
          <div className="brand-mark small">
            <span>R</span>
          </div>
          <div>
            <strong>AC Mobility · Patch Operations</strong>
            <span>
              Browser-persisted rehearsal · Asia/Manila ·{" "}
              {formatTimestamp(new Date().toISOString())}
            </span>
          </div>
          <Badge tone="amber">SAMPLE DATA</Badge>
        </div>
        <div className="preview-title">
          <h2>Coverage and readiness report</h2>
          <p>Filtered to current persisted workspace records</p>
        </div>
        <div className="preview-metrics">
          <div>
            <strong>{workspace.assets.length}</strong>
            <span>Starting reference assets · not complete</span>
          </div>
          <div>
            <strong>{metrics.distinctPatchChecks}</strong>
            <span>Distinct patch checks</span>
          </div>
          <div>
            <strong>{metrics.affectedDevices}</strong>
            <span>Affected devices</span>
          </div>
          <div>
            <strong>{metrics.devicePatchInstances}</strong>
            <span>Device-level patch instances</span>
          </div>
        </div>
        <div className="preview-section">
          <strong>Critical SLA performance · proposed, pending client confirmation</strong>
          <p>
            {criticalItems.length} distinct applicable critical updates;{" "}
            {overdueCriticalItems} overdue; {approvalDelays} awaiting approval;
            {" "}{offlineCriticalAssets} affected offline assets. Target:{" "}
            {workspace.criticalTargetHours} hours; approval and offline time do
            not pause the clock. Not a client-approved SLA.
          </p>
        </div>
        <div className="preview-section">
          <strong>Executive note</strong>
          <p>
            The list is a starting reference only, not the complete 1,300+
            device estate. Data sources and freshness are recorded per row.
            These figures are demonstration or imported records, not live
            connector evidence. No confirmed scope or SLA baseline exists.
          </p>
        </div>
        <div className="preview-section">
          <strong>Evidence included</strong>
          <div className="evidence-grid">
            {[
              ["Inventory", workspace.assets.length],
              ["Scan records", workspace.scans.length],
              ["Patch plans / tests", workspace.plans.length],
              ["Approval decisions", workspace.approvals.length],
              ["Deployment jobs", workspace.deployments.length],
              [
                "Reboot backlog",
                workspace.assets.filter((asset) =>
                  asset.rebootStatus.toLowerCase().includes("required"),
                ).length,
              ],
              [
                "Verified deployments",
                workspace.deployments.filter((job) => job.status === "Verified")
                  .length,
              ],
              ["Exceptions / deferrals", workspace.exceptions.length],
            ].map(([label, count]) => (
              <span key={label}>
                <Icon name="check" size={13} />
                {label}: {count} records
              </span>
            ))}
          </div>
        </div>
        <div className="preview-foot">
          Metric definitions: distinct patch checks = unique update IDs;
          affected devices = unique asset IDs; patch instances = unique
          update/device pairs. Reporting period: January 2027 onboarding
          rehearsal. Source: browser-persisted records; freshness shown per
          source timestamp. The 30-system historical report is not the full
          environment.
        </div>
      </div>
      <div className="modal-footer">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          Print report
        </Button>
        <Button
          icon="download"
          onClick={() => exportWorkspaceReport(workspace)}
        >
          Export report CSV
        </Button>
      </div>
    </Modal>
  )
}

function makeAudit(
  actor: string,
  action: string,
  details: string,
  source: DataSource,
): AuditRecord {
  return {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    details,
    source,
  }
}

function formatTimestamp(value: string): string {
  if (!value || value === "Not confirmed") return "Not confirmed"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date)
}

function exportWorkspaceReport(workspace: WorkspaceState) {
  const metrics = summarizeScans(workspace.scans)
  const slaRows = criticalSlaRows(workspace)
  const openSlaRows = slaRows.filter((item) => !item.verified)
  const overdueSlaRows = openSlaRows.filter(
    (item) => item.due && item.due.getTime() < Date.now(),
  )
  const rows: string[][] = [
    ["report", "January 2027 onboarding scenario"],
    ["reporting_period", "January 2027"],
    [
      "data_mode",
      "Browser-persisted rehearsal; imported and demo records only",
    ],
    ["freshness", "Per-record source timestamp; see source_timestamp column"],
    ["scope", "Starting reference only; not the complete 1,300+ environment"],
    ["metric", "value", "definition"],
    [
      "asset_records",
      String(workspace.assets.length),
      "Visible starting-reference rows; not complete estate",
    ],
    [
      "approved_in_scope",
      String(
        workspace.assets.filter(
          (asset) => asset.scopeStatus === "Approved in-scope",
        ).length,
      ),
      "Explicitly approved scope only",
    ],
    [
      "import_history_records",
      String(workspace.imports.length),
      "Asset CSV imports recorded in this browser",
    ],
    [
      "distinct_patch_checks",
      String(metrics.distinctPatchChecks),
      "Unique update IDs",
    ],
    [
      "affected_devices",
      String(metrics.affectedDevices),
      "Unique affected asset IDs",
    ],
    [
      "device_patch_instances",
      String(metrics.devicePatchInstances),
      "Unique update/device pairs",
    ],
    [
      "deployment_jobs",
      String(workspace.deployments.length),
      "Includes demonstration-only jobs; no endpoint execution",
    ],
    [
      "verified_deployments",
      String(
        workspace.deployments.filter((job) => job.status === "Verified").length,
      ),
      "Requires a matching post-deployment rescan record",
    ],
    [
      "open_exceptions",
      String(
        workspace.exceptions.filter((exception) => exception.status === "Open")
          .length,
      ),
      "Stored open exceptions",
    ],
    [
      "approved_deferrals",
      String(
        workspace.exceptions.filter(
          (exception) => exception.status === "Approved deferral",
        ).length,
      ),
      "Stored approved deferrals; includes labeled demo records",
    ],
    [
      "SLA_critical_target_hours_proposed",
      String(workspace.criticalTargetHours),
      "Pending client confirmation; not an agreed SLA",
    ],
    [
      "SLA_open_critical_updates",
      String(openSlaRows.length),
      "Distinct applicable critical update IDs without verified production/emergency jobs",
    ],
    [
      "SLA_overdue_critical_updates",
      String(overdueSlaRows.length),
      "Due time calculated only when configured start and calendar are supported",
    ],
    [],
    [
      "record_type",
      "id",
      "hostname_or_update",
      "scope_or_applicability",
      "severity",
      "source",
      "source_name",
      "source_timestamp",
      "details",
    ],
    ...workspace.assets.map((asset) => [
      "asset",
      asset.id,
      asset.hostname,
      asset.scopeStatus,
      asset.criticality,
      asset.source,
      asset.sourceName,
      asset.sourceTimestamp,
      `${asset.osVersion}; ${asset.deviceType}; ${asset.businessOwner}; ${asset.department}; ${asset.site}; tool=${asset.managementTool}; thirdPartyApps=${asset.thirdPartyApplications}; connectivity=${asset.connectivity}; scan=${asset.lastScan}; reboot=${asset.rebootStatus}`,
    ]),
    ...workspace.scans.map((scan) => [
      "scan",
      scan.id,
      scan.updateId,
      scan.applicability,
      scan.severity,
      scan.source,
      scan.sourceName,
      scan.sourceTimestamp,
      `${scan.title}; product=${scan.product}; CVE=${scan.cves.join("|") || "Not confirmed"}; affected=${scan.affectedAssetIds.join("|") || "Not confirmed"}`,
    ]),
    ...slaRows.map((item) => {
      const remaining = item.due ? item.due.getTime() - Date.now() : null
      return [
        "critical_sla",
        item.scan.updateId,
        item.scan.affectedAssetIds.join("|"),
        item.verified
          ? "Verified"
          : remaining === null
            ? "Not calculated"
            : remaining < 0
              ? "Overdue"
              : "Within proposed target",
        item.scan.severity,
        item.scan.source,
        item.plan?.productionStatus ?? "No plan",
        item.due?.toISOString() ?? "Not calculated",
        `remaining_ms=${remaining ?? "Not calculated"}; offline_assets=${item.offlineCount}; clock=${workspace.clockStart}; policy=${workspace.policyConfirmed ? "Client confirmation required" : "Pending client confirmation"}`,
      ]
    }),
    ...workspace.plans.map((plan) => [
      "plan",
      plan.id,
      plan.updateId,
      `${plan.targetGroup} / ${plan.productionGroup}`,
      plan.result,
      "Demonstration",
      "Browser-persisted rehearsal",
      plan.createdAt,
      `pilot=${plan.pilotResult}; pilotApproval=${plan.pilotStatus}; productionApproval=${plan.productionStatus}; emergencyApproval=${plan.emergencyStatus}; testEvidence=${plan.evidence}; applicationChecks=${plan.applicationChecks}; recovery=${plan.recoveryPlan}; rollout=${plan.rolloutCriteria}; schedule=${plan.schedule}`,
    ]),
    ...workspace.approvals.map((approval) => [
      "approval",
      approval.id,
      approval.planId,
      approval.targetGroup,
      approval.decision,
      "Demonstration",
      approval.approver,
      approval.timestamp,
      `${approval.stage}; comments=${approval.comments}`,
    ]),
    ...workspace.deployments.map((deployment) => [
      "deployment",
      deployment.id,
      deployment.planId,
      deployment.targetGroup,
      deployment.status,
      deployment.resultSource,
      "Local rehearsal only",
      deployment.scheduledAt,
      `stage=${deployment.stage}; batch=${deployment.batchNumber}/${deployment.batchCount}; targetAssets=${deployment.targetAssetIds.join("|")}; rebootPolicy=${deployment.rebootPolicy}; rebootResult=${deployment.rebootResult}; attempts=${deployment.attempts}`,
    ]),
    ...workspace.exceptions.map((exception) => [
      "exception",
      exception.id,
      exception.assetOrUpdate,
      exception.status,
      exception.category,
      exception.source,
      exception.owner,
      exception.reviewDate,
      exception.compensatingAction,
    ]),
    ...workspace.audit.map((entry) => [
      "audit",
      entry.id,
      entry.actor,
      entry.action,
      entry.details,
      entry.source,
      "Browser record; not tamper-resistant",
      entry.timestamp,
      "",
    ]),
  ]
  downloadCsv("rcc-patchguard-january-2027-report.csv", rows)
}

function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob([exportCsv(rows)], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default App
