# AI Evolution Jarvis — instalacja jednym poleceniem (Windows).
#
#   irm https://raw.githubusercontent.com/aievolutionpl/AGENT_CZESIEK/main/scripts/install-jarvis.ps1 | iex
#
# Pobiera najnowszy instalator z GitHub Releases, instaluje go po cichu dla
# bieżącego użytkownika (bez UAC — instalator NSIS jest per-user), a potem
# uruchamia aplikację. Skrót na pulpicie i w menu Start tworzy sam instalator.
#
# Parametry:
#   -Version v0.17.2   konkretne wydanie zamiast najnowszego
#   -NoLaunch          nie uruchamiaj aplikacji po instalacji
#   -SignerSha256 HASH   wymagany odcisk SHA-256 certyfikatu wydawcy (opcja administratora)
#   -DryRun            pokaż, co zostałoby pobrane, bez zmian na dysku

param(
    [string]$Version = 'latest',
    [ValidatePattern('^[0-9a-fA-F]{64}$')]
    [string]$SignerSha256,
    [switch]$NoLaunch,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Repo = if ($env:JARVIS_REPO) { $env:JARVIS_REPO } else { 'aievolutionpl/AGENT_CZESIEK' }
$AppName = 'AI Evolution Jarvis'

function Say([string]$Message) { Write-Host "> $Message" -ForegroundColor Cyan }
function Step([int]$Number, [string]$Title) { Write-Host ""; Write-Host "[$Number/4] $Title" -ForegroundColor Magenta }
function Ok([string]$Message) { Write-Host "OK $Message" -ForegroundColor Green }

function Show-NextSteps {
    Write-Host ''
    Write-Host '  Co dalej' -ForegroundColor White
    Write-Host '  1. Jarvis otworzy kreator: Jak dziala -> Silnik -> Glos ...'
    Write-Host '  2. Najprostszy start: klucz OpenRouter (openrouter.ai/keys)'
    Write-Host '     - jeden klucz daje GPT, Claude, Gemini i DeepSeek.'
    Write-Host '  3. W kroku "Polaczenia i API" wybierz Google, e-mail, komunikatory'
    Write-Host '     - Jarvis poprowadzi Cie krok po kroku.'
    Write-Host ''
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Step 1 'Sprawdzam system i wydanie'
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }

if ($env:JARVIS_RELEASE_JSON) {
    $release = Get-Content -Raw $env:JARVIS_RELEASE_JSON | ConvertFrom-Json
} else {
    $api = if ($Version -eq 'latest') {
        "https://api.github.com/repos/$Repo/releases/latest"
    } else {
        "https://api.github.com/repos/$Repo/releases/tags/$Version"
    }
    $release = Invoke-RestMethod -Uri $api -Headers @{ Accept = 'application/vnd.github+json' }
}

# The NSIS .exe, not the .msi: it is the per-user, no-admin path.
$asset = $release.assets | Where-Object { $_.name -match "-win-$arch\.exe$" } | Select-Object -First 1
if (-not $asset -and $arch -eq 'arm64') {
    # x64 builds run on Windows on ARM through emulation.
    $asset = $release.assets | Where-Object { $_.name -match '-win-x64\.exe$' } | Select-Object -First 1
}
if (-not $asset) { throw "Brak instalatora Windows w wydaniu $($release.tag_name)." }

Say "Wydanie: $($release.tag_name)"
Say "Pobieram: $($asset.browser_download_url)"

if ($DryRun) {
    Say 'Tryb próbny — nic nie zostało zmienione.'
    return
}

Step 2 'Pobieram Jarvisa'
if ($asset.digest -notmatch '^sha256:([0-9a-fA-F]{64})$') {
    throw 'Wydanie nie zawiera sumy SHA-256 instalatora.'
}
$expectedHash = $Matches[1]
$tempDir = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ([guid]::NewGuid().ToString()))
$installer = Join-Path $tempDir.FullName 'setup.exe'
try {
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installer -UseBasicParsing
    if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash -ne $expectedHash) {
        throw 'Suma SHA-256 instalatora jest niezgodna. Instalacja przerwana.'
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $installer
    if ($signature.Status -ne 'Valid') {
        throw 'Instalator nie ma prawidłowego podpisu Authenticode.'
    }
    if ($SignerSha256) {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $actualSigner = [BitConverter]::ToString($sha.ComputeHash($signature.SignerCertificate.RawData)).Replace('-', '')
        } finally { $sha.Dispose() }
        if ($actualSigner -ne $SignerSha256) { throw 'Certyfikat wydawcy nie odpowiada wskazanemu odciskowi.' }
    }
    Step 3 'Instaluję zweryfikowany plik'
    $process = Start-Process -FilePath $installer -ArgumentList '/S' -PassThru -Wait
} finally {
    Remove-Item -LiteralPath $tempDir.FullName -Recurse -Force -ErrorAction SilentlyContinue
}
if ($process.ExitCode -ne 0) { throw "Instalator zakończył się kodem $($process.ExitCode)." }

$exe = Join-Path $env:LOCALAPPDATA "Programs\$AppName\$AppName.exe"
Step 4 'Skrót na pulpicie i w menu Start'
Ok "Gotowe. Skrót '$AppName' jest na pulpicie i w menu Start."
Say 'Wskazówka: prawy przycisk na ikonie w pasku zadań -> Przypnij do paska zadań.'
Show-NextSteps

if (-not $NoLaunch -and (Test-Path $exe)) {
    Say "Uruchamiam $AppName…"
    Start-Process -FilePath $exe
}
