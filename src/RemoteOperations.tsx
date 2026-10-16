import { useEffect, useState, type FormEvent } from 'react'
import type { AgentUser, LiveAgentDevice, LiveAgentScan } from './agent-api'

type Job = {
  id: string; hostname: string; kind: 'install' | 'restart'; status: string
  reason: string; starts_at: string; ends_at: string
  updates: { id: string; revision: number }[]
  result: { receivedAt: string; detail: Record<string, unknown> } | null
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { credentials: 'include', method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({ error: 'Remote operations API is not deployed.' }))
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data as T
}
export default function RemoteOperations({ user, devices, scans }: { user: AgentUser | null; devices: LiveAgentDevice[]; scans: LiveAgentScan[] }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const [kind, setKind] = useState<'install' | 'restart'>('install')
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [hostname, setHostname] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [confirmation, setConfirmation] = useState<Record<string, string>>({})
  const device = devices.find(d => d.id === deviceId)
  const latest = scans.filter(s => s.asset_id === deviceId).sort((a,b) => (b.received_at || '').localeCompare(a.received_at || ''))[0]
  const updates = latest?.updates || []
  async function refresh() {
    try { const data = await api<{records: Job[]}>('/api/remote/jobs'); setJobs(data.records); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Cannot load jobs') }
  }
  useEffect(() => {
    let active = true
    setJobs([]); setError('')
    if (user) {
      api<{records: Job[]}>('/api/remote/jobs').then(data => {if(active) setJobs(data.records)}).catch(e => {if(active) setError(e.message)})
    }
    return () => { active = false }
  }, [user?.id])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await api('/api/remote/jobs', { deviceId, kind, reason, confirmHostname: hostname, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), updates: kind === 'install' ? updates.filter(u => selected.includes(u.update_id)).map(u => ({id:u.update_id, revision:Number(u.revision)})) : [] })
      setSelected([]); setReason(''); setHostname(''); await refresh()
    } catch(e) { setError(e instanceof Error ? e.message : 'Request failed') }
    finally { setBusy(false) }
  }
  async function decide(job: Job, action: 'approve' | 'cancel') {
    setBusy(true)
    try { await api(`/api/remote/jobs/${job.id}/${action}`, {confirmHostname:confirmation[job.id] || ''}); await refresh() }
    catch(e) { setError(e instanceof Error ? e.message : 'Request failed') }
    finally { setBusy(false) }
  }
  return <section className="panel remote-operations">
    <div className="panel-heading"><div><h2>Remote operations</h2><p>Approved Windows update installation and restart jobs.</p></div><button className="button button-secondary" onClick={refresh} disabled={!user || busy}>Refresh jobs</button></div>
    <div className="remote-body">
      {!user ? <p>Sign in under Enroll Device to manage remote jobs.</p> : <>
        <p className="subtle-banner">Each job needs a separate client approver and an elevated Windows worker. Installation never automatically restarts the device.</p>
        {error && <p className="workspace-banner workspace-error" role="alert">{error}</p>}
        {user.role === 'engineer' && <form onSubmit={submit} className="remote-request">
          <div className="settings-fields">
            <label>Enrolled device<select required value={deviceId} onChange={e => {setDeviceId(e.target.value);setSelected([]);setHostname('')}}><option value="">Select device</option>{devices.filter(d => d.enrollment_status === 'active').map(d => <option key={d.id} value={d.id}>{d.hostname}</option>)}</select></label>
            <label>Operation<select value={kind} onChange={e => {setKind(e.target.value as 'install'|'restart');setSelected([])}}><option value="install">Install selected updates</option><option value="restart">Restart device</option></select></label>
            <label>Window start · local time<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)}/></label>
            <label>Window end · local time<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)}/></label>
            <label>Change reason<input required minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Change ticket and maintenance reason"/></label>
            <label>Confirm hostname<input required value={hostname} onChange={e => setHostname(e.target.value)} placeholder={device?.hostname || 'Exact device hostname'}/></label>
          </div>
          {kind === 'install' && <fieldset className="remote-updates"><legend>Updates from latest agent scan</legend>{!updates.length ? <p>Upload a current Windows agent scan to select updates.</p> : updates.map(u => <label key={u.id}><input type="checkbox" checked={selected.includes(u.update_id)} onChange={e => setSelected(e.target.checked ? [...selected,u.update_id] : selected.filter(id => id !== u.update_id))}/><span>{u.kb || 'Windows Update'} · {u.title}<small className="table-sub">{u.update_id} · revision {u.revision}</small></span></label>)}</fieldset>}
          {kind === 'restart' && <p className="workspace-banner">A restart can interrupt active work. Notify the user before approval. Unsaved applications may block the restart.</p>}
          <button className="button button-primary" disabled={busy || !device || hostname !== device.hostname || (kind === 'install' && !selected.length)}>Request approval</button>
        </form>}
        <div className="table-wrap"><table><thead><tr><th>Device / operation</th><th>Maintenance window</th><th>Status / result</th><th>Approval</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}>
          <td><strong>{job.hostname}</strong><span className="table-sub">{job.kind === 'install' ? `Install ${job.updates.length} update(s)` : 'Restart'} · {job.reason}</span><span className="table-sub mono">{job.id}</span></td>
          <td>{new Date(job.starts_at).toLocaleString()}<span className="table-sub">until {new Date(job.ends_at).toLocaleString()}</span></td>
          <td><span className="badge">{job.status.split('_').join(' ')}</span>{job.result && <details><summary>Agent result</summary><pre>{JSON.stringify(job.result.detail,null,2)}</pre></details>}</td>
          <td>{job.status === 'pending' && user.role === 'client_approver' && <div className="stack"><span>{job.updates.length ? job.updates.map(u => `${u.id} r${u.revision}`).join(', ') : 'Restart approved device'}</span><label>Confirm {job.hostname}<input value={confirmation[job.id] || ''} onChange={e => setConfirmation({...confirmation,[job.id]:e.target.value})}/></label><button className="button button-primary" disabled={busy || confirmation[job.id] !== job.hostname} onClick={() => decide(job,'approve')}>Approve {job.kind}</button></div>}{['pending','approved'].includes(job.status) && ['engineer','client_approver'].includes(user.role) && <button className="button button-secondary" disabled={busy} onClick={() => decide(job,'cancel')}>Cancel request</button>}</td>
        </tr>)}</tbody></table>{!jobs.length && <p className="empty-inline">No remote jobs.</p>}</div>
        <p className="field-help">Installer success requires a follow-up scan. Restart completion is reported only after the worker observes a new Windows boot. Running jobs are never replayed automatically.</p>
      </>}
    </div>
  </section>
}
