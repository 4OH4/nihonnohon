# dev.ps1 - Windows-native dev runner for the story-generator stack.
# Usage: from apps/story-generator-backend/ -> .\dev.ps1
#
# Starts both the Python backend (port 8000) and the Vite frontend (port 5174).
# The backend opens in a new terminal window so its output is visible.
# Close that window (or press Ctrl+C in it) to stop the backend.
#
# Linux/macOS: use `make dev` instead.

$ErrorActionPreference = 'Continue'

# Kill any processes currently occupying the dev ports
python scripts/kill_ports.py

# Resolve the current Python executable - picks up the active virtualenv
$pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $pythonExe) {
    $pythonExe = (Get-Command python3 -ErrorAction SilentlyContinue).Source
}
if (-not $pythonExe) {
    Write-Error "python not found on PATH. Activate your virtualenv first."
    exit 1
}

$backendDir = $PWD.Path

Write-Host "Using Python: $pythonExe"
Write-Host "Backend dir:  $backendDir"
Write-Host ""

# Launch uvicorn in a new PowerShell window using the resolved python.
# -NoExit keeps the window open so you can see logs / crash messages.
$backend = Start-Process -PassThru powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$backendDir'; `$env:PYTHONPATH = 'src'; & '$pythonExe' -m uvicorn story_generator.main:app --port 8000 --reload"
)

Write-Host "Backend starting in new window (PID $($backend.Id))..."
Write-Host "Waiting 2s for uvicorn to bind..."
Start-Sleep -Seconds 2

if ($backend.HasExited) {
    Write-Error "Backend process exited immediately - check the backend window for errors."
    exit 1
}

Write-Host "Opening frontend..."
Write-Host "  Ctrl+C here stops Vite."
Write-Host "  Close the backend window to stop uvicorn."
Write-Host ""

try {
    Push-Location ..\story-generator
    pnpm dev
} finally {
    Pop-Location
}
