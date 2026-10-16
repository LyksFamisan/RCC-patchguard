#requires -Version 5.1
#requires -RunAsAdministrator
[CmdletBinding()]
param([switch]$AllowRestart, [switch]$Once)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'RCCPatchGuardAgent'
$connection = Get-Content (Join-Path $root 'connection.json') -Raw | ConvertFrom-Json
$uri = [Uri]$connection.base
if ($uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) { throw 'A trusted HTTPS backend is required.' }
$journal = Join-Path $root 'remote-jobs'
[IO.Directory]::CreateDirectory($journal) | Out-Null
# Only this operator and SYSTEM may modify the job journal.
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $journal /inheritance:r /grant:r "${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not secure the job journal.' }
$mutex = New-Object Threading.Mutex($false, "Local\RCCPatchGuard-$($connection.deviceId)")
if (-not $mutex.WaitOne(0)) { throw 'A worker is already running for this device.' }
function Api($path, $body) {
    $secure = ConvertTo-SecureString $connection.protectedToken
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        Invoke-RestMethod -Uri ($connection.base.TrimEnd('/') + $path) -Method Post -Headers @{Authorization="Bearer $token"} -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 15 -Compress) -MaximumRedirection 0 -TimeoutSec 30
    } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $token=$null }
}
function Save-Entry($entry) {
    $file = Join-Path $journal ($entry.id + '.json')
    $temp = $file + '.tmp'
    # DPAPI protects the claim token at rest under the enrolled Windows user.
    $json = $entry | ConvertTo-Json -Depth 15 -Compress
    $protected = ConvertFrom-SecureString (ConvertTo-SecureString $json -AsPlainText -Force)
    [IO.File]::WriteAllText($temp, $protected)
    Move-Item $temp $file -Force
}
function Read-Entry($file) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR((ConvertTo-SecureString ([IO.File]::ReadAllText($file))))
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) | ConvertFrom-Json }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Send-Result($entry) {
    $ack = Api '/api/remote/result' @{deviceId=$connection.deviceId;jobId=$entry.id;claimToken=$entry.claimToken;status=$entry.status;detail=$entry.detail}
    if (-not $ack.accepted) { throw 'Result not acknowledged.' }
}
function In-Window($job) {
    $now = [DateTimeOffset]::UtcNow
    if ($now -lt [DateTimeOffset]::Parse($job.startsAt) -or $now -ge [DateTimeOffset]::Parse($job.endsAt)) { throw 'Maintenance window is closed.' }
}
function Authorize($job) {
    In-Window $job
    $ack = Api '/api/remote/authorize' @{deviceId=$connection.deviceId;jobId=$job.id;claimToken=$job.claimToken}
    if (-not $ack.authorized) { throw 'Execution authorization denied.' }
}
function Install-Approved($job) {
    Authorize $job
    if ((New-Object -ComObject Microsoft.Update.SystemInfo).RebootRequired) { throw 'Restart required before installation. Request a separate restart job.' }
    $session = New-Object -ComObject Microsoft.Update.Session
    $session.ClientApplicationID = 'RCC PatchGuard'
    $search = $session.CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
    if ([int]$search.ResultCode -ne 2) { throw 'Windows Update search was incomplete.' }
    $updates = New-Object -ComObject Microsoft.Update.UpdateColl
    foreach ($requested in $job.updates) {
        $match = @($search.Updates | Where-Object { $_.Identity.UpdateID -eq $requested.id -and $_.Identity.RevisionNumber -eq $requested.revision })
        if ($match.Count -ne 1) { throw 'An approved update is no longer applicable; upload a new scan.' }
        if ($match[0].InstallationBehavior.CanRequestUserInput) { throw 'An update requires interactive installation.' }
        # Do not silently accept license terms on behalf of the client.
        if (-not $match[0].EulaAccepted) { throw 'Accept this update license through the approved Windows process first.' }
        $null = $updates.Add($match[0])
    }
    if ($updates.Count -eq 0) { throw 'No approved updates.' }
    $downloader = $session.CreateUpdateDownloader(); $downloader.Updates=$updates
    $download = $downloader.Download()
    if ([int]$download.ResultCode -ne 2) { throw 'Update download did not fully succeed.' }
    In-Window $job
    $installer = $session.CreateUpdateInstaller(); $installer.Updates=$updates
    $installer.AllowSourcePrompts=$false; $installer.ForceQuiet=$true
    Authorize $job
    $installed = $installer.Install()
    $results = @()
    for ($i=0; $i -lt $updates.Count; $i++) {
        $result = $installed.GetUpdateResult($i)
        $results += @{id=$updates.Item($i).Identity.UpdateID; resultCode=[int]$result.ResultCode; hresult=[int]$result.HResult}
    }
    $success = [int]$installed.ResultCode -eq 2 -and @($results | Where-Object {$_.resultCode -ne 2}).Count -eq 0
    return @{status=$(if($success){'succeeded'}else{'failed'});detail=@{updates=$results;rebootRequired=[bool]$installed.RebootRequired;verification='Windows installer result; post-install scan required'}}
}
Write-Host 'RCC PatchGuard worker running. Only separately approved device jobs will execute.'
try {
    do {
        try {
            $blocked = $false
            foreach ($file in Get-ChildItem $journal -Filter '*.json') {
                $entry = Read-Entry $file.FullName
                if ($entry.status -eq 'running') {
                    $entry.status='failed'; $entry.detail=@{message='Worker interrupted; outcome unknown. Review device before creating another job.'}; Save-Entry $entry
                }
                if ($entry.status -eq 'restart_pending') {
                    $boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString('o')
                    if ($boot -ne $entry.bootBefore) {
                        $entry.status='restart_confirmed'; $entry.detail=@{bootTime=$boot}; Save-Entry $entry
                    } else { $blocked=$true }
                }
                Send-Result $entry
                if ($entry.status -ne 'restart_pending') { Remove-Item $file.FullName }
            }
            if (-not $blocked) {
                $os = Get-CimInstance Win32_OperatingSystem
                $null = Api '/api/agent/heartbeat' @{deviceId=$connection.deviceId;inventory=@{hostname=$env:COMPUTERNAME;os=$os.Caption;version=$os.Version;build=$os.BuildNumber;architecture=$os.OSArchitecture;agentVersion='0.2.0-worker'}}
                $response = Api '/api/remote/poll' @{deviceId=$connection.deviceId}
                $job = $response.job
                if ($job) {
                    if ($job.id -notmatch '^[a-f0-9]{32}$' -or $job.deviceId -ne $connection.deviceId) { throw 'Invalid job identity.' }
                    $entry = @{id=$job.id;claimToken=$job.claimToken;status='running';detail=@{};bootBefore=$os.LastBootUpTime.ToUniversalTime().ToString('o')}
                    Save-Entry $entry
                    try {
                        In-Window $job
                        if ($job.kind -eq 'install') {
                            $result = Install-Approved $job; $entry.status=$result.status; $entry.detail=$result.detail
                        } elseif ($job.kind -eq 'restart') {
                            if (-not $AllowRestart) { throw 'Restart is disabled locally. Start the worker with -AllowRestart after authorizing restarts.' }
                            $entry.status='restart_pending'; $entry.detail=@{message='Restart authorized; awaiting a new Windows boot'}
                            Save-Entry $entry
                            Send-Result $entry
                            Authorize $job
                            # No /f: applications may block restart to protect unsaved work.
                            & "$env:SystemRoot\System32\shutdown.exe" /r /t 0 /d p:2:17 /c 'RCC PatchGuard approved maintenance restart'
                            if ($LASTEXITCODE -ne 0) { throw 'Windows rejected restart.' }
                        } else { throw 'Unsupported operation.' }
                    } catch { $entry.status='failed'; $entry.detail=@{message=$_.Exception.Message} }
                    Save-Entry $entry
                    Send-Result $entry
                    if ($entry.status -ne 'restart_pending') { Remove-Item (Join-Path $journal ($entry.id+'.json')) }
                }
            }
        } catch { Write-Warning 'Worker paused: check API availability, credentials, and local job journal. No automatic job replay.' }
        if (-not $Once) { Start-Sleep -Seconds 30 }
    } while (-not $Once)
} finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
