#requires -Version 5.1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$script:root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'RCCPatchGuardAgent'
[IO.Directory]::CreateDirectory($script:root) | Out-Null
$script:statePath = Join-Path $script:root 'connection.json'
$script:connection = $null
$script:job = $null
$script:updates = @()
$script:scanReport = $null
$script:lastSuccess = 'Never'
$os = Get-CimInstance Win32_OperatingSystem
$script:inventory = @{hostname=$env:COMPUTERNAME; os=$os.Caption; version=$os.Version; build=$os.BuildNumber; agentVersion='0.1.0'; architecture=$os.OSArchitecture}

function Endpoint([string]$base) {
    $uri = $null
    if (-not [Uri]::TryCreate($base, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) {
        throw 'Use an HTTPS backend URL without credentials, query or fragment.'
    }
    return $base.TrimEnd('/')
}
function Post-Api([string]$base,[string]$path,$body,[string]$credential) {
    $headers = @{}
    if ($credential) { $headers.Authorization = "Bearer $credential" }
    # Do not follow redirects with device credentials.
    Invoke-RestMethod -Uri ((Endpoint $base)+$path) -Method Post -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 12 -Compress) -TimeoutSec 20 -MaximumRedirection 0
}
function Secret-Text($secure) {
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Say([string]$message) { $script:log.AppendText(('['+(Get-Date -Format 'HH:mm:ss')+'] '+$message+"`r`n")) }
function Failure([string]$message) { [Windows.Forms.MessageBox]::Show($message,'RCC PatchGuard', 'OK','Warning') | Out-Null }
function Heartbeat {
    if (-not $script:connection) { Failure 'Register with a compatible backend first.'; return }
    try {
        $secret=Secret-Text (ConvertTo-SecureString $script:connection.protectedToken)
        $ack=Post-Api $script:connection.base '/api/agent/heartbeat' @{deviceId=$script:connection.deviceId; observedAt=[DateTime]::UtcNow.ToString('o'); inventory=$script:inventory; capabilities=@('inventory','heartbeat','read-only-scan')} $secret
        if ($ack.acknowledged -ne $true) { throw 'Heartbeat not acknowledged.' }
        $script:lastSuccess=(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
        $status.Text="Backend reachable | Last acknowledged heartbeat: $script:lastSuccess"
        Say 'Heartbeat acknowledged by backend.'
    } catch {
        $status.Text="Backend unreachable / heartbeat failed | Last success: $script:lastSuccess"
        Say 'Heartbeat failed. Check server availability, HTTPS trust, API contract and device credentials.'
    } finally { $secret=$null }
}

$form=New-Object Windows.Forms.Form
$form.Text='RCC PatchGuard | Windows Agent'
$form.Size=New-Object Drawing.Size(1020,780)
$form.MinimumSize=New-Object Drawing.Size(1020,780)
$form.StartPosition='CenterScreen'
$form.BackColor=[Drawing.Color]::FromArgb(244,247,250)
$form.Font=New-Object Drawing.Font('Segoe UI',10)
function Label($text,$x,$y,$w,$h) {
    $l=New-Object Windows.Forms.Label
    $l.Text=$text; $l.Location=New-Object Drawing.Point($x,$y); $l.Size=New-Object Drawing.Size($w,$h)
    $form.Controls.Add($l); return $l
}
function Button($text,$x,$y,$w,$action) {
    $b=New-Object Windows.Forms.Button
    $b.Text=$text; $b.Location=New-Object Drawing.Point($x,$y); $b.Size=New-Object Drawing.Size($w,36)
    $b.BackColor=[Drawing.Color]::FromArgb(0,130,128); $b.ForeColor=[Drawing.Color]::White
    $b.FlatStyle='Flat'; $b.Add_Click($action); $form.Controls.Add($b); return $b
}
$title=Label 'RCC PatchGuard | Windows Agent' 24 18 950 38
$title.Font=New-Object Drawing.Font('Segoe UI',20,[Drawing.FontStyle]::Bold)
$title.ForeColor=[Drawing.Color]::FromArgb(12,30,54)
$null=Label 'Local inventory and read-only scanning | Installation and restart are not implemented.' 26 64 950 28
$null=Label ("Device: "+$env:COMPUTERNAME+"   |   "+$os.Caption+"   |   Build "+$os.BuildNumber) 26 100 950 25
$status=Label 'Backend: Not configured | No heartbeat sent' 26 132 950 30
$status.ForeColor=[Drawing.Color]::FromArgb(160,90,0)
$null=Label 'Backend HTTPS address' 26 176 250 24
$address=New-Object Windows.Forms.TextBox
$address.Location=New-Object Drawing.Point(26,202); $address.Size=New-Object Drawing.Size(590,28)
$form.Controls.Add($address)
$null=Label 'Single-use enrollment token (not saved)' 26 239 450 24
$token=New-Object Windows.Forms.TextBox
$token.UseSystemPasswordChar=$true; $token.Location=New-Object Drawing.Point(26,266); $token.Size=New-Object Drawing.Size(590,28)
$form.Controls.Add($token)
$enroll=Button 'Register device' 640 200 160 {
    if ($script:connection) { Failure 'A device registration already exists. Forget it locally before enrolling again; revoke the old credential on the server.'; return }
    if (-not $token.Text.Trim()) { Failure 'Enter a single-use enrollment token from your backend.'; return }
    try {
        $base=Endpoint $address.Text.Trim()
        $result=Post-Api $base '/api/agent/enroll' @{enrollmentToken=$token.Text; inventory=$script:inventory} ''
        if (-not $result.deviceId -or -not $result.deviceToken) { throw 'Invalid enrollment response.' }
        $script:connection=@{base=$base; deviceId=[string]$result.deviceId; protectedToken=(ConvertTo-SecureString ([string]$result.deviceToken) -AsPlainText -Force | ConvertFrom-SecureString)}
        $script:connection | ConvertTo-Json | Set-Content $script:statePath -Encoding UTF8
        $token.Clear(); $address.ReadOnly=$true
        $status.Text='Registered | Send heartbeat to verify current connectivity'
        Say 'Registered; device credential protected with Windows user encryption.'
    } catch { Say 'Registration failed; check the documented API contract, network and trusted HTTPS certificate.'; Failure 'Registration failed. The server must implement API-CONTRACT.md. No connected status has been recorded.' }
    finally { $token.Clear(); $result=$null }
}
$heartbeat=Button 'Send heartbeat' 640 246 160 { Heartbeat }
$forget=Button 'Forget locally' 816 200 160 {
    if ([Windows.Forms.MessageBox]::Show('Remove this local credential? Revoke it separately in the backend.','Forget registration','YesNo','Warning') -eq 'Yes') {
        Remove-Item $script:statePath -ErrorAction SilentlyContinue
        $script:connection=$null; $address.ReadOnly=$false; $status.Text='Not registered | Server-side credential revocation may still be required'
        Say 'Local registration removed.'
    }
}
$auto=New-Object Windows.Forms.CheckBox
$auto.Text='Heartbeat every 60 seconds while app is open'; $auto.Location=New-Object Drawing.Point(26,310); $auto.Size=New-Object Drawing.Size(550,26)
$form.Controls.Add($auto)
$scan=Button 'Scan missing updates' 26 352 205 {
    if ($script:job) { return }
    $scan.Enabled=$false; $scanState.Text='Scanning Windows configured update source... This may take several minutes.'
    Say 'Started a real, read-only Windows Update scan; no installation requested.'
    $script:job=Start-Job -ScriptBlock {
        $ErrorActionPreference='Stop'
        $session=New-Object -ComObject Microsoft.Update.Session
        $session.ClientApplicationID='RCC PatchGuard ReadOnly Agent'
        $searcher=$session.CreateUpdateSearcher()
        $found=$searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
        $rows=@()
        for ($i=0; $i -lt $found.Updates.Count; $i++) {
            $u=$found.Updates.Item($i)
            $rows+= [pscustomobject]@{UpdateId=[string]$u.Identity.UpdateID; Revision=[int]$u.Identity.RevisionNumber; KB=(@($u.KBArticleIDs) -join ', '); Title=[string]$u.Title; Severity=if($u.MsrcSeverity){[string]$u.MsrcSeverity}else{'Unknown'}; Source='Windows configured update source'}
        }
        [pscustomobject]@{resultCode=[int]$found.ResultCode; scannedAt=[DateTime]::UtcNow.ToString('o'); updates=$rows; rebootRequired=[bool](New-Object -ComObject Microsoft.Update.SystemInfo).RebootRequired}
    }
}
$export=Button 'Export scan JSON' 245 352 175 {
    if (-not $script:scanReport) { Failure 'Complete a scan first.'; return }
    $dialog=New-Object Windows.Forms.SaveFileDialog
    $dialog.Filter='JSON report (*.json)|*.json'; $dialog.FileName='RCC-Windows-Scan.json'
    if ($dialog.ShowDialog() -eq 'OK') { $script:scanReport | ConvertTo-Json -Depth 10 | Set-Content $dialog.FileName -Encoding UTF8; Say 'Exported local scan evidence.' }
    $dialog.Dispose()
}
$upload=Button 'Send scan to backend' 434 352 205 {
    if (-not $script:scanReport -or -not $script:connection) { Failure 'A completed scan and registered backend are required.'; return }
    try {
        $secret=Secret-Text (ConvertTo-SecureString $script:connection.protectedToken)
        $ack=Post-Api $script:connection.base '/api/agent/scans' @{deviceId=$script:connection.deviceId; report=$script:scanReport} $secret
        if ($ack.accepted -ne $true) { throw 'Scan not accepted.' }
        Say 'Backend acknowledged scan submission. Confirm records in your dashboard.'
    } catch { Say 'Scan upload failed. Local results remain available for export.' }
    finally { $secret=$null }
}
$scanState=Label 'Scan: Not started. Coverage follows Windows update-source policy; not a full vulnerability scan.' 26 400 950 38
$grid=New-Object Windows.Forms.DataGridView
$grid.Location=New-Object Drawing.Point(26,442); $grid.Size=New-Object Drawing.Size(950,155)
$grid.ReadOnly=$true; $grid.AllowUserToAddRows=$false; $grid.AllowUserToDeleteRows=$false
$grid.AutoSizeColumnsMode='Fill'; $grid.RowHeadersVisible=$false
foreach($name in @('Title','KB','Severity','UpdateId','Revision')) { $null=$grid.Columns.Add($name,$name) }
$grid.Columns['Title'].FillWeight=250
$form.Controls.Add($grid)
$script:log=New-Object Windows.Forms.TextBox
$script:log.Location=New-Object Drawing.Point(26,610); $script:log.Size=New-Object Drawing.Size(950,90)
$script:log.Multiline=$true; $script:log.ReadOnly=$true; $script:log.ScrollBars='Vertical'; $form.Controls.Add($script:log)
$null=Label 'Runs only while open. No service installed. No patch installation, remote commands or automatic restart.' 26 709 950 24

if (Test-Path $script:statePath) {
    try {
        $loaded=Get-Content $script:statePath -Raw | ConvertFrom-Json
        $null=Endpoint $loaded.base
        $null=ConvertTo-SecureString $loaded.protectedToken
        $script:connection=$loaded; $address.Text=$loaded.base; $address.ReadOnly=$true
        $status.Text='Saved registration | Connectivity not yet checked this session'
    } catch { Say 'Saved registration cannot be read. Re-register from the same Windows user or forget locally.' }
}
$timer=New-Object Windows.Forms.Timer
$timer.Interval=1000
$script:ticks=0
$timer.Add_Tick({
    $script:ticks++
    if ($script:job -and $script:job.State -in @('Completed','Failed','Stopped')) {
        try {
            $r=Receive-Job $script:job -ErrorAction Stop
            if (-not $r -or $r.resultCode -ne 2) { throw 'Scan incomplete or failed.' }
            $script:updates=@($r.updates)
            $script:scanReport=@{inventory=$script:inventory; scannedAt=$r.scannedAt; resultCode=$r.resultCode; rebootRequired=$r.rebootRequired; source='Windows configured update source'; updates=$script:updates}
            $grid.Rows.Clear()
            foreach($u in $script:updates) { $null=$grid.Rows.Add($u.Title,$u.KB,$u.Severity,$u.UpdateId,$u.Revision) }
            $scanState.Text="Scan complete: $($script:updates.Count) applicable updates | Restart pending: $($r.rebootRequired) | UTC: $($r.scannedAt)"
            Say 'Scan complete. This result does not assert application health or full security compliance.'
        } catch { $scanState.Text='Scan failed or incomplete. No compliance claim. Check Windows Update policy/services and retry.'; Say 'Scan failed; prior successful evidence, if any, retains its original timestamp.' }
        finally { Remove-Job $script:job -Force; $script:job=$null; $scan.Enabled=$true }
    }
    if ($auto.Checked -and $script:connection -and ($script:ticks % 60 -eq 0)) { Heartbeat }
})
$form.Add_FormClosed({ $timer.Stop(); if($script:job){Stop-Job $script:job; Remove-Job $script:job -Force}; $timer.Dispose() })
Say 'Local Windows agent started. No backend connectivity assumed.'
$timer.Start()
[Windows.Forms.Application]::Run($form)
$form.Dispose()
