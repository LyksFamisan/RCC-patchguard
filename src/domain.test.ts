import assert from "node:assert/strict"
import test from "node:test"
import {
  canApprove,
  canSchedule,
  createInitialState,
  demoScans,
  exportCsv,
  hasPostDeploymentVerification,
  loadWorkspaceState,
  parseAssetCsv,
  parseScanCsv,
  summarizeScans,
  scopeFingerprint,
  targetSetIsApplicable,
} from "./domain.ts"

test("inventory CSV validates required hostname and reports row issues", () => {
  const preview = parseAssetCsv(
    'hostname,os version,business owner,site\nACM-01,"Windows 11, 24H2",Finance,Manila\n,Windows 10,Operations,Cebu',
  )
  assert.equal(preview.valid.length, 1)
  assert.equal(preview.valid[0].osVersion, "Windows 11, 24H2")
  assert.equal(preview.valid[0].scopeStatus, "Discovered")
  assert.equal(preview.valid[0].source, "Imported report")
  assert.equal(preview.valid[0].criticality, "Not confirmed")
  assert.deepEqual(preview.errors, ["Row 3: hostname is required."])
})

test("inventory CSV detects in-file and existing-asset duplicates", () => {
  const existing = createInitialState().assets
  const preview = parseAssetCsv(
    "hostname,ip\nACM-MNL-LT-041,10.24.18.41\nDUP-IP,10.24.18.41\nNEW-01,10.0.0.1\nNEW-01,10.0.0.1",
    existing,
  )
  assert.equal(preview.duplicates, 3)
  assert.deepEqual(
    preview.valid.map((asset) => asset.hostname),
    ["NEW-01"],
  )
})

test("inventory CSV reports malformed quoted cells instead of throwing", () => {
  const preview = parseAssetCsv('hostname,owner\nACM-01,"Finance')
  assert.deepEqual(preview.valid, [])
  assert.match(preview.errors[0], /unclosed quoted field/)
})

test("scan metrics keep patch checks, devices and device-patch instances distinct", () => {
  assert.deepEqual(summarizeScans(demoScans), {
    distinctPatchChecks: 3,
    affectedDevices: 3,
    devicePatchInstances: 4,
  })
})

test("approval scope must be covered by applicable scan evidence", () => {
  assert.equal(
    targetSetIsApplicable(demoScans, "KB5048667", ["ACM-0001", "ACM-0002"]),
    true,
  )
  assert.equal(
    targetSetIsApplicable(demoScans, "KB5048667", ["ACM-0001", "UNKNOWN"]),
    false,
  )
  assert.equal(targetSetIsApplicable(demoScans, "KB5048667", []), false)
  assert.equal(
    targetSetIsApplicable(demoScans, "KB5034441", ["ACM-0003"]),
    false,
  )
})

test("scan report CSV resolves inventory assets and tags imported evidence", () => {
  const assets = createInitialState().assets
  const csv =
    "update id,title,product,severity,cve,applicability,affected assets\nKB7777777,Security update,Windows 11,Critical,CVE-2027-7777,Applicable,ACM-MNL-LT-041"
  const preview = parseScanCsv(csv, assets)
  assert.equal(preview.valid.length, 1)
  assert.deepEqual(preview.valid[0].affectedAssetIds, ["ACM-0001"])
  assert.equal(preview.valid[0].source, "Imported report")
  assert.equal(preview.valid[0].cves[0], "CVE-2027-7777")
  assert.equal(preview.valid[0].applicability, "Applicable")

  const duplicatePreview = parseScanCsv(
    `${csv}\nKB7777777,Security update,Windows 11,Critical,CVE-2027-7777,Applicable,ACM-MNL-LT-041`,
    assets,
  )
  assert.equal(duplicatePreview.valid.length, 1)
  assert.equal(duplicatePreview.duplicates, 1)

  const unknownAsset = parseScanCsv(
    "update id,title,severity,applicability,affected assets\nKB1,Update,High,Applicable,UNKNOWN-01",
    assets,
  )
  assert.equal(unknownAsset.valid.length, 0)
  assert.match(unknownAsset.errors[0], /not in the imported inventory/)
})

test("verification requires a post-deployment rescan for every target", () => {
  const plan = {
    id: "plan-1",
    updateId: "KB1",
    targetGroup: "Pilot",
    productionGroup: "Production",
    evidence: "Evidence",
    applicationChecks: "Checks",
    recoveryPlan: "Recovery",
    rolloutCriteria: "Criteria",
    schedule: "2027-01-01T00:00:00.000Z",
    rebootPolicy: "None",
    result: "Passed" as const,
    pilotResult: "Not run" as const,
    pilotStatus: "Approved" as const,
    productionStatus: "Not requested" as const,
    emergencyStatus: "Not requested" as const,
    createdAt: "2026-12-30T00:00:00.000Z",
  }
  const deployment = {
    id: "job-1",
    planId: plan.id,
    targetGroup: "Pilot",
    targetAssetIds: ["asset-1", "asset-2"],
    batchNumber: 1,
    batchCount: 1,
    stage: "Pilot" as const,
    status: "Awaiting verification" as const,
    scheduledAt: "2027-01-01T00:00:00.000Z",
    rebootPolicy: "None",
    rebootResult: "Not confirmed",
    resultSource: "Demonstration" as const,
    attempts: 1,
  }
  const rescan = {
    ...demoScans[0],
    id: "verify-1",
    updateId: "KB1",
    affectedAssetIds: ["asset-1", "asset-2"],
    applicability: "Not applicable after rescan · demonstration",
    sourceTimestamp: "2027-01-01T00:05:00.000Z",
  }
  assert.equal(
    hasPostDeploymentVerification(plan, deployment, [rescan], [
      "asset-1",
      "asset-2",
    ]),
    true,
  )
  assert.equal(
    hasPostDeploymentVerification(plan, deployment, [rescan], [
      "asset-1",
      "asset-3",
    ]),
    false,
  )
  assert.equal(
    hasPostDeploymentVerification(
      plan,
      deployment,
      [{ ...rescan, sourceTimestamp: deployment.scheduledAt }],
      ["asset-1"],
    ),
    false,
  )
})

test("only AC Mobility Approver can approve workflow stages in rehearsal", () => {
  assert.equal(canApprove("AC Mobility Approver", "Pilot"), true)
  assert.equal(canApprove("AC Mobility Approver", "Production"), true)
  assert.equal(canApprove("AC Mobility Approver", "Emergency"), true)
  assert.equal(canApprove("RCC Engineer", "Pilot"), false)
  assert.equal(canApprove("Administrator", "Production"), false)
  assert.equal(canApprove("Read-only Management", "Emergency"), false)
})

test("only operator/admin personas may schedule rehearsal deployments", () => {
  assert.equal(canSchedule("RCC Engineer"), true)
  assert.equal(canSchedule("Administrator"), true)
  assert.equal(canSchedule("AC Mobility Approver"), false)
  assert.equal(canSchedule("Read-only Management"), false)
})

test("approval fingerprint changes when target membership or plan details change", () => {
  const plan = {
    id: "plan-1",
    updateId: "KB1",
    targetGroup: "Pilot",
    productionGroup: "Production",
    evidence: "Test log",
    applicationChecks: "App opens",
    recoveryPlan: "Rollback",
    rolloutCriteria: "No failures",
    schedule: "Saturday",
    rebootPolicy: "No reboot",
    result: "Passed" as const,
    pilotResult: "Not run" as const,
    pilotStatus: "Not requested" as const,
    productionStatus: "Not requested" as const,
    emergencyStatus: "Not requested" as const,
    createdAt: "2027-01-01T00:00:00.000Z",
  }
  const initial = scopeFingerprint(plan, ["asset-1"])
  assert.notEqual(scopeFingerprint(plan, ["asset-1", "asset-2"]), initial)
  assert.notEqual(
    scopeFingerprint({ ...plan, schedule: "Sunday" }, ["asset-1"]),
    initial,
  )
})

test("saved workspace loading migrates the old inventory key", () => {
  const storage = {
    getItem: (key: string) =>
      key === "rcc-imported-assets"
        ? JSON.stringify([
            { id: "OLD-1", hostname: "LEGACY-01", os: "Windows 11" },
          ])
        : null,
  }
  const { state, error } = loadWorkspaceState(storage)
  assert.equal(error, null)
  assert.equal(
    state.assets.find((asset) => asset.id === "OLD-1")?.scopeStatus,
    "Discovered",
  )
})

test("CSV export escapes commas, quotes, and newlines", () => {
  assert.equal(
    exportCsv([
      ["hostname", "owner"],
      ["ACM-01", 'Finance, "HQ"\nEast'],
    ]),
    'hostname,owner\r\nACM-01,"Finance, ""HQ""\nEast"',
  )
})
