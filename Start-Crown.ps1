<#
  Crown & Calculation - PowerShell launcher (alternative when .bat files are blocked).
  Usage (from this folder):   powershell -ExecutionPolicy Bypass -File .\Start-Crown.ps1
  - With Node.js installed: builds on first run and serves with scripts/serve.mjs.
  - Without Node.js: serves an existing prebuilt "dist" folder using .NET HttpListener (no installs).
  Picks the first free port from 5173 upward and opens the default browser.
#>
param([int]$Port = 5173, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot
$dist = Join-Path $PSScriptRoot 'dist'
$node = Get-Command node -ErrorAction SilentlyContinue

if ($node) {
  if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    Write-Host 'First run: installing dependencies and building (about a minute)...'
    npm ci; if ($LASTEXITCODE -ne 0) { npm install }
    npm run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
  }
  $nodeArgs = @('scripts/serve.mjs', '--dir', 'dist', '--port', "$Port")
  if (-not $NoBrowser) { $nodeArgs += '--open' }
  & node @nodeArgs
  exit $LASTEXITCODE
}

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
  Write-Host 'Node.js is not installed and no prebuilt dist folder was found.'
  Write-Host 'Install Node.js LTS from https://nodejs.org and run this script again.'
  exit 1
}

$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.png'='image/png'; '.svg'='image/svg+xml'; '.map'='application/json'; '.wasm'='application/wasm' }
$listener = $null
$preferred = $Port
try {
  $probe = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$Port/__crown-health"
  if ($probe.Content -match 'crown-and-calculation') {
    Write-Host "Crown & Calculation is already running at http://127.0.0.1:$Port/ - opening it (your saves are there)."
    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/" }
    exit 0
  }
} catch { }
for ($p = $Port; $p -lt $Port + 50; $p++) {
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://127.0.0.1:$p/"); $l.Start(); $listener = $l; $Port = $p; break } catch { }
}
if (-not $listener) { throw 'No free port found.' }
$url = "http://127.0.0.1:$Port/"
Write-Host "Crown & Calculation is running at $url  (Ctrl+C to stop)"
if ($Port -ne $preferred) {
  Write-Host "WARNING: port $preferred is used by another program. Browsers keep saves per address, so saves made at http://127.0.0.1:$preferred/ are NOT visible here. Close the other program and restart, or use Settings > Backup to export there and import here." -ForegroundColor Yellow
}
if (-not $NoBrowser) { Start-Process $url }
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    if ($ctx.Request.Url.AbsolutePath -eq '/__crown-health') {
      $hb = [Text.Encoding]::UTF8.GetBytes('{"app":"crown-and-calculation"}'); $ctx.Response.ContentType = 'application/json'
      $ctx.Response.ContentLength64 = $hb.Length; $ctx.Response.OutputStream.Write($hb, 0, $hb.Length); $ctx.Response.OutputStream.Close(); continue
    }
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    $file = [IO.Path]::GetFullPath((Join-Path $dist $rel))
    if (-not $file.StartsWith([IO.Path]::GetFullPath($dist)) -or -not (Test-Path $file -PathType Leaf)) { $file = Join-Path $dist 'index.html' }
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
    $bytes = [IO.File]::ReadAllBytes($file)
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $ctx.Response.OutputStream.Close()
  }
} finally { $listener.Stop() }
