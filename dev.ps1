#!/usr/bin/env pwsh
# SideQuest Development Server Launcher (PowerShell)
# Builds and runs the development server in one command

Write-Host "Building SideQuest..." -ForegroundColor Cyan
pnpm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting server on http://localhost:3001..." -ForegroundColor Green
Write-Host ""
node dist/index.js
