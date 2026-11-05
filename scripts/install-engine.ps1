$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Venv = Join-Path $Root '.venv'
$Bootstrap = $env:CAPSNIP_BOOTSTRAP_PYTHON
if (-not $Bootstrap -and (Get-Command py -ErrorAction SilentlyContinue)) {
  foreach ($Version in @('3.12', '3.11')) {
    py "-$Version" --version *> $null
    if ($LASTEXITCODE -eq 0) { py "-$Version" -m venv $Venv; break }
  }
}
if (-not (Test-Path $Venv)) {
  if (-not $Bootstrap) {
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($PythonCommand -and $PythonCommand.Source -notmatch 'WindowsApps') {
      $Version = & $PythonCommand.Source -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
      if ($Version -in @('3.11', '3.12')) { $Bootstrap = $PythonCommand.Source }
    }
  }
  if (-not $Bootstrap -or -not (Test-Path $Bootstrap)) {
    Write-Host 'Python 3.11 or 3.12 was not found. Install Python, then run this setup again.' -ForegroundColor Yellow
    exit 1
  }
  & $Bootstrap -m venv $Venv
}
$Python = Join-Path $Venv 'Scripts\python.exe'
& $Python -m pip install --upgrade pip
& $Python -m pip install -r (Join-Path $Root 'engine\requirements.txt')
Write-Host "Speech engine installed. Set CAPSNIP_PYTHON to $Python before launching Capsnip if Python isn't on PATH." -ForegroundColor Green
