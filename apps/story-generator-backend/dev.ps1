# dev.ps1 — Windows-native dev runner for the story-generator stack.
# Usage: from apps/story-generator-backend/  →  .\dev.ps1
#
# Starts both the Python backend (port 8000) and the Vite frontend (port 5174).
# Press Ctrl+C to stop both processes.
#
# Linux/macOS: use `make dev` instead.

$ErrorActionPreference = 'SilentlyContinue'

# Kill any processes currently occupying the dev ports
python3 scripts/kill_ports.py

# Start uvicorn in a new window (or background job)
$backend = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    python -m uvicorn story_generator.main:app --port 8000 --reload
}

Write-Host "Backend started (job $($backend.Id)). Opening frontend..."

try {
    # Run pnpm dev in foreground — Ctrl+C here will stop the frontend
    Push-Location ..\story-generator
    pnpm dev
} finally {
    Pop-Location
    Write-Host "`nStopping backend..."
    Stop-Job $backend
    Remove-Job $backend -Force
}
