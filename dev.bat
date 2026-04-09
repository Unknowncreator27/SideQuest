@echo off
REM SideQuest Development Server Launcher
REM Builds and runs the development server in one command

echo Building SideQuest...
call pnpm run build

if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

echo.
echo Starting server on http://localhost:3001...
echo.
node dist/index.js
