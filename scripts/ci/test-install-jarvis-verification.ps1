# Exercise the real installer control flow with an inert payload. No network or process launch.
$ErrorActionPreference = 'Stop'
$work = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
$installerScript = Join-Path $PSScriptRoot '../install-jarvis.ps1'
$envNames = @('JARVIS_RELEASE_JSON','TEMP','LOCALAPPDATA','PROCESSOR_ARCHITECTURE')
$previous = @{}
foreach ($name in $envNames) { $previous[$name] = [Environment]::GetEnvironmentVariable($name) }
function Invoke-WebRequest($Uri, $OutFile, [switch]$UseBasicParsing) {
    [IO.File]::WriteAllBytes($OutFile, $bytes)
}
function Get-AuthenticodeSignature($LiteralPath) {
    [pscustomobject]@{Status = $case.signature; SignerCertificate = @{RawData=$bytes}}
}
function Start-Process($FilePath, $ArgumentList, [switch]$PassThru, [switch]$Wait) {
    $tracker.starts++
    [pscustomobject]@{ExitCode = 0}
}
try {
    $null = New-Item -ItemType Directory -Path $work
    $env:TEMP = $work
    $env:LOCALAPPDATA = $work
    $env:PROCESSOR_ARCHITECTURE = 'AMD64'
    $env:JARVIS_RELEASE_JSON = Join-Path $work 'release.json'
    $bytes = [Text.Encoding]::UTF8.GetBytes('inert-payload')
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $expected = 'sha256:' + ([BitConverter]::ToString($hash.ComputeHash($bytes))).Replace('-','') }
    finally { $hash.Dispose() }
    foreach ($case in @(
        @{ digest=$expected; signature='Valid'; allowed=$true },
        @{ digest=('sha256:' + ('0' * 64)); signature='Valid'; allowed=$false },
        @{ digest=$null; signature='Valid'; allowed=$false },
        @{ digest=$expected; signature='NotSigned'; allowed=$false },
        @{ digest=$expected; signature='Valid'; pin=('1' * 64); allowed=$false },
        @{ digest=$expected; signature='Valid'; pin=$expected.Substring(7); allowed=$true }
    )) {
        $tracker = @{ starts = 0 }
        $asset = @{name='test-win-x64.exe'; digest=$case.digest; browser_download_url='https://example.invalid/setup.exe'}
        @{tag_name='fixture'; assets=@($asset)} | ConvertTo-Json -Depth 4 | Set-Content $env:JARVIS_RELEASE_JSON
        $failed = $false
        $params = @{ NoLaunch=$true }
        if ($case.pin) { $params.SignerSha256 = $case.pin }
        try { & $installerScript @params } catch { $failed = $true }
        if ($failed -eq $case.allowed -or $tracker.starts -ne [int]$case.allowed) {
            throw 'Unexpected installer verification result'
        }
        if (Get-ChildItem -Path $work -Directory) { throw 'Temporary download directory left behind' }
    }
} finally {
    foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) }
    Remove-Item -LiteralPath $work -Recurse -Force
}
